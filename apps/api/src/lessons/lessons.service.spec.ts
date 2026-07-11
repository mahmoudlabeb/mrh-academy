import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
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

describe('LessonsService', () => {
  let service: LessonsService;

  const lessonRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
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
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };

  const userRepository = {
    findOne: jest.fn(),
  };

  const availabilityRepository = {
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(0),
    })),
  };

  const dataSource = {
    transaction: jest.fn(async (cb) => cb({
      findOne: jest.fn(),
      save: jest.fn(async (entity) => entity),
      create: jest.fn(),
      update: jest.fn(),
      increment: jest.fn(),
      decrement: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
      })),
    })),
  };

  const commissionService = {
    calculateLessonEarnings: jest.fn(() => ({ platformFee: 30, tutorShare: 70 })),
    calculateLessonFee: jest.fn(() => 0.3),
  };

  const calendarService = {
    createCalendarEvent: jest.fn().mockResolvedValue('event-1'),
    deleteCalendarEvent: jest.fn().mockResolvedValue(undefined),
  };

  const emailService = {
    sendEmail: jest.fn().mockResolvedValue(undefined),
  };

  const redisService = {
    del: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    (dataSource.transaction as jest.Mock).mockImplementation(async (cb) => {
      const manager = {
        findOne: jest.fn(),
        save: jest.fn(async (entity) => entity),
        create: jest.fn(),
        update: jest.fn(),
        increment: jest.fn(),
        decrement: jest.fn(),
        createQueryBuilder: jest.fn(() => ({
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getCount: jest.fn().mockResolvedValue(0),
        })),
      };
      return cb(manager);
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LessonsService,
        { provide: getRepositoryToken(Lesson), useValue: lessonRepository },
        { provide: getRepositoryToken(TutorProfile), useValue: tutorProfileRepository },
        { provide: getRepositoryToken(StudentProfile), useValue: studentProfileRepository },
        { provide: getRepositoryToken(Classroom), useValue: classroomRepository },
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: getRepositoryToken(TutorAvailability), useValue: availabilityRepository },
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
    const dto: BookLessonDto = {
      tutorId: 'tutor-1',
      scheduledTime: new Date(Date.now() + 86400000).toISOString(),
      durationMinutes: 60,
    };

    beforeEach(() => {
      tutorProfileRepository.findOne.mockResolvedValue({
        userId: 'tutor-1',
        hourlyRate: 50,
        status: CourseStatus.APPROVED,
      });
      studentProfileRepository.findOne.mockResolvedValue({
        userId: 'student-1',
        balance: 100,
      });
      lessonRepository.findOne.mockResolvedValue(null);
      userRepository.findOne.mockResolvedValue({ id: 'tutor-1', email: 'tutor@test.com' });
    });

    it('creates lesson with PENDING status and inactive classroom', async () => {
      const savedLesson = { id: 'lesson-1', ...dto, tutorId: 'tutor-1', studentId, status: LessonStatus.PENDING, price: 50 };
      lessonRepository.save.mockResolvedValue(savedLesson);
      lessonRepository.findOne.mockResolvedValue(savedLesson);

      const result = await service.bookLesson(studentId, dto);

      expect(result.status).toBe(LessonStatus.PENDING);
      expect(classroomRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false })
      );
    });

    it('throws if tutor not found', async () => {
      tutorProfileRepository.findOne.mockResolvedValueOnce(null);
      await expect(service.bookLesson(studentId, dto)).rejects.toThrow(NotFoundException);
    });

    it('throws if tutor not approved', async () => {
      tutorProfileRepository.findOne.mockResolvedValueOnce({ status: CourseStatus.PENDING });
      await expect(service.bookLesson(studentId, dto)).rejects.toThrow(BadRequestException);
    });

    it('throws if student has insufficient balance', async () => {
      studentProfileRepository.findOne.mockResolvedValueOnce({ balance: 10 });
      await expect(service.bookLesson(studentId, dto)).rejects.toThrow(BadRequestException);
    });

    it('throws if scheduled time is in the past', async () => {
      const pastDto = { ...dto, scheduledTime: new Date(Date.now() - 1000).toISOString() };
      await expect(service.bookLesson(studentId, pastDto)).rejects.toThrow(BadRequestException);
    });

    it('does not deduct balance at booking time', async () => {
      const savedLesson = { id: 'lesson-1', ...dto, tutorId: 'tutor-1', studentId, status: LessonStatus.PENDING, price: 50 };
      lessonRepository.save.mockResolvedValue(savedLesson);
      lessonRepository.findOne.mockResolvedValue(savedLesson);

      await service.bookLesson(studentId, dto);

      expect(studentProfileRepository.decrement).not.toHaveBeenCalled();
    });

    it('checks for overlapping lessons', async () => {
      availabilityRepository.createQueryBuilder.mockReturnValueOnce({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(1),
      });

      await expect(service.bookLesson(studentId, dto)).rejects.toThrow(BadRequestException);
    });

    it('sends email to tutor and student', async () => {
      const savedLesson = { id: 'lesson-1', ...dto, tutorId: 'tutor-1', studentId, status: LessonStatus.PENDING, price: 50 };
      lessonRepository.save.mockResolvedValue(savedLesson);
      lessonRepository.findOne.mockResolvedValue(savedLesson);

      await service.bookLesson(studentId, dto);

      expect(emailService.sendEmail).toHaveBeenCalledTimes(2);
    });
  });

  describe('approveLesson', () => {
    const lessonId = 'lesson-1';
    const tutorId = 'tutor-1';

    beforeEach(() => {
      lessonRepository.findOne.mockResolvedValue({
        id: lessonId,
        tutorId,
        studentId: 'student-1',
        price: 50,
        status: LessonStatus.PENDING,
        tutor: { id: tutorId },
        student: { id: 'student-1', email: 'student@test.com' },
      });
      studentProfileRepository.findOne.mockResolvedValue({ userId: 'student-1', balance: 100 });
      userRepository.findOne.mockResolvedValue({ id: tutorId, email: 'tutor@test.com' });
    });

    it('approves lesson and deducts student balance', async () => {
      lessonRepository.findOne
        .mockResolvedValueOnce({
          id: lessonId,
          tutorId,
          studentId: 'student-1',
          price: 50,
          status: LessonStatus.PENDING,
          tutor: { id: tutorId },
          student: { id: 'student-1', email: 'student@test.com' },
        })
        .mockResolvedValueOnce({
          id: lessonId,
          status: LessonStatus.CONFIRMED,
        });

      await service.approveLesson(lessonId, tutorId);

      expect(studentProfileRepository.decrement).toHaveBeenCalledWith(
        { userId: 'student-1' },
        'balance',
        50
      );
    });

    it('throws if lesson not found', async () => {
      lessonRepository.findOne.mockResolvedValueOnce(null);
      await expect(service.approveLesson(lessonId, tutorId)).rejects.toThrow(NotFoundException);
    });

    it('throws if tutor not owner', async () => {
      lessonRepository.findOne.mockResolvedValueOnce({ tutorId: 'other-tutor' });
      await expect(service.approveLesson(lessonId, tutorId)).rejects.toThrow(ForbiddenException);
    });

    it('throws if lesson not pending', async () => {
      lessonRepository.findOne.mockResolvedValueOnce({ tutorId, status: LessonStatus.CONFIRMED });
      await expect(service.approveLesson(lessonId, tutorId)).rejects.toThrow(BadRequestException);
    });

    it('throws if student has insufficient balance at approval', async () => {
      studentProfileRepository.findOne.mockResolvedValueOnce({ balance: 10 });
      await expect(service.approveLesson(lessonId, tutorId)).rejects.toThrow(BadRequestException);
    });

    it('activates classroom', async () => {
      lessonRepository.findOne
        .mockResolvedValueOnce({
          id: lessonId,
          tutorId,
          studentId: 'student-1',
          price: 50,
          status: LessonStatus.PENDING,
          tutor: { id: tutorId },
          student: { id: 'student-1', email: 'student@test.com' },
        })
        .mockResolvedValueOnce({ id: lessonId, status: LessonStatus.CONFIRMED });

      await service.approveLesson(lessonId, tutorId);

      expect(classroomRepository.update).toHaveBeenCalledWith(
        { lessonId },
        { isActive: true }
      );
    });
  });

  describe('rejectLesson', () => {
    const lessonId = 'lesson-1';
    const tutorId = 'tutor-1';

    beforeEach(() => {
      lessonRepository.findOne.mockResolvedValue({
        id: lessonId,
        tutorId,
        status: LessonStatus.PENDING,
      });
    });

    it('rejects lesson and sets status to CANCELLED', async () => {
      lessonRepository.findOne.mockResolvedValueOnce({ id: lessonId, status: LessonStatus.CANCELLED });

      const result = await service.rejectLesson(lessonId, tutorId);

      expect(result.message).toContain('cancelled');
      expect(lessonRepository.update).toHaveBeenCalledWith(
        { id: lessonId, tutorId },
        { status: LessonStatus.CANCELLED }
      );
    });

    it('throws if lesson not found', async () => {
      lessonRepository.findOne.mockResolvedValueOnce(null);
      await expect(service.rejectLesson(lessonId, tutorId)).rejects.toThrow(NotFoundException);
    });

    it('throws if tutor not owner', async () => {
      lessonRepository.findOne.mockResolvedValueOnce({ tutorId: 'other-tutor' });
      await expect(service.rejectLesson(lessonId, tutorId)).rejects.toThrow(ForbiddenException);
    });

    it('throws if lesson not pending', async () => {
      lessonRepository.findOne.mockResolvedValueOnce({ tutorId, status: LessonStatus.CONFIRMED });
      await expect(service.rejectLesson(lessonId, tutorId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('completeLesson', () => {
    const lessonId = 'lesson-1';
    const tutorId = 'tutor-1';
    const dto: CompleteLessonDto = { notes: 'Great lesson' };

    beforeEach(() => {
      lessonRepository.findOne.mockResolvedValue({
        id: lessonId,
        tutorId,
        studentId: 'student-1',
        price: 100,
        durationMinutes: 60,
        status: LessonStatus.CONFIRMED,
        tutor: { id: tutorId },
        student: { id: 'student-1', email: 'student@test.com' },
      });
      tutorProfileRepository.findOne.mockResolvedValue({ userId: tutorId, totalHoursTaught: 10 });
    });

    it('completes lesson and pays tutor', async () => {
      lessonRepository.findOne
        .mockResolvedValueOnce({
          id: lessonId,
          tutorId,
          studentId: 'student-1',
          price: 100,
          durationMinutes: 60,
          status: LessonStatus.CONFIRMED,
          tutor: { id: tutorId },
          student: { id: 'student-1', email: 'student@test.com' },
        })
        .mockResolvedValueOnce({
          id: lessonId,
          status: LessonStatus.COMPLETED,
          platformFee: 30,
        });

      await service.completeLesson(lessonId, tutorId, dto);

      expect(lessonRepository.update).toHaveBeenCalledWith(
        { id: lessonId },
        expect.objectContaining({ status: LessonStatus.COMPLETED })
      );
      expect(tutorProfileRepository.increment).toHaveBeenCalledWith(
        { userId: tutorId },
        'totalHoursTaught',
        1
      );
      expect(tutorProfileRepository.increment).toHaveBeenCalledWith(
        { userId: tutorId },
        'balance',
        70
      );
      expect(classroomRepository.update).toHaveBeenCalledWith(
        { lessonId },
        { isActive: false }
      );
    });

    it('throws if lesson not found', async () => {
      lessonRepository.findOne.mockResolvedValueOnce(null);
      await expect(service.completeLesson(lessonId, tutorId, dto)).rejects.toThrow(NotFoundException);
    });

    it('throws if lesson not confirmed', async () => {
      lessonRepository.findOne.mockResolvedValueOnce({ tutorId, status: LessonStatus.PENDING });
      await expect(service.completeLesson(lessonId, tutorId, dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancelLesson', () => {
    const lessonId = 'lesson-1';
    const studentId = 'student-1';

    beforeEach(() => {
      lessonRepository.findOne.mockResolvedValue({
        id: lessonId,
        studentId,
        tutorId: 'tutor-1',
        price: 50,
        status: LessonStatus.CONFIRMED,
        scheduledTime: new Date(Date.now() + 86400000),
      });
    });

    it('cancels lesson and refunds student if tutor cancels', async () => {
      lessonRepository.findOne.mockResolvedValueOnce({ id: lessonId, status: LessonStatus.CANCELLED });

      await service.cancelLesson(lessonId, 'tutor-1');

      expect(studentProfileRepository.increment).toHaveBeenCalledWith(
        { userId: studentId },
        'balance',
        50
      );
      expect(classroomRepository.update).toHaveBeenCalledWith(
        { lessonId },
        { isActive: false }
      );
    });

    it('refunds student if cancelled more than 24h before', async () => {
      lessonRepository.findOne
        .mockResolvedValueOnce({
          id: lessonId,
          studentId,
          tutorId: 'tutor-1',
          price: 50,
          status: LessonStatus.CONFIRMED,
          scheduledTime: new Date(Date.now() + 86400000),
        })
        .mockResolvedValueOnce({ id: lessonId, status: LessonStatus.CANCELLED });

      await service.cancelLesson(lessonId, studentId);

      expect(studentProfileRepository.increment).toHaveBeenCalledWith(
        { userId: studentId },
        'balance',
        50
      );
    });

    it('does not refund if cancelled less than 24h before by student', async () => {
      lessonRepository.findOne
        .mockResolvedValueOnce({
          id: lessonId,
          studentId,
          tutorId: 'tutor-1',
          price: 50,
          status: LessonStatus.CONFIRMED,
          scheduledTime: new Date(Date.now() + 3600000), // 1 hour
        })
        .mockResolvedValueOnce({ id: lessonId, status: LessonStatus.CANCELLED });

      await service.cancelLesson(lessonId, studentId);

      expect(studentProfileRepository.increment).not.toHaveBeenCalled();
    });

    it('throws if not participant', async () => {
      await expect(service.cancelLesson(lessonId, 'other-user')).rejects.toThrow(ForbiddenException);
    });

    it('throws if lesson already completed', async () => {
      lessonRepository.findOne.mockResolvedValueOnce({
        id: lessonId,
        studentId,
        tutorId: 'tutor-1',
        status: LessonStatus.COMPLETED,
      });
      await expect(service.cancelLesson(lessonId, studentId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getLesson', () => {
    it('returns lesson with relations', async () => {
      const lesson = { id: 'lesson-1', tutor: {}, student: {} };
      lessonRepository.findOne.mockResolvedValue(lesson);

      const result = await service.getLesson('lesson-1');

      expect(result).toEqual(lesson);
      expect(lessonRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'lesson-1' }, relations: { tutor: true, student: true } })
      );
    });
  });
});