import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  CourseLifecycleStatus,
  CourseStatus,
  UserRole,
} from '@mrh/types';
import { hash } from 'argon2';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { Course } from '../src/courses/entities/course.entity.js';
import { CourseLesson } from '../src/courses/entities/course-lesson.entity.js';
import { CourseSection } from '../src/courses/entities/course-section.entity.js';
import { EmailService } from '../src/integrations/email/email.service.js';
import { RedisService } from '../src/redis/redis.service.js';
import { StudentProfile } from '../src/students/entities/student-profile.entity.js';
import { TutorProfile } from '../src/tutors/entities/tutor-profile.entity.js';
import { User } from '../src/users/entities/user.entity.js';
import { EmailServiceMock } from './email.mock.js';
import { authenticateUser } from './isolated-fixtures.js';
import { RedisServiceMock } from './redis.mock.js';

const password = 'Approval-workflow-2026!';

jest.setTimeout(180000);

describe('Tutor course approval workflow (e2e)', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let tutorProfileRepository: Repository<TutorProfile>;
  let studentProfileRepository: Repository<StudentProfile>;
  let courseRepository: Repository<Course>;
  let sectionRepository: Repository<CourseSection>;
  let lessonRepository: Repository<CourseLesson>;

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
    tutorProfileRepository = app.get(getRepositoryToken(TutorProfile));
    studentProfileRepository = app.get(getRepositoryToken(StudentProfile));
    courseRepository = app.get(getRepositoryToken(Course));
    sectionRepository = app.get(getRepositoryToken(CourseSection));
    lessonRepository = app.get(getRepositoryToken(CourseLesson));
  });

  afterAll(async () => {
    await app?.close();
  });

  async function createUser(
    role: UserRole,
    label: string,
  ): Promise<User> {
    return userRepository.save(
      userRepository.create({
        email: `approval-${label}-${randomUUID()}@mrh-academy.example`,
        passwordHash: await hash(password),
        firstName: label,
        lastName: 'Workflow',
        role,
        isVerified: true,
        isActive: true,
      }),
    );
  }

  async function createCompleteDraft(
    tutorId: string,
    title: string,
    courseType: 'recorded' | 'live',
  ) {
    const now = Date.now();
    const course = await courseRepository.save(
      courseRepository.create({
        tutorId,
        title,
        subtitle: 'A complete professional submission for academy review',
        description:
          'This complete tutor submission contains a clear learning plan, practical outcomes, detailed audience guidance, and enough information for an administrator to make a responsible publishing decision.',
        category: 'Languages',
        courseType,
        learningOutcomes: ['Communicate confidently in practical situations'],
        requirements: ['A stable internet connection'],
        targetAudience: ['Motivated beginner learners'],
        language: 'Arabic',
        level: 'beginner',
        timezone: 'Africa/Cairo',
        capacity: courseType === 'live' ? 10 : null,
        cohortStartAt:
          courseType === 'live' ? new Date(now + 7 * 86_400_000) : null,
        cohortEndAt:
          courseType === 'live' ? new Date(now + 21 * 86_400_000) : null,
        thumbnailUrl: 'https://cdn.example/approval-cover.jpg',
        previewVideoUrl: 'https://video.example/approval-preview',
        price: 10,
        soldBy: 'academy',
        status: CourseLifecycleStatus.DRAFT,
        isDraft: true,
        submittedAt: null,
      }),
    );
    const section = await sectionRepository.save(
      sectionRepository.create({
        courseId: course.id,
        title: 'Program details',
        description: 'The submitted curriculum or live program details.',
        sectionOrder: 1,
      }),
    );
    if (courseType === 'recorded') {
      await lessonRepository.save(
        lessonRepository.create({
          courseId: course.id,
          sectionId: section.id,
          title: 'Preview lesson',
          description: 'A complete lesson submitted for review.',
          contentType: 'video',
          videoUrl: 'https://video.example/lesson-preview',
          videoAssetId: null,
          downloadableFiles: [],
          externalLinks: [],
          isPreview: true,
          durationMinutes: 20,
          lessonOrder: 1,
        }),
      );
    }
    return course;
  }

  it('enforces submission, review, visibility, purchase, audit transitions, and notifications', async () => {
    const tutor = await createUser(UserRole.TUTOR, 'Tutor');
    await tutorProfileRepository.save(
      tutorProfileRepository.create({
        userId: tutor.id,
        bio: 'Approved tutor profile for course approval testing.',
        specialization: 'Languages',
        languages: ['Arabic', 'English'],
        hourlyRate: 20,
        balance: 0,
        totalHoursTaught: 0,
        status: CourseStatus.APPROVED,
      }),
    );
    const admin = await createUser(UserRole.ADMIN, 'Admin');
    const student = await createUser(UserRole.STUDENT, 'Student');
    await studentProfileRepository.save(
      studentProfileRepository.create({
        userId: student.id,
        balance: 100,
        heldBalance: 0,
      }),
    );

    const tutorSession = await authenticateUser(
      app,
      userRepository,
      tutor.email,
      password,
    );
    const adminSession = await authenticateUser(
      app,
      userRepository,
      admin.email,
      password,
    );
    const studentSession = await authenticateUser(
      app,
      userRepository,
      student.email,
      password,
    );

    const recorded = await createCompleteDraft(
      tutor.id,
      'Recorded Arabic Approval Course',
      'recorded',
    );
    const live = await createCompleteDraft(
      tutor.id,
      'Live Arabic Approval Cohort',
      'live',
    );
    const rejected = await createCompleteDraft(
      tutor.id,
      'Recorded Course Requiring Changes',
      'recorded',
    );

    for (const course of [recorded, live, rejected]) {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/courses/${course.id}/submit`)
        .set('Authorization', `Bearer ${tutorSession.accessToken}`)
        .expect(201);
      expect(response.body.status).toBe(
        CourseLifecycleStatus.PENDING_REVIEW,
      );
    }

    const pendingPublic = await request(app.getHttpServer())
      .get('/api/v1/courses')
      .expect(200);
    expect(
      pendingPublic.body.some(
        (course: { id: string }) => course.id === recorded.id,
      ),
    ).toBe(false);
    await request(app.getHttpServer())
      .get(`/api/v1/courses/${recorded.id}`)
      .expect(404);
    await request(app.getHttpServer())
      .post(`/api/v1/courses/${recorded.id}/enroll`)
      .set('Authorization', `Bearer ${studentSession.accessToken}`)
      .send({ idempotencyKey: randomUUID() })
      .expect(404);

    await request(app.getHttpServer())
      .post(`/api/v1/admin/courses/${recorded.id}/approve`)
      .set('Authorization', `Bearer ${studentSession.accessToken}`)
      .send({})
      .expect(403);

    const queue = await request(app.getHttpServer())
      .get(
        `/api/v1/admin/courses?status=${CourseLifecycleStatus.PENDING_REVIEW}`,
      )
      .set('Authorization', `Bearer ${adminSession.accessToken}`)
      .expect(200);
    expect(
      queue.body.some(
        (item: { id: string; itemType: string }) =>
          item.id === recorded.id && item.itemType === 'recorded',
      ),
    ).toBe(true);
    expect(
      queue.body.some(
        (item: { id: string; itemType: string }) =>
          item.id === live.id && item.itemType === 'live',
      ),
    ).toBe(true);

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/admin/courses/${recorded.id}/review`)
      .set('Authorization', `Bearer ${adminSession.accessToken}`)
      .expect(200);
    expect(detail.body).toEqual(
      expect.objectContaining({
        id: recorded.id,
        courseType: 'recorded',
        tutor: expect.objectContaining({ id: tutor.id }),
        sections: expect.any(Array),
        lessons: expect.any(Array),
        overviewPlayback: expect.objectContaining({ status: 'ready' }),
      }),
    );

    for (const course of [recorded, live]) {
      const approved = await request(app.getHttpServer())
        .post(`/api/v1/admin/courses/${course.id}/approve`)
        .set('Authorization', `Bearer ${adminSession.accessToken}`)
        .send({
          note: 'Complete and ready for students',
          videoQualityApproved: true,
        })
        .expect(201);
      expect(approved.body.status).toBe(CourseLifecycleStatus.ACTIVE);
      expect(approved.body.reviewedBy).toBe(admin.id);
      expect(approved.body.reviewDecision).toBe('approved');
    }

    await request(app.getHttpServer())
      .post(`/api/v1/admin/courses/${recorded.id}/approve`)
      .set('Authorization', `Bearer ${adminSession.accessToken}`)
      .send({})
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/v1/admin/courses/${rejected.id}/reject`)
      .set('Authorization', `Bearer ${adminSession.accessToken}`)
      .send({})
      .expect(400);
    const rejection = await request(app.getHttpServer())
      .post(`/api/v1/admin/courses/${rejected.id}/reject`)
      .set('Authorization', `Bearer ${adminSession.accessToken}`)
      .send({ reason: 'Clarify the outcomes and add another example.' })
      .expect(201);
    expect(rejection.body).toEqual(
      expect.objectContaining({
        status: CourseLifecycleStatus.REJECTED,
        reviewDecision: 'rejected',
        reviewNote: 'Clarify the outcomes and add another example.',
      }),
    );

    const publicCourses = await request(app.getHttpServer())
      .get('/api/v1/courses')
      .expect(200);
    expect(
      publicCourses.body.some(
        (course: { id: string }) => course.id === recorded.id,
      ),
    ).toBe(true);
    expect(
      publicCourses.body.some(
        (course: { id: string }) => course.id === live.id,
      ),
    ).toBe(true);
    expect(
      publicCourses.body.some(
        (course: { id: string }) => course.id === rejected.id,
      ),
    ).toBe(false);

    for (const course of [recorded, live]) {
      await request(app.getHttpServer())
        .post(`/api/v1/courses/${course.id}/enroll`)
        .set('Authorization', `Bearer ${studentSession.accessToken}`)
        .send({ idempotencyKey: randomUUID() })
        .expect(201);
    }
    await request(app.getHttpServer())
      .post(`/api/v1/courses/${rejected.id}/enroll`)
      .set('Authorization', `Bearer ${studentSession.accessToken}`)
      .send({ idempotencyKey: randomUUID() })
      .expect(404);

    const tutorCourses = await request(app.getHttpServer())
      .get('/api/v1/courses/my/courses')
      .set('Authorization', `Bearer ${tutorSession.accessToken}`)
      .expect(200);
    expect(
      tutorCourses.body.find(
        (course: { id: string }) => course.id === rejected.id,
      ),
    ).toEqual(
      expect.objectContaining({
        status: CourseLifecycleStatus.REJECTED,
        reviewNote: 'Clarify the outcomes and add another example.',
      }),
    );

    const notifications = await request(app.getHttpServer())
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${tutorSession.accessToken}`)
      .expect(200);
    const notificationTypes = notifications.body.map(
      (item: { type: string }) => item.type,
    );
    expect(notificationTypes).toEqual(
      expect.arrayContaining([
        'course_submission_received',
        'course_submission_approved',
        'course_submission_rejected',
      ]),
    );

    const revised = await request(app.getHttpServer())
      .post(`/api/v1/courses/${rejected.id}/revise`)
      .set('Authorization', `Bearer ${tutorSession.accessToken}`)
      .expect(201);
    expect(revised.body).toEqual(
      expect.objectContaining({
        status: CourseLifecycleStatus.DRAFT,
        isDraft: true,
      }),
    );
    await request(app.getHttpServer())
      .post(`/api/v1/courses/${rejected.id}/submit`)
      .set('Authorization', `Bearer ${tutorSession.accessToken}`)
      .expect(201);
  });
});
