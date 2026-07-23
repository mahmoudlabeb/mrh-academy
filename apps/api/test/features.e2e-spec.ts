import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserRole, CourseStatus, LessonStatus } from '@mrh/types';
import { hash } from 'argon2';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { User } from '../src/users/entities/user.entity.js';
import { StudentProfile } from '../src/students/entities/student-profile.entity.js';
import { Course } from '../src/courses/entities/course.entity.js';
import { CourseEnrollment } from '../src/courses/entities/course-enrollment.entity.js';
import { CourseLesson } from '../src/courses/entities/course-lesson.entity.js';
import { VocabularyWord } from '../src/vocabulary/entities/vocabulary-word.entity.js';
import { Lesson } from '../src/lessons/entities/lesson.entity.js';
import { RedisService } from '../src/redis/redis.service.js';
import { RedisServiceMock } from './redis.mock.js';
import {
  accessTokenFromResponse,
  authenticateUser,
} from './isolated-fixtures.js';
import { EmailService } from '../src/integrations/email/email.service.js';
import { EmailServiceMock } from './email.mock.js';
import { TutorProfile } from '../src/tutors/entities/tutor-profile.entity.js';

type AuthResponse = {
  accessToken: string;
  user: { id: string; email: string; role: UserRole };
};

const password = 'Test-password-2026!';

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

jest.setTimeout(120000);

// ────────────────────────────────────────────────────────────
// Messages Module
// ────────────────────────────────────────────────────────────
describe('Messages (e2e)', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let lessonRepository: Repository<Lesson>;
  let studentProfileRepository: Repository<StudentProfile>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(RedisService)
      .useClass(RedisServiceMock)
      .overrideProvider(EmailService)
      .useClass(EmailServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
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
    lessonRepository = app.get(getRepositoryToken(Lesson));
    studentProfileRepository = app.get(getRepositoryToken(StudentProfile));
  });

  afterAll(async () => {
    await app?.close();
  });

  it('sends a message between two users and retrieves contacts + conversation', async () => {
    const senderEmail = `msg-sender-${Date.now()}@test.com`;
    const receiverEmail = `msg-receiver-${Date.now()}@test.com`;

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: senderEmail,
        password,
        firstName: 'Sender',
        lastName: 'User',
        role: UserRole.STUDENT,
      })
      .expect(201);

    const sender = await authenticateUser(
      app,
      userRepository,
      senderEmail,
      password,
    );

    const receiver = await createUser(userRepository, {
      email: receiverEmail,
      firstName: 'Receiver',
      lastName: 'User',
      role: UserRole.TUTOR,
    });

    await studentProfileRepository.update(
      { userId: sender.user.id },
      { balance: 100 },
    );

    const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await lessonRepository.save(
      lessonRepository.create({
        studentId: sender.user.id,
        tutorId: receiver.id,
        scheduledTime: past,
        endTime: new Date(past.getTime() + 50 * 60 * 1000),
        durationMinutes: 50,
        price: 50,
        status: LessonStatus.COMPLETED,
      }),
    );

    const receiverSession = await authenticateUser(
      app,
      userRepository,
      receiverEmail,
      password,
    );

    await request(app.getHttpServer())
      .post('/api/v1/messages')
      .set('Authorization', `Bearer ${sender.accessToken}`)
      .send({ receiverId: receiver.id, content: 'Hello from sender!' })
      .expect(201);

    const contactsRes = await request(app.getHttpServer())
      .get('/api/v1/messages/contacts')
      .set('Authorization', `Bearer ${receiverSession.accessToken}`)
      .expect(200);

    expect(Array.isArray(contactsRes.body)).toBe(true);
    expect(
      contactsRes.body.some((c: any) => c.user?.id === sender.user.id),
    ).toBe(true);

    const convRes = await request(app.getHttpServer())
      .get(`/api/v1/messages/${sender.user.id}`)
      .set('Authorization', `Bearer ${receiverSession.accessToken}`)
      .expect(200);

    expect(Array.isArray(convRes.body.messages)).toBe(true);
    expect(convRes.body.messages.length).toBeGreaterThanOrEqual(1);
    expect(convRes.body.messages[0].content).toBe('Hello from sender!');

    const unreadRes = await request(app.getHttpServer())
      .get('/api/v1/messages/unread-count')
      .set('Authorization', `Bearer ${receiverSession.accessToken}`)
      .expect(200);

    expect(typeof unreadRes.body.count).toBe('number');
  });
});

// ────────────────────────────────────────────────────────────
// Courses Module
// ────────────────────────────────────────────────────────────
describe('Courses (e2e)', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let studentProfileRepository: Repository<StudentProfile>;
  let courseRepository: Repository<Course>;
  let courseEnrollmentRepository: Repository<CourseEnrollment>;
  let courseLessonRepository: Repository<CourseLesson>;
  let tutorProfileRepository: Repository<TutorProfile>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(RedisService)
      .useClass(RedisServiceMock)
      .overrideProvider(EmailService)
      .useClass(EmailServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
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
    courseRepository = app.get(getRepositoryToken(Course));
    courseEnrollmentRepository = app.get(getRepositoryToken(CourseEnrollment));
    courseLessonRepository = app.get(getRepositoryToken(CourseLesson));
    tutorProfileRepository = app.get(getRepositoryToken(TutorProfile));
  });

  afterAll(async () => {
    await app?.close();
  });

  it('creates a course as tutor, approves as admin, enrolls as student, and completes a lesson', async () => {
    const tutorEmail = `course-tutor-${Date.now()}@test.com`;
    const adminEmail = `course-admin-${Date.now()}@test.com`;
    const studentEmail = `course-student-${Date.now()}@test.com`;

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: tutorEmail,
        password,
        firstName: 'Course',
        lastName: 'Tutor',
        role: UserRole.STUDENT,
      })
      .expect(201);

    await userRepository.update(
      { email: tutorEmail },
      { role: UserRole.TUTOR },
    );
    const tutorUser = await userRepository.findOneByOrFail({
      email: tutorEmail,
    });
    await tutorProfileRepository.save(
      tutorProfileRepository.create({
        userId: tutorUser.id,
        bio: '',
        specialization: '',
        languages: [],
        hourlyRate: 0,
        balance: 0,
        totalHoursTaught: 0,
        status: CourseStatus.APPROVED,
      }),
    );
    const tutorSession = await authenticateUser(
      app,
      userRepository,
      tutorEmail,
      password,
    );

    const createRes = await request(app.getHttpServer())
      .post('/api/v1/courses')
      .set('Authorization', `Bearer ${tutorSession.accessToken}`)
      .send({
        title: 'Test Course',
        description: 'A test course for e2e',
        price: 49.99,
      })
      .expect(201);

    const courseId = (createRes.body as { id: string }).id;

    const course = await courseRepository.findOneByOrFail({ id: courseId });
    expect(course.status).toBe(CourseStatus.PENDING);

    const admin = await createUser(userRepository, {
      email: adminEmail,
      firstName: 'Course',
      lastName: 'Admin',
      role: UserRole.ADMIN,
    });

    const adminSession = await authenticateUser(
      app,
      userRepository,
      admin.email,
      password,
    );

    await request(app.getHttpServer())
      .post(`/api/v1/admin/courses/${courseId}/approve`)
      .send({ videoQualityApproved: true })
      .set('Authorization', `Bearer ${adminSession.accessToken}`)
      .expect(201);

    const approvedCourse = await courseRepository.findOneByOrFail({
      id: courseId,
    });
    expect(approvedCourse.status).toBe(CourseStatus.APPROVED);

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: studentEmail,
        password,
        firstName: 'Course',
        lastName: 'Student',
        role: UserRole.STUDENT,
      })
      .expect(201);

    const student = await authenticateUser(
      app,
      userRepository,
      studentEmail,
      password,
    );

    await studentProfileRepository.update(
      { userId: student.user.id },
      { balance: 100 },
    );

    await request(app.getHttpServer())
      .post(`/api/v1/courses/${courseId}/enroll`)
      .set('Authorization', `Bearer ${student.accessToken}`)
      .expect(201);

    const enrollment = await courseEnrollmentRepository.findOneByOrFail({
      studentId: student.user.id,
      courseId,
    });
    expect(enrollment.soldBy).toBe('academy');

    const lesson = await courseLessonRepository.save(
      courseLessonRepository.create({
        courseId,
        title: 'Lesson 1',
        videoAssetId: 'test-video-id',
        durationMinutes: 30,
        lessonOrder: 1,
      }),
    );

    await request(app.getHttpServer())
      .post(`/api/v1/courses/${courseId}/lessons/${lesson.id}/complete`)
      .set('Authorization', `Bearer ${student.accessToken}`)
      .expect(201);

    const publicCourses = await request(app.getHttpServer())
      .get('/api/v1/courses')
      .expect(200);

    expect(Array.isArray(publicCourses.body)).toBe(true);
    expect(publicCourses.body.some((c: any) => c.id === courseId)).toBe(true);

    const enrollmentsRes = await request(app.getHttpServer())
      .get('/api/v1/courses/my/enrollments')
      .set('Authorization', `Bearer ${student.accessToken}`)
      .expect(200);

    expect(Array.isArray(enrollmentsRes.body)).toBe(true);
    expect(enrollmentsRes.body.some((e: any) => e.courseId === courseId)).toBe(
      true,
    );

    const myCoursesRes = await request(app.getHttpServer())
      .get('/api/v1/courses/my/courses')
      .set('Authorization', `Bearer ${tutorSession.accessToken}`)
      .expect(200);

    expect(Array.isArray(myCoursesRes.body)).toBe(true);
    expect(myCoursesRes.body.some((c: any) => c.id === courseId)).toBe(true);

    await request(app.getHttpServer())
      .get(`/api/v1/courses/${courseId}/stream-token`)
      .set('Authorization', `Bearer ${tutorSession.accessToken}`)
      .expect(404);
  });
});

// ────────────────────────────────────────────────────────────
// Vocabulary Module
// ────────────────────────────────────────────────────────────
describe('Vocabulary (e2e)', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let vocabularyRepository: Repository<VocabularyWord>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(RedisService)
      .useClass(RedisServiceMock)
      .overrideProvider(EmailService)
      .useClass(EmailServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
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
    vocabularyRepository = app.get(getRepositoryToken(VocabularyWord));
  });

  afterAll(async () => {
    await app?.close();
  });

  it('saves, lists, and deletes a vocabulary word', async () => {
    const email = `vocab-${Date.now()}@test.com`;

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email,
        password,
        firstName: 'Vocab',
        lastName: 'Student',
        role: UserRole.STUDENT,
      })
      .expect(201);

    const user = await authenticateUser(app, userRepository, email, password);

    const saveRes = await request(app.getHttpServer())
      .post('/api/v1/vocabulary/save')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({
        word: 'ephemeral',
        definition: 'lasting for a very short time',
        language: 'en',
      })
      .expect(201);

    const wordId = (saveRes.body as { id: string }).id;

    const savedWord = await vocabularyRepository.findOneByOrFail({
      id: wordId,
    });
    expect(savedWord.word).toBe('ephemeral');

    const listRes = await request(app.getHttpServer())
      .get('/api/v1/vocabulary')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(200);

    expect(Array.isArray(listRes.body)).toBe(true);
    expect(listRes.body.some((w: any) => w.word === 'ephemeral')).toBe(true);

    await request(app.getHttpServer())
      .delete(`/api/v1/vocabulary/${wordId}`)
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(200);

    const deleted = await vocabularyRepository.findOne({
      where: { id: wordId },
    });
    expect(deleted).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────
// Admin Impersonation
// ────────────────────────────────────────────────────────────
describe('Admin Impersonation (e2e)', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let redisService: RedisService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(RedisService)
      .useClass(RedisServiceMock)
      .overrideProvider(EmailService)
      .useClass(EmailServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
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
    redisService = app.get(RedisService);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('allows admin to impersonate a student and switch back', async () => {
    const adminEmail = `impersonate-admin-${Date.now()}@test.com`;
    const studentEmail = `impersonate-student-${Date.now()}@test.com`;

    const admin = await createUser(userRepository, {
      email: adminEmail,
      firstName: 'Impersonate',
      lastName: 'Admin',
      role: UserRole.ADMIN,
    });

    const student = await createUser(userRepository, {
      email: studentEmail,
      firstName: 'Impersonate',
      lastName: 'Student',
      role: UserRole.STUDENT,
    });

    const adminSession = await authenticateUser(
      app,
      userRepository,
      admin.email,
      password,
    );

    const impersonateRes = await request(app.getHttpServer())
      .post('/api/v1/admin/impersonate')
      .set('Authorization', `Bearer ${adminSession.accessToken}`)
      .send({ userId: student.id })
      .expect(201);

    const impersonatedToken = accessTokenFromResponse(impersonateRes);

    (redisService as any).set(
      `user_session:${student.id}`,
      'impersonated-session',
    );

    const meRes = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${impersonatedToken}`)
      .expect(200);

    expect((meRes.body as any).id).toBe(student.id);
    expect((meRes.body as any).role).toBe(UserRole.STUDENT);

    const unimpersonateRes = await request(app.getHttpServer())
      .post('/api/v1/admin/impersonate/unimpersonate')
      .set('Authorization', `Bearer ${impersonatedToken}`)
      .expect(201);

    const restoredToken = accessTokenFromResponse(unimpersonateRes);

    const meRestored = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${restoredToken}`)
      .expect(200);

    expect((meRestored.body as any).id).toBe(admin.id);
    expect((meRestored.body as any).role).toBe(UserRole.ADMIN);
  });
});

// ────────────────────────────────────────────────────────────
// SubAdmin Invite & Accept
// ────────────────────────────────────────────────────────────
describe('SubAdmin Invite (e2e)', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(RedisService)
      .useClass(RedisServiceMock)
      .overrideProvider(EmailService)
      .useClass(EmailServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
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
  });

  afterAll(async () => {
    await app?.close();
  });

  it('invites a subadmin, accepts the invite, and verifies the flow', async () => {
    const adminEmail = `subadmin-invite-admin-${Date.now()}@test.com`;
    const subEmail = `subadmin-invitee-${Date.now()}@test.com`;

    const admin = await createUser(userRepository, {
      email: adminEmail,
      firstName: 'SubAdmin',
      lastName: 'Admin',
      role: UserRole.ADMIN,
    });

    const adminSession = await authenticateUser(
      app,
      userRepository,
      admin.email,
      password,
    );

    await request(app.getHttpServer())
      .post('/api/v1/admin/subadmins/invite')
      .set('Authorization', `Bearer ${adminSession.accessToken}`)
      .send({
        email: subEmail,
        firstName: 'Invited',
        lastName: 'SubAdmin',
      })
      .expect(201);

    const invitedUser = await userRepository.findOne({
      where: { email: subEmail },
      select: [
        'id',
        'email',
        'inviteToken',
        'inviteTokenExpires',
        'isActive',
        'passwordHash',
      ],
    });

    expect(invitedUser).not.toBeNull();
    expect(invitedUser!.inviteToken).not.toBeNull();
    expect(invitedUser!.isActive).toBe(false);
    expect(invitedUser!.inviteTokenExpires).toBeInstanceOf(Date);

    const acceptRes = await request(app.getHttpServer())
      .post('/api/v1/admin/subadmins/accept-invite')
      .send({
        token: invitedUser!.inviteToken!,
        password: 'New-test-password-2026!',
      })
      .expect(201);

    const authData = acceptRes.body as AuthResponse;
    expect(authData.user.role).toBe(UserRole.SUBADMIN);
    expect(authData.user.email).toBe(subEmail);

    const updatedUser = await userRepository.findOneByOrFail({
      id: invitedUser!.id,
    });
    expect(updatedUser.isActive).toBe(true);

    const listRes = await request(app.getHttpServer())
      .get('/api/v1/admin/subadmins')
      .set('Authorization', `Bearer ${adminSession.accessToken}`)
      .expect(200);

    expect(Array.isArray(listRes.body)).toBe(true);
    expect(listRes.body.some((s: any) => s.email === subEmail)).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────
// Admin Stats & Reports
// ────────────────────────────────────────────────────────────
describe('Admin Stats & Reports (e2e)', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(RedisService)
      .useClass(RedisServiceMock)
      .overrideProvider(EmailService)
      .useClass(EmailServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
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
  });

  afterAll(async () => {
    await app?.close();
  });

  it('returns admin stats and recent activity', async () => {
    const adminEmail = `stats-admin-${Date.now()}@test.com`;

    const admin = await createUser(userRepository, {
      email: adminEmail,
      firstName: 'Stats',
      lastName: 'Admin',
      role: UserRole.ADMIN,
    });

    const adminSession = await authenticateUser(
      app,
      userRepository,
      admin.email,
      password,
    );

    const statsRes = await request(app.getHttpServer())
      .get('/api/v1/admin/stats')
      .set('Authorization', `Bearer ${adminSession.accessToken}`)
      .expect(200);

    expect(statsRes.body).toHaveProperty('totalStudents');
    expect(statsRes.body).toHaveProperty('totalTutors');
    expect(statsRes.body).toHaveProperty('completedLessons');

    const dashboardRes = await request(app.getHttpServer())
      .get('/api/v1/admin/stats/dashboard')
      .set('Authorization', `Bearer ${adminSession.accessToken}`)
      .expect(200);

    expect(dashboardRes.body).toHaveProperty('totalStudents');
    expect(dashboardRes.body).toHaveProperty('totalTutors');

    const activityRes = await request(app.getHttpServer())
      .get('/api/v1/admin/activity/recent')
      .set('Authorization', `Bearer ${adminSession.accessToken}`)
      .expect(200);

    expect(Array.isArray(activityRes.body)).toBe(true);

    await request(app.getHttpServer())
      .get('/api/v1/admin/stats')
      .set('Authorization', `Bearer `)
      .expect(401);
  });
});
