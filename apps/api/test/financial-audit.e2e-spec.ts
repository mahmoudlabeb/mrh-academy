import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { UserRole, CourseStatus, LessonStatus } from '@mrh/types';
import { RedisService } from '../src/redis/redis.service';
import { RedisServiceMock } from './redis.mock';
import * as bcrypt from 'bcrypt';

jest.setTimeout(60000);

describe('Financial Audit (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let adminToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(RedisService)
      .useClass(RedisServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    dataSource = app.get(DataSource);

    // Create admin
    const passwordHash = await bcrypt.hash('Test1234', 12);
    const adminEmail = `admin-audit-${Date.now()}@test.com`;
    await dataSource.query(
      `INSERT INTO users (email, "passwordHash", "firstName", "lastName", role, "isVerified") VALUES ($1, $2, $3, $4, $5, $6)`,
      [adminEmail, passwordHash, 'Admin', 'Audit', UserRole.ADMIN, true],
    );

    const adminLoginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password: 'Test1234' });
    adminToken = adminLoginRes.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('executes financial flow', async () => {
    const studentEmail = `student-audit-${Date.now()}@test.com`;
    const tutorEmail = `tutor-audit-${Date.now()}@test.com`;

    // 1. Register student and tutor
    const studentRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: studentEmail,
        password: 'Test1234',
        firstName: 'Student',
        lastName: 'Audit',
        role: UserRole.STUDENT,
      });
    const studentToken = studentRes.body.accessToken;
    const studentId = studentRes.body.user.id;
    console.log('Student Register Response:', JSON.stringify(studentRes.body));

    const tutorRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: tutorEmail,
        password: 'Test1234',
        firstName: 'Tutor',
        lastName: 'Audit',
        role: UserRole.TUTOR,
      });
    const tutorToken = tutorRes.body.accessToken;
    const tutorId = tutorRes.body.user.id;
    console.log('Tutor Register Response:', JSON.stringify(tutorRes.body));

    // Get tutor approved
    await dataSource.query(
      `UPDATE tutor_profiles SET bio = $2, specialization = $3, languages = $4, "hourlyRate" = $5, status = $6, balance = $7, "totalHoursTaught" = $8 WHERE "userId" = $1`,
      [
        tutorId,
        'Audit Tutor',
        'Audit',
        '{English}',
        25.0,
        CourseStatus.APPROVED,
        0,
        0,
      ],
    );

    // 2. Fund student balance to exactly $100.00
    await dataSource.query(
      `UPDATE student_profiles SET balance = 100.00 WHERE "userId" = $1`,
      [studentId],
    );
    const studentBalanceQ1 = await dataSource.query(
      `SELECT balance FROM student_profiles WHERE "userId" = $1`,
      [studentId],
    );
    console.log('Student Balance (Raw PSQL):', studentBalanceQ1);

    // 3. Set tutor availability
    const availRes = await request(app.getHttpServer())
      .post('/api/v1/tutor/availability')
      .set('Authorization', `Bearer ${tutorToken}`)
      .send({
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '15:00',
        isRecurring: true,
      });
    console.log('Availability Response:', JSON.stringify(availRes.body));

    // 4. Book a lesson within window
    // Calculate a Monday date in the future
    const now = new Date();
    const daysUntilMonday = (1 - now.getDay() + 7) % 7 || 7;
    now.setDate(now.getDate() + daysUntilMonday);
    now.setHours(10, 0, 0, 0);
    const scheduledTime = now.toISOString();

    const book1Res = await request(app.getHttpServer())
      .post('/api/v1/lessons/book')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ tutorId, scheduledTime, durationMinutes: 50 });
    console.log('Book 1 Response:', JSON.stringify(book1Res.body));
    const lesson1Id = book1Res.body.id;

    const studentBalanceQ2 = await dataSource.query(
      `SELECT balance FROM student_profiles WHERE "userId" = $1`,
      [studentId],
    );
    console.log(
      'Student Balance After Booking 1 (Raw PSQL):',
      studentBalanceQ2,
    );

    // 5. Attempt genuinely overlapping second booking
    const bookOverlapRes = await request(app.getHttpServer())
      .post('/api/v1/lessons/book')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ tutorId, scheduledTime, durationMinutes: 50 });
    console.log(
      'Book Overlapping Response:',
      bookOverlapRes.status,
      JSON.stringify(bookOverlapRes.body),
    );

    // 6. Attempt adjacent (non-overlapping) booking
    now.setHours(11, 0, 0, 0);
    const adjacentTime = now.toISOString();
    const bookAdjRes = await request(app.getHttpServer())
      .post('/api/v1/lessons/book')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ tutorId, scheduledTime: adjacentTime, durationMinutes: 50 });
    console.log(
      'Book Adjacent Response:',
      bookAdjRes.status,
      JSON.stringify(bookAdjRes.body),
    );
    const lessonAdjId = bookAdjRes.body.id;

    // 7. Reject the first lesson as tutor
    const rejectRes = await request(app.getHttpServer())
      .post(`/api/v1/lessons/${lesson1Id}/reject`)
      .set('Authorization', `Bearer ${tutorToken}`);
    console.log('Reject 1 Response:', JSON.stringify(rejectRes.body));

    const studentBalanceQ3 = await dataSource.query(
      `SELECT balance FROM student_profiles WHERE "userId" = $1`,
      [studentId],
    );
    console.log('Student Balance After Reject (Raw PSQL):', studentBalanceQ3);

    // 8. Book again, accept as tutor, then complete as student
    now.setHours(12, 0, 0, 0);
    const time3 = now.toISOString();
    const book3Res = await request(app.getHttpServer())
      .post('/api/v1/lessons/book')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ tutorId, scheduledTime: time3, durationMinutes: 50 });
    console.log('Book 3 Response:', JSON.stringify(book3Res.body));
    const lesson3Id = book3Res.body.id;

    const acceptRes = await request(app.getHttpServer())
      .post(`/api/v1/lessons/${lesson3Id}/approve`)
      .set('Authorization', `Bearer ${tutorToken}`);
    console.log('Accept 3 Response:', JSON.stringify(acceptRes.body));

    // Force date in past to complete it
    await dataSource.query(
      `UPDATE lessons SET "scheduledTime" = $1, "endTime" = $2 WHERE id = $3`,
      [
        new Date(Date.now() - 3600000).toISOString(),
        new Date(Date.now() - 1000).toISOString(),
        lesson3Id,
      ],
    );

    const completeRes = await request(app.getHttpServer())
      .post(`/api/v1/lessons/${lesson3Id}/complete`)
      .set('Authorization', `Bearer ${tutorToken}`);
    console.log('Complete 3 Response:', JSON.stringify(completeRes.body));

    const verifyQ1 = await dataSource.query(
      `SELECT "platformFee", price FROM lessons WHERE id = $1`,
      [lesson3Id],
    );
    console.log('Lesson 3 Verification (Raw PSQL):', verifyQ1);

    const tutorBalanceQ = await dataSource.query(
      `SELECT balance, "totalHoursTaught" FROM tutor_profiles WHERE "userId" = $1`,
      [tutorId],
    );
    console.log('Tutor Balance After Completion (Raw PSQL):', tutorBalanceQ);

    const studentBalanceQ4 = await dataSource.query(
      `SELECT balance FROM student_profiles WHERE "userId" = $1`,
      [studentId],
    );
    console.log(
      'Student Balance After Completion (Raw PSQL):',
      studentBalanceQ4,
    );

    // 9. Fire 2 simultaneous booking requests for the same tutor/slot
    now.setHours(13, 0, 0, 0);
    const simTime = now.toISOString();

    const p1 = request(app.getHttpServer())
      .post('/api/v1/lessons/book')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ tutorId, scheduledTime: simTime, durationMinutes: 50 });

    const p2 = request(app.getHttpServer())
      .post('/api/v1/lessons/book')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ tutorId, scheduledTime: simTime, durationMinutes: 50 });

    const [res1, res2] = await Promise.all([p1, p2]);
    console.log('Simultaneous Book 1:', res1.status, JSON.stringify(res1.body));
    console.log('Simultaneous Book 2:', res2.status, JSON.stringify(res2.body));
  });
});
