import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  ClassroomAccessState,
  CourseStatus,
  LessonPaymentStatus,
  LessonStatus,
  UserRole,
} from '@mrh/types';
import { Lesson } from './entities/lesson.entity.js';
import { TutorProfile } from '../tutors/entities/tutor-profile.entity.js';
import { StudentProfile } from '../students/entities/student-profile.entity.js';
import { Classroom } from '../classroom/entities/classroom.entity.js';
import { User } from '../users/entities/user.entity.js';
import { TutorAvailability } from '../tutors/entities/tutor-availability.entity.js';
import { LessonsService } from './lessons.service.js';
import { CommissionService } from '../payments/commission.service.js';
import { CalendarService } from '../integrations/google/calendar.service.js';
import { EmailService } from '../integrations/email/email.service.js';
import { RedisService } from '../redis/redis.service.js';
import { BookLessonDto } from './dto/book-lesson.dto.js';
import { CompleteLessonDto } from './dto/complete-lesson.dto.js';
import { ClassroomAccessService } from '../classroom/classroom-access.service.js';
import { FinancialLedgerService } from '../payments/financial-ledger.service.js';

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
    find: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    increment: jest.Mock;
    decrement: jest.Mock;
    delete: jest.Mock;
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
  const financialLedgerService = {
    record: jest.fn(async (_manager, value) => value),
    recordOrUpdate: jest.fn(async (_manager, value) => value),
    update: jest.fn(async (_manager, _eventKey, value) => value),
  };

  const createTransactionManager = () => {
    const manager = {
      findOne: jest.fn(async (entity) => {
        if (entity === TutorProfile) {
          return {
            userId: 'tutor-1',
            hourlyRate: 50,
            balance: 0,
            status: CourseStatus.APPROVED,
          };
        }
        if (entity === StudentProfile) {
          return { userId: 'student-1', balance: 100, heldBalance: 50 };
        }
        if (entity === User) {
          return {
            id: 'student-1',
            role: UserRole.STUDENT,
            isActive: true,
          };
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
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn(async (...args) => (args.length > 1 ? args[1] : args[0])),
      create: jest.fn((_entity, data) => data),
      update: jest.fn(),
      increment: jest.fn(),
      decrement: jest.fn(),
      delete: jest.fn(),
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
    lessonRepository.findOne.mockReset();

    transactionManager = createTransactionManager();
    dataSource.transaction.mockImplementation(async (cb) =>
      cb(transactionManager),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LessonsService,
        ClassroomAccessService,
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
        {
          provide: FinancialLedgerService,
          useValue: financialLedgerService,
        },
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

    it('creates a confirmed, charged lesson with an active classroom', async () => {
      const savedLesson = {
        id: 'lesson-1',
        tutorId: 'tutor-1',
        studentId,
        status: LessonStatus.CONFIRMED,
        price: 41.67,
        durationMinutes: 50,
      };
      transactionManager.save.mockImplementation(async (entity, data) => {
        if (entity === Lesson) return { ...data, id: 'lesson-1' };
        return data;
      });
      lessonRepository.findOne.mockResolvedValue(savedLesson);

      const result = await service.bookLesson(studentId, dto);

      expect(result?.status).toBe(LessonStatus.CONFIRMED);
      expect(transactionManager.create).toHaveBeenCalledWith(
        Classroom,
        expect.objectContaining({
          lessonId: 'lesson-1',
          isActive: true,
        }),
      );
      expect(transactionManager.decrement).toHaveBeenCalledWith(
        StudentProfile,
        { userId: studentId },
        'balance',
        41.67,
      );
    });

    it('books multiple whole hours with the correct price and end time', async () => {
      const multiHourDto: BookLessonDto = {
        ...dto,
        durationMinutes: 120,
      };
      transactionManager.findOne.mockImplementation(async (entity) => {
        if (entity === StudentProfile) {
          return { userId: studentId, balance: 250, heldBalance: 0 };
        }
        if (entity === TutorProfile) {
          return {
            userId: 'tutor-1',
            hourlyRate: 50,
            status: CourseStatus.APPROVED,
          };
        }
        if (entity === User) {
          return { id: studentId, isActive: true };
        }
        return null;
      });
      transactionManager.save.mockImplementation(async (entity, data) => {
        if (entity === Lesson) return { ...data, id: 'lesson-2' };
        return data;
      });
      lessonRepository.findOne.mockResolvedValue({
        id: 'lesson-2',
        tutorId: 'tutor-1',
        studentId,
        status: LessonStatus.CONFIRMED,
        durationMinutes: 120,
        price: 100,
      });

      await service.bookLesson(studentId, multiHourDto);

      expect(transactionManager.create).toHaveBeenCalledWith(
        Lesson,
        expect.objectContaining({
          durationMinutes: 120,
          price: 100,
          endTime: new Date(
            new Date(multiHourDto.scheduledTime).getTime() + 120 * 60_000,
          ),
          platformFee: 30,
          tutorShare: 70,
        }),
      );
      expect(transactionManager.decrement).toHaveBeenCalledWith(
        StudentProfile,
        { userId: studentId },
        'balance',
        100,
      );
    });

    it('returns the original confirmed lesson for a repeated booking key without charging again', async () => {
      const keyedDto: BookLessonDto = {
        ...dto,
        idempotencyKey: 'test-booking-key',
      };
      const existingLesson = {
        id: 'lesson-1',
        tutorId: keyedDto.tutorId,
        studentId,
        scheduledTime: new Date(keyedDto.scheduledTime),
        durationMinutes: keyedDto.durationMinutes,
        status: LessonStatus.CONFIRMED,
        price: 41.67,
      };
      lessonRepository.findOne.mockResolvedValue(existingLesson);

      const result = await service.bookLesson(studentId, keyedDto);

      expect(result).toBe(existingLesson);
      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(transactionManager.decrement).not.toHaveBeenCalled();
      expect(emailService.sendEmail).not.toHaveBeenCalled();
    });

    it('rejects a repeated booking key when the booking details changed', async () => {
      const keyedDto: BookLessonDto = {
        ...dto,
        idempotencyKey: 'test-booking-key',
      };
      lessonRepository.findOne.mockResolvedValue({
        id: 'lesson-1',
        tutorId: keyedDto.tutorId,
        studentId,
        scheduledTime: new Date(
          new Date(keyedDto.scheduledTime).getTime() + 60_000,
        ),
        durationMinutes: keyedDto.durationMinutes,
      });

      await expect(service.bookLesson(studentId, keyedDto)).rejects.toThrow(
        'different booking',
      );
      expect(dataSource.transaction).not.toHaveBeenCalled();
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

    it('validates availability in the tutor timezone', async () => {
      const scheduledDate = new Date('2030-01-05T23:30:00.000Z');
      availabilityRepository.find.mockResolvedValueOnce([
        {
          tutorId: 'tutor-1',
          dayOfWeek: 0,
          startTime: '01:00',
          endTime: '03:00',
        },
      ]);

      await expect(
        service['assertWithinAvailability'](
          'tutor-1',
          scheduledDate,
          50,
          'Africa/Cairo',
        ),
      ).resolves.toBeUndefined();
    });

    it('deducts the student balance when the lesson is confirmed', async () => {
      const savedLesson = {
        id: 'lesson-1',
        tutorId: 'tutor-1',
        studentId,
        status: LessonStatus.CONFIRMED,
        price: 41.67,
      };
      transactionManager.save.mockImplementation(async (entity, data) => {
        if (entity === Lesson) return { ...data, id: 'lesson-1' };
        return data;
      });
      lessonRepository.findOne.mockResolvedValue(savedLesson);

      await service.bookLesson(studentId, dto);

      expect(transactionManager.decrement).toHaveBeenCalledWith(
        StudentProfile,
        { userId: studentId },
        'balance',
        41.67,
      );
      expect(studentProfileRepository.decrement).not.toHaveBeenCalled();
    });

    it('sends email to tutor and student', async () => {
      const savedLesson = {
        id: 'lesson-1',
        tutorId: 'tutor-1',
        studentId,
        status: LessonStatus.CONFIRMED,
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

  describe('rescheduleLesson', () => {
    const lessonId = 'lesson-1';
    const tutorId = 'tutor-1';
    const originalTime = new Date(futureScheduledTimeIso(2, 10));
    const newTime = new Date(futureScheduledTimeIso(3, 10));
    const lesson = {
      id: lessonId,
      tutorId,
      studentId: 'student-1',
      scheduledTime: originalTime,
      endTime: new Date(originalTime.getTime() + 50 * 60_000),
      durationMinutes: 50,
      price: 50,
      platformFee: null,
      status: LessonStatus.CONFIRMED,
      calendarEventId: 'calendar-old',
      googleMeetUrl: 'https://meet.google.com/old',
      roomId: 'room-1',
      meetUrl: 'room-1',
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      tutor: {
        id: tutorId,
        firstName: 'Tutor',
        lastName: 'One',
        email: 'tutor@test.com',
        timezone: 'Africa/Cairo',
        avatarUrl: null,
      },
      student: {
        id: 'student-1',
        firstName: 'Student',
        lastName: 'One',
        email: 'student@test.com',
        avatarUrl: null,
      },
    };

    beforeEach(() => {
      tutorProfileRepository.findOne.mockResolvedValue({
        userId: tutorId,
        user: { timezone: 'Africa/Cairo' },
      });
      availabilityRepository.find.mockResolvedValue([
        {
          tutorId,
          dayOfWeek: newTime.getUTCDay(),
          startTime: '00:00',
          endTime: '23:59',
        },
      ]);
    });

    it('lets only the assigned tutor reschedule and replaces the calendar event', async () => {
      const rescheduled = {
        ...lesson,
        scheduledTime: newTime,
        endTime: new Date(newTime.getTime() + 50 * 60_000),
        calendarEventId: 'event-1',
        googleMeetUrl: 'https://meet.google.com/test',
      };
      lessonRepository.findOne
        .mockResolvedValueOnce(lesson)
        .mockResolvedValueOnce(rescheduled);
      transactionManager.findOne.mockImplementation(async (entity) =>
        entity === Lesson ? { ...lesson } : null,
      );

      const result = await service.rescheduleLesson(lessonId, tutorId, {
        scheduledTime: newTime.toISOString(),
      });

      expect(transactionManager.save).toHaveBeenCalledWith(
        Lesson,
        expect.objectContaining({
          scheduledTime: newTime,
          endTime: new Date(newTime.getTime() + 50 * 60_000),
          calendarEventId: null,
          googleMeetUrl: null,
        }),
      );
      expect(calendarService.deleteCalendarEvent).toHaveBeenCalledWith(
        'calendar-old',
      );
      expect(result).toEqual(
        expect.objectContaining({
          rescheduled: true,
          timezone: 'Africa/Cairo',
          paymentStatus: 'paid',
          sessionStatus: LessonStatus.CONFIRMED,
        }),
      );
    });

    it('rejects a tutor who is not assigned to the lesson', async () => {
      lessonRepository.findOne.mockResolvedValue(lesson);

      await expect(
        service.rescheduleLesson(lessonId, 'other-tutor', {
          scheduledTime: newTime.toISOString(),
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('treats a repeated reschedule to the same time as a no-op', async () => {
      lessonRepository.findOne.mockResolvedValue({
        ...lesson,
        scheduledTime: newTime,
      });

      const result = await service.rescheduleLesson(lessonId, tutorId, {
        scheduledTime: newTime.toISOString(),
      });

      expect(result.rescheduled).toBe(false);
      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(calendarService.deleteCalendarEvent).not.toHaveBeenCalled();
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

      expect(transactionManager.save).toHaveBeenCalledWith(
        Lesson,
        expect.objectContaining({
          id: lessonId,
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
      expect(financialLedgerService.record).toHaveBeenCalledWith(
        transactionManager,
        expect.objectContaining({
          eventKey: `tutor_earning:lesson:${lessonId}`,
          balanceBefore: 0,
          balanceAfter: 70,
        }),
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
        status: LessonStatus.CANCELLED,
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

    it('blocks student cancellation within the two-hour notice window', async () => {
      const confirmedLesson = buildConfirmedLesson(1);
      lessonRepository.findOne
        .mockResolvedValueOnce(confirmedLesson)
        .mockResolvedValueOnce({
          ...confirmedLesson,
          status: LessonStatus.CANCELLED,
        });

      await expect(service.cancelLesson(lessonId, studentId)).rejects.toThrow(
        'at least 2 hours notice',
      );
      expect(transactionManager.increment).not.toHaveBeenCalled();
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

    it('returns the original refund for a duplicate cancellation without refunding twice', async () => {
      lessonRepository.findOne.mockResolvedValue({
        ...buildConfirmedLesson(),
        status: LessonStatus.CANCELLED,
      });

      const result = await service.cancelLesson(lessonId, tutorId);

      expect(result).toEqual(
        expect.objectContaining({
          duplicate: true,
          refunded: true,
          refundAmount: 50,
          paymentStatus: 'refunded',
        }),
      );
      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(transactionManager.increment).not.toHaveBeenCalled();
    });
  });

  describe('findByRoomId', () => {
    it('uses the native room id first and keeps legacy meet-url compatibility', async () => {
      const scheduledTime = new Date(Date.now() - 5 * 60_000);
      const lesson = {
        id: 'lesson-1',
        roomId: 'native-room-1',
        meetUrl: 'native-room-1',
        studentId: 'student-1',
        tutorId: 'tutor-1',
        status: LessonStatus.CONFIRMED,
        paymentStatus: LessonPaymentStatus.PAID,
        scheduledTime,
        endTime: new Date(scheduledTime.getTime() + 50 * 60_000),
        durationMinutes: 50,
        tutor: {},
        student: {},
      };
      lessonRepository.findOne.mockResolvedValue(lesson);
      classroomRepository.findOne.mockResolvedValue({
        lessonId: lesson.id,
        isActive: true,
      });

      await expect(
        service.findByRoomId('native-room-1', 'student-1'),
      ).resolves.toEqual(
        expect.objectContaining({
          id: lesson.id,
          access: expect.objectContaining({
            state: ClassroomAccessState.ALLOWED,
            canJoin: true,
          }),
        }),
      );
      expect(lessonRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: [{ roomId: 'native-room-1' }, { meetUrl: 'native-room-1' }],
        }),
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
    it('returns scoped tutor bookings with dashboard payment and timezone fields', async () => {
      const scheduledTime = new Date('2030-01-05T10:00:00.000Z');
      const lessons = [
        {
          id: 'lesson-1',
          tutorId: 'tutor-1',
          studentId: 'student-1',
          scheduledTime,
          endTime: new Date('2030-01-05T10:50:00.000Z'),
          durationMinutes: 50,
          price: 50,
          platformFee: null,
          status: LessonStatus.CONFIRMED,
          roomId: 'room-1',
          meetUrl: 'room-1',
          googleMeetUrl: null,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          tutor: {
            id: 'tutor-1',
            firstName: 'Tutor',
            lastName: 'One',
            avatarUrl: null,
            timezone: 'Africa/Cairo',
          },
          student: {
            id: 'student-1',
            firstName: 'Student',
            lastName: 'One',
            avatarUrl: null,
          },
        },
      ];
      lessonRepository.findAndCount.mockResolvedValue([lessons, 1]);

      const result = await service.findUserLessons('tutor-1', UserRole.TUTOR);

      expect(result.data).toEqual([
        expect.objectContaining({
          id: 'lesson-1',
          scheduledTime,
          timezone: 'Africa/Cairo',
          paymentStatus: 'paid',
          sessionStatus: LessonStatus.CONFIRMED,
          student: expect.objectContaining({
            firstName: 'Student',
            lastName: 'One',
          }),
        }),
      ]);
      expect(result).toEqual(
        expect.objectContaining({
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
        }),
      );
      expect(lessonRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tutorId: 'tutor-1' },
          skip: 0,
          take: 20,
        }),
      );
    });
  });
});
