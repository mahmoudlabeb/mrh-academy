import { ForbiddenException } from '@nestjs/common';
import { CourseStatus } from '@mrh/types';
import { CoursesService } from './courses.service.js';

describe('CoursesService course creation approval', () => {
  const courseRepository = {
    create: jest.fn(),
    save: jest.fn(),
  };
  const tutorProfileRepository = {
    findOne: jest.fn(),
  };
  const config = {
    get: jest.fn().mockReturnValue('test-referral-secret'),
  };

  const service = new CoursesService(
    courseRepository as never,
    {} as never,
    {} as never,
    {} as never,
    tutorProfileRepository as never,
    {} as never,
    {} as never,
    {} as never,
    config as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects course creation for a pending tutor', async () => {
    tutorProfileRepository.findOne.mockResolvedValue({
      userId: 'pending-tutor',
      status: CourseStatus.PENDING,
    });

    await expect(
      service.create('pending-tutor', {
        title: 'Pending course',
        description: 'Should not be created',
        price: 19,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(courseRepository.save).not.toHaveBeenCalled();
  });

  it('allows course creation for an approved tutor', async () => {
    tutorProfileRepository.findOne.mockResolvedValue({
      userId: 'approved-tutor',
      status: CourseStatus.APPROVED,
    });
    courseRepository.create.mockImplementation((value) => value);
    courseRepository.save.mockResolvedValue({
      id: 'course-id',
      tutorId: 'approved-tutor',
      title: 'Approved course',
      status: CourseStatus.PENDING,
    });

    const result = await service.create('approved-tutor', {
      title: 'Approved course',
      description: 'Allowed course',
      price: 19,
    });

    expect(courseRepository.save).toHaveBeenCalledTimes(1);
    expect(result.referralCode).toMatch(/^approved-tutor\.[a-f0-9]{16}$/);
  });
});
