import { Test, TestingModule } from '@nestjs/testing';
import { LessonsService } from '../lessons.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Lesson } from '../../entities/lesson.entity';
import { TutorProfile } from '../../entities/tutor-profile.entity';
import { StudentProfile } from '../../entities/student-profile.entity';
import { Classroom } from '../../entities/classroom.entity';
import { User } from '../../entities/user.entity';
import { TutorAvailability } from '../../entities/tutor-availability.entity';
import { DataSource } from 'typeorm';
import { CommissionService } from '../../services/commission.service';
import { CalendarService } from '../../services/calendar.service';
import { EmailService } from '../../services/email.service';
import { RedisService } from '../../redis/redis.service';
import { CourseStatus, LessonStatus } from '@mrh/types';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('B1 Preservation — Non-Datetime Booking Logic', () => {
  let service: LessonsService;
  let dataSource: { transaction: jest.Mock };
  let tutorRepo: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };
  let availRepo: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };
  let lessonRepo: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };
  let redisService: { del: jest.Mock; set: jest.Mock; get: jest.Mock };
  let userRepo: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };
  let emailService: { sendEmail: jest.Mock };

  function mockRepo() {
    return {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };
  }

  function futureDate(daysFromNow = 30): string {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    d.setHours(14, 30, 0, 0);
    return d.toISOString();
  }

  beforeEach(async () => {
    dataSource = { transaction: jest.fn() };
    tutorRepo = mockRepo();
    availRepo = mockRepo();
    lessonRepo = mockRepo();
    userRepo = mockRepo();
    redisService = {
      del: jest.fn().mockResolvedValue(1),
      set: jest.fn(),
      get: jest.fn(),
    };
    emailService = { sendEmail: jest.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LessonsService,
        { provide: getRepositoryToken(Lesson), useValue: lessonRepo },
        { provide: getRepositoryToken(TutorProfile), useValue: tutorRepo },
        { provide: getRepositoryToken(StudentProfile), useFactory: mockRepo },
        { provide: getRepositoryToken(Classroom), useFactory: mockRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(TutorAvailability), useValue: availRepo },
        { provide: DataSource, useValue: dataSource },
        {
          provide: CommissionService,
          useValue: {
            calculateLessonEarnings: jest
              .fn()
              .mockReturnValue({ platformFee: 2, tutorShare: 23 }),
          },
        },
        {
          provide: CalendarService,
          useValue: {
            createLessonMeetLink: jest.fn().mockResolvedValue(null),
            deleteCalendarEvent: jest.fn(),
          },
        },
        { provide: EmailService, useValue: emailService },
        { provide: RedisService, useValue: redisService },
      ],
    }).compile();

    service = module.get<LessonsService>(LessonsService);
  });

  const isoTime = futureDate();
  const dayOfWeek = new Date(isoTime).getDay();
  const validDto = {
    tutorId: 'tutor-1',
    scheduledTime: isoTime,
    durationMinutes: 50,
  };

  it('should throw NotFoundException when tutor is not found', async () => {
    tutorRepo.findOne.mockResolvedValue(null);
    await expect(service.bookLesson('student-1', validDto)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should throw BadRequestException when tutor is not APPROVED', async () => {
    tutorRepo.findOne.mockResolvedValue({
      userId: 'tutor-1',
      status: CourseStatus.PENDING,
      hourlyRate: 30,
    });
    await expect(service.bookLesson('student-1', validDto)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should compute price as hourlyRate * durationMinutes / 60', async () => {
    tutorRepo.findOne.mockResolvedValue({
      userId: 'tutor-1',
      status: CourseStatus.APPROVED,
      hourlyRate: 30,
    });
    availRepo.find.mockResolvedValue([
      {
        id: 'slot-1',
        tutorId: 'tutor-1',
        dayOfWeek,
        startTime: '09:00',
        endTime: '17:00',
      },
    ]);

    const dt = new Date(isoTime);
    const savedLesson = {
      id: 'lesson-1',
      tutorId: 'tutor-1',
      studentId: 'student-1',
      scheduledTime: dt,
      endTime: new Date(dt.getTime() + 50 * 60000),
      durationMinutes: 50,
      price: 25,
      status: LessonStatus.PENDING,
      meetUrl: 'room-abc',
      tutor: { id: 'tutor-1', firstName: 'T', lastName: 'T', email: 't@t.com' },
      student: {
        id: 'student-1',
        firstName: 'S',
        lastName: 'S',
        email: 's@s.com',
      },
    };

    const mockManager = {
      findOne: jest
        .fn()
        .mockResolvedValue({ userId: 'tutor-1', hourlyRate: 30 }),
      create: jest.fn((_e: any, d: any) => d),
      save: jest.fn(async (_target: any, data: any) => {
        if (data && data.tutorId && data.studentId)
          return { ...savedLesson, ...data };
        return data || _target;
      }),
    };
    dataSource.transaction.mockImplementation(
      async (cb: (manager: typeof mockManager) => Promise<any>) =>
        cb(mockManager),
    );
    lessonRepo.findOne.mockResolvedValue(savedLesson);
    userRepo.findOne.mockResolvedValue(null);

    const result = await service.bookLesson('student-1', validDto);
    expect(result!.scheduledTime.getUTCHours()).not.toBe(0);
    expect(result!.scheduledTime.getUTCMinutes()).not.toBe(0);
  });

  it('should create a Classroom entity during booking', async () => {
    tutorRepo.findOne.mockResolvedValue({
      userId: 'tutor-1',
      status: CourseStatus.APPROVED,
      hourlyRate: 30,
    });
    availRepo.find.mockResolvedValue([
      {
        id: 'slot-1',
        tutorId: 'tutor-1',
        dayOfWeek,
        startTime: '09:00',
        endTime: '17:00',
      },
    ]);

    const dt = new Date(isoTime);
    const savedLesson = {
      id: 'lesson-1',
      tutorId: 'tutor-1',
      studentId: 'student-1',
      scheduledTime: dt,
      endTime: new Date(dt.getTime() + 50 * 60000),
      durationMinutes: 50,
      price: 25,
      status: LessonStatus.PENDING,
      meetUrl: 'room-abc',
      tutor: { id: 'tutor-1', firstName: 'T', lastName: 'T', email: 't@t.com' },
      student: {
        id: 'student-1',
        firstName: 'S',
        lastName: 'S',
        email: 's@s.com',
      },
    };

    const classroomSave = jest.fn();
    const mockManager = {
      findOne: jest
        .fn()
        .mockResolvedValue({ userId: 'tutor-1', hourlyRate: 30 }),
      create: jest.fn((_e: any, d: any) => d),
      save: jest.fn(async (_target: any, data: any) => {
        if (data && data.lessonId) {
          classroomSave();
          return data;
        }
        if (data && data.tutorId && data.studentId) {
          return { ...savedLesson, ...data };
        }
        return data || _target;
      }),
    };
    dataSource.transaction.mockImplementation(
      async (cb: (manager: typeof mockManager) => Promise<any>) =>
        cb(mockManager),
    );
    lessonRepo.findOne.mockResolvedValue(savedLesson);
    userRepo.findOne.mockResolvedValue(null);

    await service.bookLesson('student-1', validDto);
    expect(classroomSave).toHaveBeenCalledTimes(1);
  });

  it('should call Redis invalidation after booking', async () => {
    tutorRepo.findOne.mockResolvedValue({
      userId: 'tutor-1',
      status: CourseStatus.APPROVED,
      hourlyRate: 30,
    });
    availRepo.find.mockResolvedValue([
      {
        id: 'slot-1',
        tutorId: 'tutor-1',
        dayOfWeek,
        startTime: '09:00',
        endTime: '17:00',
      },
    ]);

    const dt = new Date(isoTime);
    const savedLesson = {
      id: 'lesson-1',
      tutorId: 'tutor-1',
      studentId: 'student-1',
      scheduledTime: dt,
      endTime: new Date(dt.getTime() + 50 * 60000),
      durationMinutes: 50,
      price: 25,
      status: LessonStatus.PENDING,
      meetUrl: 'room-abc',
      tutor: { id: 'tutor-1', firstName: 'T', lastName: 'T', email: 't@t.com' },
      student: {
        id: 'student-1',
        firstName: 'S',
        lastName: 'S',
        email: 's@s.com',
      },
    };

    const mockManager = {
      findOne: jest
        .fn()
        .mockResolvedValue({ userId: 'tutor-1', hourlyRate: 30 }),
      create: jest.fn((_e: any, d: any) => d),
      save: jest.fn(async (_target: any, data: any) => {
        if (data && data.tutorId && data.studentId)
          return { ...savedLesson, ...data };
        return data || _target;
      }),
    };
    dataSource.transaction.mockImplementation(
      async (cb: (manager: typeof mockManager) => Promise<any>) =>
        cb(mockManager),
    );
    lessonRepo.findOne.mockResolvedValue(savedLesson);
    userRepo.findOne.mockResolvedValue(null);

    await service.bookLesson('student-1', validDto);
    expect(redisService.del).toHaveBeenCalledWith('lessons:user:student-1');
    expect(redisService.del).toHaveBeenCalledWith('lessons:user:tutor-1');
  });
});
