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

function futureDate(daysFromNow = 30): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(14, 30, 0, 0);
  return d.toISOString();
}

describe('B1 Bug Condition — Midnight Timestamp Truncation', () => {
  let service: LessonsService;
  let dataSource: { transaction: jest.Mock };
  let lessonRepo: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };
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
  let userRepo: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };

  function mockRepo() {
    return {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };
  }

  beforeEach(async () => {
    dataSource = { transaction: jest.fn() };
    lessonRepo = mockRepo();
    tutorRepo = mockRepo();
    availRepo = mockRepo();
    userRepo = mockRepo();

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
          useValue: { calculateLessonEarnings: jest.fn() },
        },
        {
          provide: CalendarService,
          useValue: {
            createLessonMeetLink: jest.fn(),
            deleteCalendarEvent: jest.fn(),
          },
        },
        {
          provide: EmailService,
          useValue: { sendEmail: jest.fn().mockResolvedValue({}) },
        },
        {
          provide: RedisService,
          useValue: {
            del: jest.fn().mockResolvedValue(1),
            set: jest.fn(),
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<LessonsService>(LessonsService);
  });

  it('should preserve the full ISO datetime (hours/minutes/seconds) when booking a lesson', async () => {
    const isoInput = futureDate();
    const dt = new Date(isoInput);

    tutorRepo.findOne.mockResolvedValue({
      userId: 'tutor-1',
      status: CourseStatus.APPROVED,
      hourlyRate: 30,
    });

    availRepo.find.mockResolvedValue([
      {
        id: 'slot-1',
        tutorId: 'tutor-1',
        dayOfWeek: dt.getDay(),
        startTime: '09:00',
        endTime: '17:00',
      },
    ]);

    const finalLesson = {
      id: 'lesson-1',
      tutorId: 'tutor-1',
      studentId: 'student-1',
      scheduledTime: dt,
      endTime: new Date(dt.getTime() + 50 * 60000),
      durationMinutes: 50,
      price: 25,
      status: LessonStatus.PENDING,
      meetUrl: 'room-abc',
      createdAt: new Date(),
      platformFee: 0,
      tutor: {
        id: 'tutor-1',
        firstName: 'T',
        lastName: 'T',
        email: 't@t.com',
        avatarUrl: null,
      },
      student: {
        id: 'student-1',
        firstName: 'S',
        lastName: 'S',
        email: 's@s.com',
        avatarUrl: null,
      },
      googleMeetUrl: null,
      notes: null,
    };

    const mockQueryBuilder = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    };
    const mockManager = {
      findOne: jest
        .fn()
        .mockResolvedValue({ userId: 'tutor-1', hourlyRate: 30 }),
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      create: jest.fn((_cls: any, data: any) => data),
      save: jest.fn(async (_target: any, data: any) => {
        if (data && data.tutorId && data.studentId) {
          return { ...finalLesson, ...data };
        }
        if (data && data.lessonId) {
          return data;
        }
        return data || _target;
      }),
    };
    dataSource.transaction.mockImplementation(
      async (cb: (manager: typeof mockManager) => Promise<any>) =>
        cb(mockManager),
    );
    lessonRepo.findOne.mockResolvedValue(finalLesson);
    userRepo.findOne.mockResolvedValue(null);

    const result = await service.bookLesson('student-1', {
      tutorId: 'tutor-1',
      scheduledTime: isoInput,
      durationMinutes: 50,
    });

    expect(result!.scheduledTime.getUTCHours()).not.toBe(0);
    expect(result!.scheduledTime.getUTCMinutes()).not.toBe(0);
    expect(result!.scheduledTime.toISOString()).toBe(isoInput);
    expect(result!.endTime.getTime()).toBe(
      result!.scheduledTime.getTime() + 50 * 60000,
    );
  });
});
