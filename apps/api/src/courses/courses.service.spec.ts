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
    {} as never,
    {} as never,
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

describe('CoursesService secure overview videos', () => {
  const courseRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
  };
  const bunnyService = {
    uploadVideo: jest.fn(),
    deleteVideo: jest.fn(),
    addCaption: jest.fn(),
    deleteCaption: jest.fn(),
    getVideoStatus: jest.fn(),
    generateEmbedUrl: jest.fn(),
  };
  const service = new CoursesService(
    courseRepository as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    { get: jest.fn().mockReturnValue('secret') } as never,
    {} as never,
    bunnyService as never,
  );
  const mp4 = Buffer.concat([
    Buffer.from([0, 0, 0, 24]),
    Buffer.from('ftyp'),
    Buffer.from('isom0000'),
  ]);

  beforeEach(() => {
    jest.clearAllMocks();
    courseRepository.findOne.mockResolvedValue({
      id: 'course-1',
      tutorId: 'tutor-1',
      isDraft: true,
      overviewVideoId: 'old-video',
      overviewCaptionLanguages: ['en'],
      previewVideoUrl: 'https://legacy.example/video.mp4',
    });
    courseRepository.save.mockImplementation(async (course) => course);
    bunnyService.uploadVideo.mockResolvedValue({
      videoId: 'new-video',
      status: 'processing',
    });
    bunnyService.deleteVideo.mockResolvedValue(undefined);
  });

  it('replaces the database asset before cleaning up the old remote video', async () => {
    await expect(
      service.uploadOwnedCourseMedia('tutor-1', 'course-1', 'preview', {
        buffer: mp4,
        mimetype: 'video/mp4',
        size: mp4.length,
      }),
    ).resolves.toEqual({
      kind: 'preview',
      courseId: 'course-1',
      videoId: 'new-video',
      status: 'processing',
      captions: [],
    });

    expect(courseRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'course-1', tutorId: 'tutor-1' },
    });
    expect(courseRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        overviewVideoId: 'new-video',
        overviewCaptionLanguages: null,
        previewVideoUrl: null,
      }),
    );
    expect(bunnyService.deleteVideo).toHaveBeenCalledWith('old-video');
    expect(courseRepository.save.mock.invocationCallOrder[0]).toBeLessThan(
      bunnyService.deleteVideo.mock.invocationCallOrder[0],
    );
  });

  it('keeps the previous database asset when the replacement upload fails', async () => {
    bunnyService.uploadVideo.mockRejectedValue(new Error('provider failed'));

    await expect(
      service.uploadOwnedCourseMedia('tutor-1', 'course-1', 'preview', {
        buffer: mp4,
        mimetype: 'video/mp4',
        size: mp4.length,
      }),
    ).rejects.toThrow('provider failed');
    expect(courseRepository.save).not.toHaveBeenCalled();
    expect(bunnyService.deleteVideo).not.toHaveBeenCalled();
  });

  it('rejects a spoofed video before contacting storage', async () => {
    await expect(
      service.uploadOwnedCourseMedia('tutor-1', 'course-1', 'preview', {
        buffer: Buffer.from('not a video'),
        mimetype: 'video/mp4',
        size: 11,
      }),
    ).rejects.toThrow('not a valid video');
    expect(bunnyService.uploadVideo).not.toHaveBeenCalled();
  });

  it('restores the course reference when remote deletion fails', async () => {
    bunnyService.deleteVideo.mockRejectedValue(new Error('provider failed'));

    await expect(
      service.deleteOwnedCourseOverview('tutor-1', 'course-1'),
    ).rejects.toThrow('provider failed');
    expect(courseRepository.save).toHaveBeenCalledTimes(2);
    expect(courseRepository.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        overviewVideoId: 'old-video',
        overviewCaptionLanguages: ['en'],
      }),
    );
  });

  it('returns expiring playback only for an approved public course', async () => {
    courseRepository.findOne.mockResolvedValue({
      id: 'course-1',
      status: CourseStatus.APPROVED,
      isDraft: false,
      overviewVideoId: 'video-1',
    });
    bunnyService.getVideoStatus.mockResolvedValue({
      status: 'ready',
      durationSeconds: 60,
      captions: [{ language: 'ar', label: 'العربية' }],
    });
    bunnyService.generateEmbedUrl.mockReturnValue({
      url: 'https://player.mediadelivery.net/embed/library/video-1?token=x',
      expiresAt: 123,
    });

    await expect(service.getPublicCourseOverview('course-1')).resolves.toEqual({
      status: 'ready',
      embedUrl:
        'https://player.mediadelivery.net/embed/library/video-1?token=x',
      expiresAt: 123,
      durationSeconds: 60,
      captions: [{ language: 'ar', label: 'العربية' }],
    });
    expect(courseRepository.findOne).toHaveBeenCalledWith({
      where: {
        id: 'course-1',
        status: CourseStatus.APPROVED,
        isDraft: false,
      },
    });
  });
});
