import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { UserRole, LessonStatus, CourseStatus } from '@mrh/types';
import { Lesson } from '../entities/lesson.entity.js';
import { TutorProfile } from '../entities/tutor-profile.entity.js';
import { StudentProfile } from '../entities/student-profile.entity.js';
import { Classroom } from '../entities/classroom.entity.js';
import { User } from '../entities/user.entity.js';
import { TutorAvailability } from '../entities/tutor-availability.entity.js';
import { LessonsService } from './lessons.service.js';
import { CommissionService } from '../services/commission.service.js';
import { CalendarService } from '../services/calendar.service.js';
import { EmailService } from '../services/email.service.js';
import { RedisService } from '../redis/redis.service.js';
import { BookLessonDto } from './dto/book-lesson.dto.js';
import { CompleteLessonDto } from './dto/complete-lesson.dto.js';

function futureScheduledTimeIso(daysAhead = 1, hourUtc = 10): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysAhead);
  date.setUTCHours(hourUtc, 0, 0, 0);
  return date.toISOString();
}

function pastScheduledTimeIso(): string {
  return new Date(Date.now() - 3600000).toISOString();
}

describe('LessonsService', () => {
  let service: LessonsService;

  let transactionManager: {
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    increment: jest.Mock;
    decrement: jest.Mock;
    createQueryBuilder: jest.Mock;
  };

  const lessonRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };

  const tutorProfileRepository = {
    findOne: jest.fn(),
    increment: jest.fn(),
  };

  const studentProfileRepository = {
    findOne: jest.fn(),
    increment: jest.fn(),
    decrement: jest.fn(),
  };

  const classroomRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };

  const userRepository = {
    findOne: jest.fn(),
  };

  const availabilityRepository = {
    find: jest.fn(),
  };

  const dataSource = {
    transaction: jest.fn(),
  };

  const commissionService = {
    calculateLessonEarnings: jest.fn(() => ({
      platformFee: 30,
      tutorShare: 70,
    })),
    calculateLessonFee: jest.fn(() => 0.3),
  };

  const calendarService = {
    createLessonMeetLink: jest.fn().mockResolvedValue({
      meetUrl: 'https://meet.google.com/test',
      calendarEventId: 'event-1',
    }),
    deleteCalendarEvent: jest.fn().mockResolvedValue(undefined),
    generateIcs: jest.fn().mockReturnValue('BEGIN:VCALENDAR'),
  };

  const emailService = {
    sendEmail: jest.fn().mockResolvedValue(undefined),
  };

  const redisService = {
    del: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  };

  const createTransactionManager = () => {
    const manager = {
      findOne: jest.fn(async (entity) => {
        if (entity === TutorProfile) {
          return {
            userId: 'tutor-1',
            hourlyRate: 50,
            status: CourseStatus.APPROVED,
          };
        }
        if (entity === StudentProfile) {
          return { userId: 'student-1', balance: 100 };
        }
        if (entity === Lesson) {
          return {
            id: 'lesson-1',
            status: LessonStatus.CONFIRMED,
            studentId: 'student-1',
            tutorId: 'tutor-1',
            price: 50,
          };
        }
        return null;
      }),
      save: jest.fn(async (...args) => (args.length > 1 ? args[1] : args[0])),
      create: jest.fn((_entity, data) => data),
      update: jest.fn(),
      increment: jest.fn(),
      decrement: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      })),
    };
    return manager;
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    transactionManager = createTransactionManager();
    dataSource.transaction.mockImplementation(async (cb) =>
      cb(transactionManager),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LessonsService,
        { provide: getRepositoryToken(Lesson), useValue: lessonRepository },
        {
          provide: getRepositoryToken(TutorProfile),
          useValue: tutorProfileRepository,
        },
        {
          provide: getRepositoryToken(StudentProfile),
          useValue: studentProfileRepository,
        },
        {
          provide: getRepositoryToken(Classroom),
          useValue: classroomRepository,
        },
        { provide: getRepositoryToken(User), useValue: userRepository },
        {
          provide: getRepositoryToken(TutorAvailability),
          useValue: availabilityRepository,
        },
        { provide: getDataSourceToken(), useValue: dataSource },
        { provide: CommissionService, useValue: commissionService },
        { provide: CalendarService, useValue: calendarService },
        { provide: EmailService, useValue: emailService },
        { provide: RedisService, useValue: redisService },
      ],
    }).compile();

    service = module.get<LessonsService>(LessonsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('bookLesson', () => {
    const studentId = 'student-1';
    const scheduledTime = futureScheduledTimeIso();
    const dto: BookLessonDto = {
      tutorId: 'tutor-1',
      scheduledTime,
      durationMinutes: 50,
    };

    beforeEach(() => {
      tutorProfileRepository.findOne.mockResolvedValue({
        userId: 'tutor-1',
        hourlyRate: 50,
        status: CourseStatus.APPROVED,
      });
      availabilityRepository.find.mockResolvedValue([
        {
          tutorId: 'tutor-1',
          dayOfWeek: new Date(scheduledTime).getUTCDay(),
          startTime: '09:00',
          endTime: '17:00',
        },
      ]);
      userRepository.findOne.mockResolvedValue({
        id: 'tutor-1',
        email: 'tutor@test.com',
      });
    });

    it('creates lesson with PENDING status and inactive classroom', async () => {
      const savedLesson = {
        id: 'lesson-1',
        tutorId: 'tutor-1',
        studentId,
        status: LessonStatus.PENDING,
        price: 41.67,
        durationMinutes: 50,
      };
      transactionManager.save.mockImplementation(async (entity, data) => {
        if (entity === Lesson) return { ...data, id: 'lesson-1' };
        return data;
      });
      lessonRepository.findOne.mockResolvedValue(savedLesson);

      const result = await service.bookLesson(studentId, dto);

      expect(result?.status).toBe(LessonStatus.PENDING);
      expect(transactionManager.create).toHaveBeenCalledWith(
        Classroom,
        expect.objectContaining({ isActive: false }),
      );
      expect(transactionManager.decrement).not.toHaveBeenCalled();
    });

    it('throws if tutor not found', async () => {
      tutorProfileRepository.findOne.mockResolvedValueOnce(null);
      await expect(service.bookLesson(studentId, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws if tutor not approved', async () => {
      tutorProfileRepository.findOne.mockResolvedValueOnce({
        status: CourseStatus.PENDING,
      });
      await expect(service.bookLesson(studentId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws if scheduled time is in the past', async () => {
      const pastDto = {
        ...dto,
        scheduledTime: new Date(Date.now() - 86400000).toISOString(),
      };
      await expect(service.bookLesson(studentId, pastDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws if tutor has no availability on the selected day', async () => {
      availabilityRepository.find.mockResolvedValueOnce([]);
      await expect(service.bookLesson(studentId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('does not deduct balance at booking time', async () => {
      const savedLesson = {
        id: 'lesson-1',
        tutorId: 'tutor-1',
        studentId,
        status: LessonStatus.PENDING,
        price: 41.67,
      };
      transactionManager.save.mockImplementation(async (entity, data) => {
        if (entity === Lesson) return { ...data, id: 'lesson-1' };
        return data;
      });
      lessonRepository.findOne.mockResolvedValue(savedLesson);

      await service.bookLesson(studentId, dto);

      expect(transactionManager.decrement).not.toHaveBeenCalled();
      expect(studentProfileRepository.decrement).not.toHaveBeenCalled();
    });

    it('sends email to tutor and student', async () => {
      const savedLesson = {
        id: 'lesson-1',
        tutorId: 'tutor-1',
        studentId,
        status: LessonStatus.PENDING,
        price: 41.67,
        tutor: { firstName: 'Tutor', lastName: 'One' },
        student: { firstName: 'Student', lastName: 'One' },
      };
      transactionManager.save.mockImplementation(async (entity, data) => {
        if (entity === Lesson) return { ...data, id: 'lesson-1' };
        return data;
      });
      lessonRepository.findOne.mockResolvedValue(savedLesson);
      userRepository.findOne
        .mockResolvedValueOnce({ id: 'tutor-1', email: 'tutor@test.com' })
        .mockResolvedValueOnce({ id: 'student-1', email: 'student@test.com' });

      await service.bookLesson(studentId, dto);

      expect(emailService.sendEmail).toHaveBeenCalledTimes(2);
    });
  });

  describe('approveLesson', () => {
    const lessonId = 'lesson-1';
    const tutorId = 'tutor-1';
    const scheduledDate = new Date(futureScheduledTimeIso());

    const pendingLesson = {
      id: lessonId,
      tutorId,
      studentId: 'student-1',
      price: 50,
      durationMinutes: 60,
      scheduledTime: scheduledDate,
      endTime: new Date(scheduledDate.getTime() + 60 * 60000),
      status: LessonStatus.PENDING,
      tutor: { id: tutorId, firstName: 'Tutor', lastName: 'One' },
      student: { id: 'student-1', firstName: 'Student', lastName: 'One' },
    };

    beforeEach(() => {
      lessonRepository.findOne.mockResolvedValue(pendingLesson);
      userRepository.findOne.mockResolvedValue({
        id: tutorId,
        email: 'tutor@test.com',
      });
    });

    it('approves lesson, deducts student balance, and creates meet link', async () => {
      lessonRepository.findOne
        .mockResolvedValueOnce(pendingLesson)
        .mockResolvedValueOnce({
          ...pendingLesson,
          status: LessonStatus.CONFIRMED,
        });

      await service.approveLesson(lessonId, tutorId);

      expect(transactionManager.decrement).toHaveBeenCalledWith(
        StudentProfile,
        { userId: 'student-1' },
        'balance',
        50,
      );
      expect(transactionManager.update).toHaveBeenCalledWith(
        Lesson,
        { id: lessonId },
        expect.objectContaining({
          status: LessonStatus.CONFIRMED,
        }),
      );
      expect(transactionManager.update).toHaveBeenCalledWith(
        Classroom,
        { lessonId },
        { isActive: true },
      );
      expect(calendarService.createLessonMeetLink).toHaveBeenCalledWith(
        expect.objectContaining({
          start: scheduledDate,
          end: new Date(scheduledDate.getTime() + 60 * 60000),
        }),
      );
      expect(lessonRepository.update).toHaveBeenCalledWith(
        lessonId,
        expect.objectContaining({
          googleMeetUrl: 'https://meet.google.com/test',
        }),
      );
    });

    it('throws if lesson not found', async () => {
      lessonRepository.findOne.mockReset();
      lessonRepository.findOne.mockResolvedValue(null);
      await expect(service.approveLesson(lessonId, tutorId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws if tutor not owner', async () => {
      lessonRepository.findOne.mockReset();
      lessonRepository.findOne.mockResolvedValue({
        ...pendingLesson,
        tutorId: 'other-tutor',
      });
      await expect(service.approveLesson(lessonId, tutorId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws if lesson not pending', async () => {
      lessonRepository.findOne.mockReset();
      lessonRepository.findOne.mockResolvedValue({
        ...pendingLesson,
        status: LessonStatus.CONFIRMED,
      });
      await expect(service.approveLesson(lessonId, tutorId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws if student has insufficient balance at approval', async () => {
      transactionManager.findOne.mockImplementation(async (entity) => {
        if (entity === StudentProfile) {
          return { userId: 'student-1', balance: 10 };
        }
        return null;
      });

      await expect(service.approveLesson(lessonId, tutorId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('rejectLesson', () => {
    const lessonId = 'lesson-1';
    const tutorId = 'tutor-1';

    const pendingLesson = {
      id: lessonId,
      tutorId,
      status: LessonStatus.PENDING,
    };

    it('rejects lesson and sets status to CANCELLED', async () => {
      lessonRepository.findOne.mockResolvedValue(pendingLesson);

      const result = await service.rejectLesson(lessonId, tutorId);

      expect(result.message).toContain('rejected');
      expect(lessonRepository.update).toHaveBeenCalledWith(lessonId, {
        status: LessonStatus.CANCELLED,
      });
      expect(redisService.del).toHaveBeenCalledWith(
        `lessons:user:${pendingLesson.tutorId}`,
      );
    });

    it('throws if lesson not found', async () => {
      lessonRepository.findOne.mockResolvedValue(null);
      await expect(service.rejectLesson(lessonId, tutorId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws if tutor not owner', async () => {
      lessonRepository.findOne.mockResolvedValue({
        ...pendingLesson,
        tutorId: 'other-tutor',
      });
      await expect(service.rejectLesson(lessonId, tutorId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws if lesson not pending', async () => {
      lessonRepository.findOne.mockResolvedValue({
        ...pendingLesson,
        status: LessonStatus.CONFIRMED,
      });
      await expect(service.rejectLesson(lessonId, tutorId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('completeLesson', () => {
    const lessonId = 'lesson-1';
    const tutorId = 'tutor-1';
    const dto: CompleteLessonDto = { notes: 'Great lesson' };

    const confirmedLesson = {
      id: lessonId,
      tutorId,
      studentId: 'student-1',
      price: 100,
      durationMinutes: 60,
      status: LessonStatus.CONFIRMED,
      scheduledTime: new Date(pastScheduledTimeIso()),
      tutor: { id: tutorId },
      student: { id: 'student-1', email: 'student@test.com' },
    };

    beforeEach(() => {
      lessonRepository.findOne.mockResolvedValue(confirmedLesson);
      tutorProfileRepository.findOne.mockResolvedValue({
        userId: tutorId,
        totalHoursTaught: 10,
      });
    });

    it('completes lesson and pays tutor', async () => {
      lessonRepository.findOne
        .mockResolvedValueOnce(confirmedLesson)
        .mockResolvedValueOnce({
          ...confirmedLesson,
          status: LessonStatus.COMPLETED,
          platformFee: 30,
        });

      await service.completeLesson(lessonId, tutorId, dto);

      expect(transactionManager.update).toHaveBeenCalledWith(
        Lesson,
        { id: lessonId },
        expect.objectContaining({
          status: LessonStatus.COMPLETED,
          platformFee: 30,
          notes: 'Great lesson',
        }),
      );
      expect(transactionManager.increment).toHaveBeenCalledWith(
        TutorProfile,
        { userId: tutorId },
        'totalHoursTaught',
        1,
      );
      expect(transactionManager.increment).toHaveBeenCalledWith(
        TutorProfile,
        { userId: tutorId },
        'balance',
        70,
      );
      expect(transactionManager.update).toHaveBeenCalledWith(
        Classroom,
        { lessonId },
        { isActive: false },
      );
    });

    it('throws if lesson not found', async () => {
      lessonRepository.findOne.mockResolvedValue(null);
      await expect(
        service.completeLesson(lessonId, tutorId, dto),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws if lesson not confirmed', async () => {
      lessonRepository.findOne.mockResolvedValue({
        ...confirmedLesson,
        status: LessonStatus.PENDING,
      });
      await expect(
        service.completeLesson(lessonId, tutorId, dto),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws if lesson has not started yet', async () => {
      lessonRepository.findOne.mockResolvedValue({
        ...confirmedLesson,
        scheduledTime: new Date(futureScheduledTimeIso()),
      });
      await expect(
        service.completeLesson(lessonId, tutorId, dto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancelLesson', () => {
    const lessonId = 'lesson-1';
    const studentId = 'student-1';
    const tutorId = 'tutor-1';

    const buildConfirmedLesson = (hoursUntilStart = 48) => ({
      id: lessonId,
      studentId,
      tutorId,
      price: 50,
      status: LessonStatus.CONFIRMED,
      scheduledTime: new Date(Date.now() + hoursUntilStart * 3600000),
      tutor: { email: 'tutor@test.com' },
      student: { email: 'student@test.com' },
    });

    beforeEach(() => {
      transactionManager = createTransactionManager();
      dataSource.transaction.mockImplementation(async (cb) =>
        cb(transactionManager),
      );
      lessonRepository.findOne.mockResolvedValue(buildConfirmedLesson());
    });

    it('cancels lesson and refunds student if tutor cancels', async () => {
      const confirmedLesson = buildConfirmedLesson();
      lessonRepository.findOne
        .mockResolvedValueOnce(confirmedLesson)
        .mockResolvedValueOnce({
          ...confirmedLesson,
          status: LessonStatus.CANCELLED,
        });

      const result = await service.cancelLesson(lessonId, tutorId);

      expect(transactionManager.increment).toHaveBeenCalledWith(
        StudentProfile,
        { userId: studentId },
        'balance',
        50,
      );
      expect(transactionManager.update).toHaveBeenCalledWith(
        Classroom,
        { lessonId },
        { isActive: false },
      );
      expect(result.refunded).toBe(true);
      expect(result.refundAmount).toBe(50);
    });

    it('refunds student if cancelled more than 24h before', async () => {
      const confirmedLesson = buildConfirmedLesson(48);
      lessonRepository.findOne
        .mockResolvedValueOnce(confirmedLesson)
        .mockResolvedValueOnce({
          ...confirmedLesson,
          status: LessonStatus.CANCELLED,
        });

      await service.cancelLesson(lessonId, studentId);

      expect(transactionManager.increment).toHaveBeenCalledWith(
        StudentProfile,
        { userId: studentId },
        'balance',
        50,
      );
    });

    it('does not refund if cancelled less than 24h before by student', async () => {
      const confirmedLesson = buildConfirmedLesson(1);
      lessonRepository.findOne
        .mockResolvedValueOnce(confirmedLesson)
        .mockResolvedValueOnce({
          ...confirmedLesson,
          status: LessonStatus.CANCELLED,
        });

      const result = await service.cancelLesson(lessonId, studentId);

      expect(transactionManager.increment).not.toHaveBeenCalled();
      expect(result.refunded).toBe(false);
      expect(result.refundAmount).toBe(0);
    });

    it('throws if not participant', async () => {
      await expect(
        service.cancelLesson(lessonId, 'other-user'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws if lesson already completed', async () => {
      lessonRepository.findOne.mockResolvedValue({
        ...buildConfirmedLesson(),
        status: LessonStatus.COMPLETED,
      });
      await expect(service.cancelLesson(lessonId, studentId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findLessonForParticipant', () => {
    it('returns lesson for a participant when classroom is active', async () => {
      const lesson = {
        id: 'lesson-1',
        studentId: 'student-1',
        tutorId: 'tutor-1',
        status: LessonStatus.CONFIRMED,
        tutor: {},
        student: {},
      };
      lessonRepository.findOne.mockResolvedValue(lesson);
      classroomRepository.findOne.mockResolvedValue({
        lessonId: 'lesson-1',
        isActive: true,
      });

      const result = await service.findLessonForParticipant(
        'lesson-1',
        'student-1',
      );

      expect(result).toEqual(lesson);
    });

    it('throws if lesson is no longer available', async () => {
      lessonRepository.findOne.mockResolvedValue({
        id: 'lesson-1',
        studentId: 'student-1',
        tutorId: 'tutor-1',
        status: LessonStatus.COMPLETED,
      });

      await expect(
        service.findLessonForParticipant('lesson-1', 'student-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findUserLessons', () => {
    it('returns paginated lessons for a student', async () => {
      const lessons = [{ id: 'lesson-1' }];
      lessonRepository.findAndCount.mockResolvedValue([lessons, 1]);

      const result = await service.findUserLessons(
        'student-1',
        UserRole.STUDENT,
      );

      expect(result).toEqual({
        data: lessons,
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
      expect(lessonRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { studentId: 'student-1' },
          skip: 0,
          take: 20,
        }),
      );
    });
  });
});
