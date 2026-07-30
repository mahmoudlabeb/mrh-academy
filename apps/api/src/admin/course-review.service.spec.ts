import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { CourseLifecycleStatus } from '@mrh/types';
import { CourseReviewService } from './course-review.service.js';

describe('CourseReviewService', () => {
  const courseRepository = { find: jest.fn(), findOne: jest.fn() };
  const sectionRepository = { find: jest.fn() };
  const lessonRepository = { find: jest.fn() };
  const notificationRepository = {
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => value),
  };
  const manager = {
    findOne: jest.fn(),
    save: jest.fn(async (_entity, value) => value),
    create: jest.fn((_entity, value) => value),
  };
  const dataSource = {
    transaction: jest.fn(async (work) => work(manager)),
  };
  const bunnyService = {
    getVideoStatus: jest.fn(),
    generateEmbedUrl: jest.fn(),
  };
  const service = new CourseReviewService(
    courseRepository as never,
    sectionRepository as never,
    lessonRepository as never,
    notificationRepository as never,
    dataSource as never,
    bunnyService as never,
  );

  const pendingCourse = {
    id: 'course-1',
    tutorId: 'tutor-1',
    title: 'Professional Arabic',
    courseType: 'recorded',
    status: CourseLifecycleStatus.PENDING_REVIEW,
    isDraft: false,
    reviewedBy: null,
    reviewedAt: null,
    reviewDecision: null,
    reviewNote: null,
    videoQualityApprovedAt: null,
    videoQualityApprovedBy: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    manager.findOne.mockResolvedValue({ ...pendingCourse });
  });

  it('approves only a pending submission and stores audit data', async () => {
    const result = await service.approve('course-1', 'admin-1', {
      note: 'Ready for students',
      videoQualityApproved: true,
    });

    expect(result).toEqual(
      expect.objectContaining({
        status: CourseLifecycleStatus.ACTIVE,
        reviewedBy: 'admin-1',
        reviewDecision: 'approved',
        reviewNote: 'Ready for students',
      }),
    );
    expect(manager.create).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        adminId: 'admin-1',
        targetUserId: 'tutor-1',
        action: 'course_submission_approved',
      }),
    );
    expect(notificationRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'tutor-1',
        type: 'course_submission_approved',
      }),
    );
  });

  it('requires a reason when rejecting a submission', async () => {
    await expect(
      service.reject('course-1', 'admin-1', '  '),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rejects invalid repeated review transitions', async () => {
    manager.findOne.mockResolvedValue({
      ...pendingCourse,
      status: CourseLifecycleStatus.ACTIVE,
    });

    await expect(
      service.approve('course-1', 'admin-1', {}),
    ).rejects.toThrow('Only pending submissions can be reviewed');
  });

  it('prevents a tutor from reviewing their own submission', async () => {
    await expect(
      service.approve('course-1', 'tutor-1', {}),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
