import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { CourseStatus, LessonStatus } from '@mrh/types';
import { ReviewsService } from './reviews.service.js';

describe('ReviewsService', () => {
  const studentId = 'student-id';
  const lesson = {
    id: 'lesson-id',
    studentId,
    tutorId: 'tutor-id',
    status: LessonStatus.COMPLETED,
  };

  const makeService = (overrides?: {
    lesson?: Partial<typeof lesson> | null;
    saveError?: unknown;
  }) => {
    const lessonRepository = {
      findOne: jest.fn().mockResolvedValue(
        overrides?.lesson === null
          ? null
          : { ...lesson, ...(overrides?.lesson ?? {}) },
      ),
    };
    const reviewRepository = {
      create: jest.fn((review) => review),
      save: jest.fn(async (review) => {
        if (overrides?.saveError) {
          throw overrides.saveError;
        }
        return { id: 'review-id', ...review };
      }),
      find: jest.fn(),
      findOne: jest.fn(),
    };

    const service = new ReviewsService(
      reviewRepository as never,
      lessonRepository as never,
    );

    return { service, lessonRepository, reviewRepository };
  };

  it('creates a pending review for the completed lesson owner', async () => {
    const { service, reviewRepository } = makeService();

    await expect(
      service.create(studentId, { lessonId: lesson.id, rating: 5 }),
    ).resolves.toMatchObject({
      studentId,
      tutorId: lesson.tutorId,
      lessonId: lesson.id,
      rating: 5,
      comment: null,
      status: CourseStatus.PENDING,
    });

    expect(reviewRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ lessonId: lesson.id, status: CourseStatus.PENDING }),
    );
  });

  it('rejects reviews for lessons that are not completed', async () => {
    const { service } = makeService({
      lesson: { status: LessonStatus.CONFIRMED },
    });

    await expect(
      service.create(studentId, { lessonId: lesson.id, rating: 5 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects reviews for another student lesson', async () => {
    const { service } = makeService({ lesson: { studentId: 'other-student' } });

    await expect(
      service.create(studentId, { lessonId: lesson.id, rating: 5 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('turns duplicate lesson review database errors into conflicts', async () => {
    const { service } = makeService({ saveError: { code: '23505' } });

    await expect(
      service.create(studentId, { lessonId: lesson.id, rating: 5 }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
