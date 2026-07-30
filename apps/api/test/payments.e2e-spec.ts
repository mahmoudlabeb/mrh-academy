import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  UserRole,
  LessonStatus,
  PaymentStatus,
  PaymentMethod,
} from '@mrh/types';
import { hash } from 'argon2';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { StudentProfile } from '../src/students/entities/student-profile.entity.js';
import { User } from '../src/users/entities/user.entity.js';
import { RedisService } from '../src/redis/redis.service.js';
import { RedisServiceMock } from './redis.mock.js';
import { Payment } from '../src/payments/entities/payment.entity.js';
import { TutorProfile } from '../src/tutors/entities/tutor-profile.entity.js';
import { TutorAvailability } from '../src/tutors/entities/tutor-availability.entity.js';
import { Lesson } from '../src/lessons/entities/lesson.entity.js';
import { CourseStatus } from '@mrh/types';
import { authenticateUser } from './isolated-fixtures.js';
import { PaymentMethodConfig } from '../src/payments/entities/payment-method-config.entity.js';
import { EmailService } from '../src/integrations/email/email.service.js';
import { EmailServiceMock } from './email.mock.js';
import { PayPalService } from '../src/payments/paypal/paypal.service.js';

const payPalServiceMock = {
  isConfigured: jest.fn(() => true),
  isWebhookConfigured: jest.fn(() => true),
  createOrder: jest.fn(async () => ({
    orderId: 'PAYPAL-E2E-ORDER',
    approvalUrl:
      'https://www.sandbox.paypal.com/checkoutnow?token=PAYPAL-E2E-ORDER',
  })),
  captureOrder: jest.fn(async () => 'PAYPAL-E2E-CAPTURE'),
};

function futureDayIso(daysAhead = 1): string {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  date.setHours(0, 0, 0, 0);
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
      .overrideProvider(EmailService)
      .useClass(EmailServiceMock)
      .overrideProvider(PayPalService)
      .useValue(payPalServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    userRepository = app.get(getRepositoryToken(User));
    studentProfileRepository = app.get(getRepositoryToken(StudentProfile));
    paymentRepository = app.get(getRepositoryToken(Payment));
    lessonRepository = app.get(getRepositoryToken(Lesson));
    const paymentMethodConfigRepository = app.get(
      getRepositoryToken(PaymentMethodConfig),
    ) as Repository<PaymentMethodConfig>;

    await paymentRepository.query(`TRUNCATE TABLE payments CASCADE`);
    await lessonRepository.query(`TRUNCATE TABLE lessons CASCADE`);
    await studentProfileRepository.query(
      `TRUNCATE TABLE student_profiles CASCADE`,
    );
    await userRepository.query(`TRUNCATE TABLE users CASCADE`);
    await paymentMethodConfigRepository.upsert(
      {
        type: PaymentMethod.PAYPAL,
        label: 'PayPal',
        enabled: true,
        sortOrder: 1,
      },
      ['type'],
    );

    const passwordHash = await hash('Test-password-2026!');

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
        timezone: 'UTC',
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

    adminToken = (
      await authenticateUser(
        app,
        userRepository,
        'admin_pay@test.com',
        'Test-password-2026!',
      )
    ).accessToken;
    studentToken = (
      await authenticateUser(
        app,
        userRepository,
        'student_pay@test.com',
        'Test-password-2026!',
      )
    ).accessToken;
    tutorToken = (
      await authenticateUser(
        app,
        userRepository,
        'tutor_pay@test.com',
        'Test-password-2026!',
      )
    ).accessToken;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('does not allow anonymous course checkout to create an account', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/payments/course-checkout')
      .send({ courseId: 'course-that-does-not-matter' })
      .expect(401);
  });

  it('credits a PayPal top-up only after verified server-side capture', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/payments/submit')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        amount: 1500,
        method: 'paypal',
        idempotencyKey: randomUUID(),
      });
    if (res.status !== 201) console.error(res.body);
    expect(res.status).toBe(201);
    expect(res.body.payment.status).toBe('pending');
    expect(res.body.checkoutUrl).toContain('sandbox.paypal.com');

    await request(app.getHttpServer())
      .post(`/api/v1/payments/paypal/${res.body.payment.id}/capture`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(201);

    const student = await studentProfileRepository.findOne({
      where: { userId: studentUser.id },
    });
    expect(student?.balance).toBe(1500);
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
    expect(student?.balance).toBe(1800);
  });

  it('Student multi-hour booking is immediately confirmed, visible, and classroom-authorized', async () => {
    const scheduledDay = futureDayIso();
    const idempotencyKey = randomUUID();

    const res = await request(app.getHttpServer())
      .post('/api/v1/lessons/book')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        idempotencyKey,
        tutorId: tutorUser.id,
        scheduledTime: scheduledDay,
        durationMinutes: 120,
      });
    if (res.status !== 201) console.error(res.body);
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('confirmed');

    const student = await studentProfileRepository.findOne({
      where: { userId: studentUser.id },
    });
    expect(student?.balance).toBeCloseTo(1700, 2);
    expect(res.body.durationMinutes).toBe(120);
    expect(
      new Date(res.body.endTime).getTime() -
        new Date(res.body.scheduledTime).getTime(),
    ).toBe(120 * 60 * 1000);
    expect(Number(res.body.platformFee)).toBe(30);
    expect(Number(res.body.tutorShare)).toBe(70);

    const tutorSchedule = await request(app.getHttpServer())
      .get('/api/v1/lessons?page=1&limit=50')
      .set('Authorization', `Bearer ${tutorToken}`)
      .expect(200);
    expect(tutorSchedule.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: res.body.id,
          status: LessonStatus.CONFIRMED,
          paymentStatus: 'paid',
        }),
      ]),
    );

    const retry = await request(app.getHttpServer())
      .post('/api/v1/lessons/book')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        idempotencyKey,
        tutorId: tutorUser.id,
        scheduledTime: scheduledDay,
        durationMinutes: 120,
      })
      .expect(201);
    expect(retry.body.id).toBe(res.body.id);

    const studentAfterRetry = await studentProfileRepository.findOne({
      where: { userId: studentUser.id },
    });
    expect(studentAfterRetry?.balance).toBeCloseTo(1700, 2);

    const lessonId = res.body.id;
    const roomId = res.body.roomId;

    await lessonRepository.update(lessonId, {
      scheduledTime: new Date(Date.now() - 60_000),
      endTime: new Date(Date.now() + 119 * 60_000),
    });
    const studentClassroom = await request(app.getHttpServer())
      .get(`/api/v1/lessons/by-room/${roomId}`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    expect(studentClassroom.body.access).toEqual(
      expect.objectContaining({ state: 'allowed', canJoin: true }),
    );
    const tutorClassroom = await request(app.getHttpServer())
      .get(`/api/v1/lessons/by-room/${roomId}`)
      .set('Authorization', `Bearer ${tutorToken}`)
      .expect(200);
    expect(tutorClassroom.body.access).toEqual(
      expect.objectContaining({ state: 'allowed', canJoin: true }),
    );

    await lessonRepository.update(lessonId, {
      scheduledTime: new Date(Date.now() - 3600000),
      endTime: new Date(Date.now() - 60000),
    });

    await request(app.getHttpServer())
      .post(`/api/v1/lessons/${lessonId}/complete`)
      .set('Authorization', `Bearer ${tutorToken}`)
      .expect(201);

    const tutorProfileRepo = app.get(getRepositoryToken(TutorProfile));
    const tutor = await tutorProfileRepo.findOne({
      where: { userId: tutorUser.id },
    });
    expect(tutor?.balance).toBe(70);

    const completedLesson = await lessonRepository.findOne({
      where: { id: lessonId },
    });
    expect(completedLesson?.status).toBe(LessonStatus.COMPLETED);
  });
});
