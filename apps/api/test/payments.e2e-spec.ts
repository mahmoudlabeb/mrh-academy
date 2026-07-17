import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  UserRole,
  LessonStatus,
  PaymentStatus,
  PaymentMethod,
} from '@mrh/types';
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
import { Lesson } from '../src/entities/lesson.entity.js';
import { CourseStatus } from '@mrh/types';

function futureDayIso(daysAhead = 1): string {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function futureScheduledTimeIso(daysAhead = 1, hourUtc = 10): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysAhead);
  date.setUTCHours(hourUtc, 0, 0, 0);
  return date.toISOString();
}

describe('Payments & Booking Flow (e2e)', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let studentProfileRepository: Repository<StudentProfile>;
  let paymentRepository: Repository<Payment>;
  let lessonRepository: Repository<Lesson>;

  let adminToken: string;
  let studentUser: User;
  let studentToken: string;
  let tutorUser: User;
  let tutorToken: string;

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
    lessonRepository = app.get(getRepositoryToken(Lesson));

    await paymentRepository.query(`TRUNCATE TABLE payments CASCADE`);
    await lessonRepository.query(`TRUNCATE TABLE lessons CASCADE`);
    await studentProfileRepository.query(
      `TRUNCATE TABLE student_profiles CASCADE`,
    );
    await userRepository.query(`TRUNCATE TABLE users CASCADE`);

    const passwordHash = await bcrypt.hash('Test1234', 12);

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

    tutorUser = await userRepository.save(
      userRepository.create({
        email: 'tutor_pay@test.com',
        firstName: 'Tutor',
        lastName: 'Pay',
        passwordHash,
        role: UserRole.TUTOR,
        isVerified: true,
      }),
    );

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

    const scheduledDay = futureDayIso();
    const availabilityRepo = app.get(getRepositoryToken(TutorAvailability));
    await availabilityRepo.save(
      availabilityRepo.create({
        tutorId: tutorUser.id,
        dayOfWeek: new Date(scheduledDay).getUTCDay(),
        startTime: '00:00',
        endTime: '23:59',
      }),
    );

    let res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin_pay@test.com', password: 'Test1234' })
      .expect(200);
    adminToken = res.body.accessToken;

    res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'student_pay@test.com', password: 'Test1234' })
      .expect(200);
    studentToken = res.body.accessToken;

    res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'tutor_pay@test.com', password: 'Test1234' })
      .expect(200);
    tutorToken = res.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('Student PayPal top-up is auto-approved and credits balance', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/payments/submit')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ amount: 1500, method: 'paypal' });
    if (res.status !== 201) console.error(res.body);
    expect(res.status).toBe(201);
    expect(res.body.payment.status).toBe('approved');

    const student = await studentProfileRepository.findOne({
      where: { userId: studentUser.id },
    });
    expect(student?.balance).toBe(100);
  });

  it('Admin can approve a manually submitted pending payment', async () => {
    const pendingPayment = await paymentRepository.save(
      paymentRepository.create({
        userId: studentUser.id,
        amount: 300,
        method: PaymentMethod.BANK,
        currency: 'USD',
        status: PaymentStatus.PENDING,
      }),
    );

    await request(app.getHttpServer())
      .post(`/api/v1/admin/payments/${pendingPayment.id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);

    const student = await studentProfileRepository.findOne({
      where: { userId: studentUser.id },
    });
    expect(student?.balance).toBe(120);
  });

  it('Student can book a lesson as a pending request without balance deduction', async () => {
    const scheduledDay = futureDayIso();

    const res = await request(app.getHttpServer())
      .post('/api/v1/lessons/book')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        tutorId: tutorUser.id,
        scheduledTime: scheduledDay,
        durationMinutes: 50,
      });
    if (res.status !== 201) console.error(res.body);
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('pending');

    const student = await studentProfileRepository.findOne({
      where: { userId: studentUser.id },
    });
    expect(student?.balance).toBe(120);
  });

  it('Tutor approves lesson, balance is deducted, and tutor can complete it', async () => {
    const resLessons = await request(app.getHttpServer())
      .get('/api/v1/lessons')
      .set('Authorization', `Bearer ${tutorToken}`)
      .expect(200);

    expect(resLessons.body.length).toBeGreaterThan(0);
    const lessonId = resLessons.body[0].id;
    const scheduledTime = futureScheduledTimeIso();

    const approveRes = await request(app.getHttpServer())
      .post(`/api/v1/lessons/${lessonId}/approve`)
      .set('Authorization', `Bearer ${tutorToken}`)
      .send({ scheduledTime });
    if (approveRes.status !== 201) console.error(approveRes.body);
    expect(approveRes.status).toBe(201);
    expect(approveRes.body.status).toBe('confirmed');

    const studentAfterApproval = await studentProfileRepository.findOne({
      where: { userId: studentUser.id },
    });
    expect(studentAfterApproval?.balance).toBeCloseTo(78.33, 2);

    await lessonRepository.update(lessonId, {
      scheduledTime: new Date(Date.now() - 3600000),
    });

    await request(app.getHttpServer())
      .post(`/api/v1/lessons/${lessonId}/complete`)
      .set('Authorization', `Bearer ${tutorToken}`)
      .expect(201);

    const tutorProfileRepo = app.get(getRepositoryToken(TutorProfile));
    const tutor = await tutorProfileRepo.findOne({
      where: { userId: tutorUser.id },
    });
    expect(tutor?.balance).toBeGreaterThan(0);

    const completedLesson = await lessonRepository.findOne({
      where: { id: lessonId },
    });
    expect(completedLesson?.status).toBe(LessonStatus.COMPLETED);
  });
});
