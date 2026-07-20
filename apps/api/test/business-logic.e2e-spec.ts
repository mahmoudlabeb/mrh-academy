import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserRole, CourseStatus, LessonStatus } from '@mrh/types';
import { hash } from 'argon2';
import helmet from 'helmet';
import request from 'supertest';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { Lesson } from '../src/lessons/entities/lesson.entity.js';
import { Review } from '../src/reviews/entities/review.entity.js';
import { StudentProfile } from '../src/students/entities/student-profile.entity.js';
import { SubAdminProfile } from '../src/admin/entities/sub-admin-profile.entity.js';
import { TutorProfile } from '../src/tutors/entities/tutor-profile.entity.js';
import { User } from '../src/users/entities/user.entity.js';
import { RedisService } from '../src/redis/redis.service.js';
import { RedisServiceMock } from './redis.mock.js';

type AuthResponse = {
  accessToken: string;
  user: { id: string; email: string; role: UserRole };
};

const password = 'Test1234';

async function createUser(
  userRepository: Repository<User>,
  input: Partial<User> &
    Pick<User, 'email' | 'firstName' | 'lastName' | 'role'>,
) {
  const user = userRepository.create({
    passwordHash: await hash(password),
    isVerified: true,
    ...input,
  });
  return userRepository.save(user);
}

describe('Days 1-7 business logic (e2e)', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let studentProfileRepository: Repository<StudentProfile>;
  let tutorProfileRepository: Repository<TutorProfile>;
  let subAdminProfileRepository: Repository<SubAdminProfile>;
  let lessonRepository: Repository<Lesson>;
  let jwtService: JwtService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(RedisService)
      .useClass(RedisServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(helmet());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    userRepository = app.get(getRepositoryToken(User));
    studentProfileRepository = app.get(getRepositoryToken(StudentProfile));
    tutorProfileRepository = app.get(getRepositoryToken(TutorProfile));
    subAdminProfileRepository = app.get(getRepositoryToken(SubAdminProfile));
    lessonRepository = app.get(getRepositoryToken(Lesson));
    jwtService = app.get(JwtService);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('invalidates the older student session after a second login', async () => {
    const email = `student-lock-${Date.now()}@test.com`;

    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email,
        password,
        firstName: 'Student',
        lastName: 'Lock',
        role: UserRole.STUDENT,
      })
      .expect(201);

    const tokenA = (registerResponse.body as AuthResponse).accessToken;

    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);

    const tokenB = (loginResponse.body as AuthResponse).accessToken;

    await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(401);

    await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
  });

  it('supports tutor application approval by an admin', async () => {
    const applicantEmail = `tutor-apply-${Date.now()}@test.com`;
    const adminEmail = `admin-approve-${Date.now()}@test.com`;

    const applicantResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: applicantEmail,
        password,
        firstName: 'Tutor',
        lastName: 'Applicant',
        role: UserRole.STUDENT,
      })
      .expect(201);

    const applicant = applicantResponse.body as AuthResponse;

    await request(app.getHttpServer())
      .post('/api/v1/tutors/apply')
      .set('Authorization', `Bearer ${applicant.accessToken}`)
      .send({
        bio: 'I am a professional tutor with enough teaching experience for this application.',
        specialization: 'English',
        languages: ['English', 'Arabic'],
        hourlyRate: 20,
        videoUrl: 'https://example.com/intro-video',
      })
      .expect(201);

    await createUser(userRepository, {
      email: adminEmail,
      firstName: 'Admin',
      lastName: 'Approver',
      role: UserRole.ADMIN,
    });

    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/admin/tutors/${applicant.user.id}/approve`)
      .set(
        'Authorization',
        `Bearer ${(adminLogin.body as AuthResponse).accessToken}`,
      )
      .expect(201);

    const approvedProfile = await tutorProfileRepository.findOneByOrFail({
      userId: applicant.user.id,
    });
    const approvedUser = await userRepository.findOneByOrFail({
      id: applicant.user.id,
    });

    expect(approvedProfile.status).toBe(CourseStatus.APPROVED);
    expect(approvedUser.role).toBe(UserRole.TUTOR);
  });

  it('refunds lesson price and soft-deletes account during account purge', async () => {
    const studentEmail = `purge-student-${Date.now()}@test.com`;
    const tutorEmail = `purge-tutor-${Date.now()}@test.com`;

    const studentResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: studentEmail,
        password,
        firstName: 'Purge',
        lastName: 'Student',
        role: UserRole.STUDENT,
      })
      .expect(201);

    const student = studentResponse.body as AuthResponse;

    const tutor = await createUser(userRepository, {
      email: tutorEmail,
      firstName: 'Purge',
      lastName: 'Tutor',
      role: UserRole.TUTOR,
    });

    await tutorProfileRepository.save(
      tutorProfileRepository.create({
        userId: tutor.id,
        bio: 'Approved tutor for account purge refund test.',
        specialization: 'Math',
        languages: ['English'],
        hourlyRate: 30,
        balance: 0,
        totalHoursTaught: 0,
        status: CourseStatus.APPROVED,
      }),
    );

    const studentProfile = await studentProfileRepository.findOneByOrFail({
      userId: student.user.id,
    });
    studentProfile.balance = 0;
    await studentProfileRepository.save(studentProfile);

    const scheduledTime = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const endTime = new Date(scheduledTime.getTime() + 50 * 60 * 1000);
    const lesson = await lessonRepository.save(
      lessonRepository.create({
        studentId: student.user.id,
        tutorId: tutor.id,
        scheduledTime,
        endTime,
        durationMinutes: 50,
        price: 75,
        status: LessonStatus.CONFIRMED,
      }),
    );

    const deleteResponse = await request(app.getHttpServer())
      .delete('/api/v1/users/me')
      .set('Authorization', `Bearer ${student.accessToken}`)
      .expect(200);

    expect((deleteResponse.body as { message: string }).message).toBe(
      'Account deleted successfully',
    );

    const cancelledLesson = await lessonRepository.findOneByOrFail({
      id: lesson.id,
    });
    const refundedProfile = await studentProfileRepository.findOneByOrFail({
      userId: student.user.id,
    });
    const deletedUser = await userRepository.findOne({
      where: { id: student.user.id },
      withDeleted: true,
    });

    expect(cancelledLesson.status).toBe(LessonStatus.CANCELLED);
    expect(refundedProfile.balance).toBe(75);
    expect(deletedUser?.deletedAt).toBeInstanceOf(Date);
  });

  it('rejects overlapping tutor availability slots', async () => {
    const email = `availability-${Date.now()}@test.com`;

    // Register as student first (register DTO only accepts 'student')
    const studentResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email,
        password,
        firstName: 'Available',
        lastName: 'Tutor',
        role: UserRole.STUDENT,
      })
      .expect(201);

    const student = studentResponse.body as AuthResponse;

    // Upgrade user to TUTOR role directly so availability guard passes
    await userRepository.update(student.user.id, { role: UserRole.TUTOR });

    // Log in again to get a fresh token with the updated role
    const tutorLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);

    const tutor = tutorLogin.body as AuthResponse;

    await request(app.getHttpServer())
      .post('/api/v1/tutor/availability')
      .set('Authorization', `Bearer ${tutor.accessToken}`)
      .send({
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '11:00',
        isRecurring: true,
      })
      .expect(201);

    const overlapResponse = await request(app.getHttpServer())
      .post('/api/v1/tutor/availability')
      .set('Authorization', `Bearer ${tutor.accessToken}`)
      .send({
        dayOfWeek: 1,
        startTime: '10:00',
        endTime: '12:00',
        isRecurring: true,
      })
      .expect(400);

    expect((overlapResponse.body as { message: string }).message).toBe(
      'Time slot overlaps with an existing availability',
    );
  });

  it('returns 403 when a subadmin lacks the required tutor-management permission', async () => {
    const subAdmin = await createUser(userRepository, {
      email: `subadmin-no-permission-${Date.now()}@test.com`,
      firstName: 'Limited',
      lastName: 'SubAdmin',
      role: UserRole.SUBADMIN,
    });

    await subAdminProfileRepository.save(
      subAdminProfileRepository.create({
        userId: subAdmin.id,
        assignedPermissions: [],
      }),
    );

    const token = jwtService.sign({
      sub: subAdmin.id,
      email: subAdmin.email,
      role: UserRole.SUBADMIN,
    });

    await request(app.getHttpServer())
      .get('/api/v1/admin/tutors')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });
});

describe('Day 11 — Reviews (e2e)', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let tutorProfileRepository: Repository<TutorProfile>;
  let lessonRepository: Repository<Lesson>;
  let reviewRepository: Repository<Review>;
  let jwtService: JwtService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(RedisService)
      .useClass(RedisServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(helmet());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    userRepository = app.get(getRepositoryToken(User));
    tutorProfileRepository = app.get(getRepositoryToken(TutorProfile));
    lessonRepository = app.get(getRepositoryToken(Lesson));
    reviewRepository = app.get(getRepositoryToken(Review));
    jwtService = app.get(JwtService);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('covers the full review lifecycle: create, read, approve, and role-gating', async () => {
    const studentEmail = `review-student-${Date.now()}@test.com`;
    const tutorEmail = `review-tutor-${Date.now()}@test.com`;
    const adminEmail = `review-admin-${Date.now()}@test.com`;

    // ── Register student ──
    const studentRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: studentEmail,
        password,
        firstName: 'Review',
        lastName: 'Student',
        role: UserRole.STUDENT,
      })
      .expect(201);

    const student = studentRes.body as AuthResponse;

    // ── Create tutor directly in DB ──
    const tutor = await createUser(userRepository, {
      email: tutorEmail,
      firstName: 'Review',
      lastName: 'Tutor',
      role: UserRole.TUTOR,
    });

    await tutorProfileRepository.save(
      tutorProfileRepository.create({
        userId: tutor.id,
        bio: 'Tutor for review e2e test.',
        specialization: 'English',
        languages: ['English'],
        hourlyRate: 25,
        balance: 0,
        totalHoursTaught: 0,
        status: CourseStatus.APPROVED,
      }),
    );

    // ── Create a COMPLETED lesson between them ──
    const scheduledTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const endTime = new Date(scheduledTime.getTime() + 50 * 60 * 1000);
    const lesson = await lessonRepository.save(
      lessonRepository.create({
        studentId: student.user.id,
        tutorId: tutor.id,
        scheduledTime,
        endTime,
        durationMinutes: 50,
        price: 40,
        status: LessonStatus.COMPLETED,
      }),
    );

    // ── Student creates a review ──
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/reviews')
      .set('Authorization', `Bearer ${student.accessToken}`)
      .send({
        lessonId: lesson.id,
        rating: 5,
        comment: 'Great lesson!',
      })
      .expect(201);

    const reviewId = (createRes.body as { id: string }).id;

    // ── Tutor tries to create a review → 403 (student-only) ──
    const tutorToken = jwtService.sign({
      sub: tutor.id,
      email: tutor.email,
      role: UserRole.TUTOR,
    });

    await request(app.getHttpServer())
      .post('/api/v1/reviews')
      .set('Authorization', `Bearer ${tutorToken}`)
      .send({
        lessonId: lesson.id,
        rating: 4,
        comment: 'Nope',
      })
      .expect(403);

    // ── Public endpoint returns the review (still pending) ──
    const publicRes = await request(app.getHttpServer())
      .get(`/api/v1/reviews/tutor/${tutor.id}`)
      .expect(200);

    expect(Array.isArray(publicRes.body)).toBe(true);
    // Pending reviews should NOT appear in public
    expect((publicRes.body as unknown[]).length).toBe(0);

    // ── Admin approves the review ──
    const admin = await createUser(userRepository, {
      email: adminEmail,
      firstName: 'Review',
      lastName: 'Admin',
      role: UserRole.ADMIN,
    });

    const adminToken = jwtService.sign({
      sub: admin.id,
      email: admin.email,
      role: UserRole.ADMIN,
    });

    await request(app.getHttpServer())
      .patch(`/api/v1/reviews/${reviewId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: CourseStatus.APPROVED })
      .expect(200);

    // Verify review is now approved in DB
    const approvedReview = await reviewRepository.findOneByOrFail({
      id: reviewId,
    });
    expect(approvedReview.status).toBe(CourseStatus.APPROVED);

    // ── Now the public endpoint returns the review ──
    const publicRes2 = await request(app.getHttpServer())
      .get(`/api/v1/reviews/tutor/${tutor.id}`)
      .expect(200);

    expect((publicRes2.body as unknown[]).length).toBe(1);

    // ── Student tries to access pending reviews → 403 ──
    await request(app.getHttpServer())
      .get('/api/v1/reviews/pending')
      .set('Authorization', `Bearer ${student.accessToken}`)
      .expect(403);

    // ── Admin can access pending reviews ──
    const pendingRes = await request(app.getHttpServer())
      .get('/api/v1/reviews/pending')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(Array.isArray(pendingRes.body)).toBe(true);

    // ── Student cannot review the same lesson twice (conflict) ──
    await request(app.getHttpServer())
      .post('/api/v1/reviews')
      .set('Authorization', `Bearer ${student.accessToken}`)
      .send({
        lessonId: lesson.id,
        rating: 3,
      })
      .expect(409);
  });
});
