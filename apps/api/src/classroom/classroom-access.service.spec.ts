import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ClassroomAccessState,
  LessonPaymentStatus,
  LessonStatus,
} from '@mrh/types';
import { ClassroomAccessService } from './classroom-access.service';
import { Classroom } from './entities/classroom.entity';
import { Lesson } from '../lessons/entities/lesson.entity';

describe('ClassroomAccessService', () => {
  let service: ClassroomAccessService;
  const lessonRepository = { findOne: jest.fn() };
  const classroomRepository = { findOne: jest.fn() };
  const now = new Date('2030-01-01T10:00:00.000Z');

  const lesson = (
    overrides: Partial<Lesson> = {},
  ): Pick<
    Lesson,
    | 'id'
    | 'studentId'
    | 'tutorId'
    | 'scheduledTime'
    | 'endTime'
    | 'durationMinutes'
    | 'status'
    | 'paymentStatus'
  > => ({
    id: 'lesson-1',
    studentId: 'student-1',
    tutorId: 'tutor-1',
    scheduledTime: new Date('2030-01-01T10:00:00.000Z'),
    endTime: new Date('2030-01-01T10:50:00.000Z'),
    durationMinutes: 50,
    status: LessonStatus.CONFIRMED,
    paymentStatus: LessonPaymentStatus.PAID,
    ...overrides,
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    classroomRepository.findOne.mockResolvedValue({
      lessonId: 'lesson-1',
      isActive: true,
    });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClassroomAccessService,
        {
          provide: getRepositoryToken(Lesson),
          useValue: lessonRepository,
        },
        {
          provide: getRepositoryToken(Classroom),
          useValue: classroomRepository,
        },
      ],
    }).compile();
    service = module.get(ClassroomAccessService);
  });

  it('allows the paid student and tutor during the lesson window', async () => {
    await expect(service.evaluate(lesson(), 'student-1', now)).resolves.toEqual(
      expect.objectContaining({
        state: ClassroomAccessState.ALLOWED,
        canJoin: true,
      }),
    );
    await expect(service.evaluate(lesson(), 'tutor-1', now)).resolves.toEqual(
      expect.objectContaining({
        state: ClassroomAccessState.ALLOWED,
        canJoin: true,
      }),
    );
  });

  it('allows entry at both exact time-window boundaries', async () => {
    const value = lesson();

    await expect(
      service.evaluate(value, 'student-1', new Date('2030-01-01T09:45:00Z')),
    ).resolves.toEqual(expect.objectContaining({ canJoin: true }));
    await expect(
      service.evaluate(value, 'student-1', new Date('2030-01-01T11:05:00Z')),
    ).resolves.toEqual(expect.objectContaining({ canJoin: true }));
  });

  it('returns waiting before the classroom opens', async () => {
    await expect(
      service.evaluate(lesson(), 'student-1', new Date('2030-01-01T09:44:59Z')),
    ).resolves.toEqual(
      expect.objectContaining({
        state: ClassroomAccessState.WAITING,
        canJoin: false,
        opensAt: '2030-01-01T09:45:00.000Z',
      }),
    );
  });

  it('returns expired after the lesson grace window', async () => {
    await expect(
      service.evaluate(lesson(), 'student-1', new Date('2030-01-01T11:05:01Z')),
    ).resolves.toEqual(
      expect.objectContaining({
        state: ClassroomAccessState.EXPIRED,
        canJoin: false,
      }),
    );
  });

  it.each([
    [
      ClassroomAccessState.CANCELLED,
      {
        status: LessonStatus.CANCELLED,
        paymentStatus: LessonPaymentStatus.REFUNDED,
      },
    ],
    [
      ClassroomAccessState.REFUNDED,
      { paymentStatus: LessonPaymentStatus.REFUNDED },
    ],
    [ClassroomAccessState.EXPIRED, { status: LessonStatus.COMPLETED }],
    [ClassroomAccessState.UNPAID, { paymentStatus: undefined }],
  ])('returns %s for an ineligible booking', async (state, overrides) => {
    await expect(
      service.evaluate(lesson(overrides as Partial<Lesson>), 'student-1', now),
    ).resolves.toEqual(
      expect.objectContaining({
        state,
        canJoin: false,
      }),
    );
  });

  it('requires an active classroom record', async () => {
    classroomRepository.findOne.mockResolvedValue(null);

    await expect(service.evaluate(lesson(), 'student-1', now)).resolves.toEqual(
      expect.objectContaining({
        state: ClassroomAccessState.CLOSED,
        canJoin: false,
      }),
    );
  });

  it('rejects users who do not own the booking before revealing its state', async () => {
    await expect(
      service.evaluate(lesson(), 'stranger-1', now),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(classroomRepository.findOne).not.toHaveBeenCalled();
  });

  it('returns not found for an unknown room', async () => {
    lessonRepository.findOne.mockResolvedValue(null);

    await expect(
      service.findByRoomId('missing-room', 'student-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
