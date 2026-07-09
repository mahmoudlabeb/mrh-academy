import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserRole } from '@mrh/types';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { StudentProfile } from '../src/entities/student-profile.entity.js';
import { User } from '../src/entities/user.entity.js';
import { RedisService } from '../src/redis/redis.service.js';
import { RedisServiceMock } from './redis.mock.js';
import { Payment } from '../src/entities/payment.entity.js';
import { TutorProfile } from '../src/entities/tutor-profile.entity.js';
import { TutorAvailability } from '../src/entities/tutor-availability.entity.js';
import { CourseStatus } from '@mrh/types';

describe('Payments & Booking Flow (e2e)', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let studentProfileRepository: Repository<StudentProfile>;
  let paymentRepository: Repository<Payment>;

  let adminToken: string;
  let studentUser: User;
  let studentToken: string;

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

    userRepository = app.get(getRepositoryToken(User));
    studentProfileRepository = app.get(getRepositoryToken(StudentProfile));
    paymentRepository = app.get(getRepositoryToken(Payment));

    // Clear db for these tests
    await paymentRepository.query(`TRUNCATE TABLE payments CASCADE`);
    await studentProfileRepository.query(
      `TRUNCATE TABLE student_profiles CASCADE`,
    );
    await userRepository.query(`TRUNCATE TABLE users CASCADE`);

    const passwordHash = await bcrypt.hash('Test1234', 12);

    // Create Admin
    await userRepository.save(
      userRepository.create({
        email: 'admin_pay@test.com',
        firstName: 'Admin',
        lastName: 'Pay',
        passwordHash,
        role: UserRole.ADMIN,
        isVerified: true,
      }),
    );

    // Create Student
    studentUser = await userRepository.save(
      userRepository.create({
        email: 'student_pay@test.com',
        firstName: 'Student',
        lastName: 'Pay',
        passwordHash,
        role: UserRole.STUDENT,
        isVerified: true,
      }),
    );
    await studentProfileRepository.save(
      studentProfileRepository.create({
        userId: studentUser.id,
        balance: 0,
      }),
    );

    // Login Admin
    let res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin_pay@test.com', password: 'Test1234' })
      .expect(200);
    adminToken = res.body.accessToken;

    // Login Student
    res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'student_pay@test.com', password: 'Test1234' })
      .expect(200);
    studentToken = res.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('Student can request a top-up payment', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/payments/submit')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ amount: 1500, method: 'paypal' });
    if (res.status !== 201) console.error(res.body);
    expect(res.status).toBe(201);

    expect(res.body.payment.status).toBe('pending');
  });

  it('Admin can approve the pending payment, adding to student balance', async () => {
    // 1. Find the pending payment
    const payments = await paymentRepository.find({
      where: { userId: studentUser.id },
    });
    expect(payments.length).toBeGreaterThan(0);
    const payment = payments[0];

    // 2. Admin approves it
    await request(app.getHttpServer())
      .post(`/api/v1/admin/payments/${payment.id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);

    // 3. Verify student balance updated
    const student = await studentProfileRepository.findOne({
      where: { userId: studentUser.id },
    });
    expect(student?.balance).toBe(100);
  });

  it('Student can book a lesson', async () => {
    // We need a tutor first. Let's create one.
    const tutorUser = await userRepository.save(
      userRepository.create({
        email: 'tutor_pay@test.com',
        firstName: 'Tutor',
        lastName: 'Pay',
        passwordHash: await bcrypt.hash('Test1234', 12),
        role: UserRole.TUTOR,
        isVerified: true,
      }),
    );

    // Add Tutor Profile (Approved)
    const tutorProfileRepo = app.get(getRepositoryToken(TutorProfile));
    await tutorProfileRepo.save(
      tutorProfileRepo.create({
        userId: tutorUser.id,
        bio: 'Test bio',
        specialization: 'Test specialization',
        languages: ['English'],
        hourlyRate: 50,
        balance: 0,
        status: CourseStatus.APPROVED,
      }),
    );

    const time = new Date();
    time.setDate(time.getDate() + 1); // tomorrow

    // Add Availability
    const availabilityRepo = app.get(getRepositoryToken(TutorAvailability));
    await availabilityRepo.save(
      availabilityRepo.create({
        tutorId: tutorUser.id,
        dayOfWeek: time.getDay(),
        startTime: '00:00',
        endTime: '23:59',
      }),
    );

    // Book Lesson
    const res = await request(app.getHttpServer())
      .post('/api/v1/lessons/book')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        tutorId: tutorUser.id,
        scheduledTime: time.toISOString(),
        durationMinutes: 50,
      });
    if (res.status !== 201) console.error(res.body);
    expect(res.status).toBe(201);

    expect(res.body.status).toBe('confirmed');

    // Verify balance deduction
    const student = await studentProfileRepository.findOne({
      where: { userId: studentUser.id },
    });
    expect(student?.balance).toBe(58.33);
  });

  it('Tutor can complete a lesson and get paid', async () => {
    // We need the tutor's token
    const resTutor = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'tutor_pay@test.com', password: 'Test1234' })
      .expect(200);
    const tutorToken = resTutor.body.accessToken;

    // Get the lesson
    const resLessons = await request(app.getHttpServer())
      .get('/api/v1/lessons')
      .set('Authorization', `Bearer ${tutorToken}`)
      .expect(200);

    const lessonId = resLessons.body[0].id;

    // Complete lesson
    await request(app.getHttpServer())
      .post(`/api/v1/lessons/${lessonId}/complete`)
      .set('Authorization', `Bearer ${tutorToken}`)
      .expect(201);

    // Check tutor balance
    const tutorProfileRepo = app.get(getRepositoryToken(TutorProfile));
    const tutor = await tutorProfileRepo.findOne({
      where: { userId: resTutor.body.user.id },
    });

    // Tutor should have received their share (e.g. 50 * 0.8 = 40)
    expect(tutor?.balance).toBeGreaterThan(0);
  });
});
