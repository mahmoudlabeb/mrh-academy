import { ForbiddenException } from '@nestjs/common';
import { CourseLifecycleStatus, CourseStatus } from '@mrh/types';
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
      status: CourseLifecycleStatus.DRAFT,
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
  const lessonRepository = {
    find: jest.fn(),
  };
  const service = new CoursesService(
    courseRepository as never,
    {} as never,
    lessonRepository as never,
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
      status: CourseLifecycleStatus.ACTIVE,
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
        status: CourseLifecycleStatus.ACTIVE,
        isDraft: false,
      },
    });
  });

  it('publishes curriculum metadata without exposing protected material URLs', async () => {
    courseRepository.findOne.mockResolvedValue({
      id: 'course-1',
      status: CourseLifecycleStatus.ACTIVE,
      isDraft: false,
    });
    lessonRepository.find.mockResolvedValue([
      {
        id: 'lesson-1',
        title: 'Introductions',
        description: 'Course outline',
        contentType: 'video',
        durationMinutes: 20,
        lessonOrder: 1,
        isPreview: false,
      },
    ]);

    await service.findPublicCurriculum('course-1');

    expect(lessonRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          title: true,
          contentType: true,
          durationMinutes: true,
        }),
      }),
    );
    expect(lessonRepository.find.mock.calls[0][0].select).not.toHaveProperty(
      'videoAssetId',
    );
    expect(lessonRepository.find.mock.calls[0][0].select).not.toHaveProperty(
      'resourceUrl',
    );
  });
});

describe('CoursesService professional authoring workflow', () => {
  const courseRepository = {
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => ({ id: value.id ?? 'course-1', ...value })),
    findOne: jest.fn(),
  };
  const lessonRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    maximum: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => ({ id: value.id ?? 'lesson-1', ...value })),
    update: jest.fn(),
    delete: jest.fn(),
    remove: jest.fn(),
  };
  const sectionRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    maximum: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn(async (value) =>
      Array.isArray(value) ? value : { id: value.id ?? 'section-1', ...value },
    ),
    delete: jest.fn(),
  };
  const tutorProfileRepository = {
    findOne: jest.fn(),
  };
  const storage = {
    upload: jest.fn(),
    destroy: jest.fn(),
    signedUrl: jest.fn(),
  };
  const bunnyService = {
    uploadVideo: jest.fn(),
    deleteVideo: jest.fn(),
    addCaption: jest.fn(),
    deleteCaption: jest.fn(),
    getVideoStatus: jest.fn(),
    generateEmbedUrl: jest.fn(),
  };
  const notificationRepository = {
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => value),
  };
  const service = new CoursesService(
    courseRepository as never,
    {} as never,
    lessonRepository as never,
    sectionRepository as never,
    {} as never,
    tutorProfileRepository as never,
    {} as never,
    {} as never,
    {} as never,
    { get: jest.fn().mockReturnValue('studio-secret') } as never,
    storage as never,
    bunnyService as never,
    notificationRepository as never,
  );
  const completeCourse = {
    id: 'course-1',
    tutorId: 'tutor-1',
    title: 'Arabic conversation for confident beginners',
    subtitle: 'Build practical confidence through guided Arabic conversations',
    description:
      'A practical Arabic course with guided conversations, focused exercises, useful vocabulary, and clear progress milestones for independent learners.',
    category: 'languages',
    language: 'Arabic',
    level: 'beginner',
    price: 39,
    courseType: 'recorded' as const,
    thumbnailUrl: 'https://cdn.example/cover.jpg',
    thumbnailPublicId: 'cover-id',
    overviewVideoId: 'promo-video',
    previewVideoUrl: null,
    learningOutcomes: ['Hold an everyday Arabic conversation'],
    requirements: ['No prior experience is required'],
    targetAudience: ['Beginner Arabic learners'],
    capacity: null,
    cohortStartAt: null,
    cohortEndAt: null,
    isDraft: true,
    status: CourseLifecycleStatus.DRAFT,
    submittedAt: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    storage.destroy.mockResolvedValue(undefined);
    storage.signedUrl.mockReturnValue('https://cdn.example/signed-resource');
    tutorProfileRepository.findOne.mockResolvedValue({
      userId: 'tutor-1',
      status: CourseStatus.APPROVED,
    });
    courseRepository.findOne.mockResolvedValue({ ...completeCourse });
    sectionRepository.find.mockResolvedValue([
      {
        id: 'section-1',
        courseId: 'course-1',
        title: 'Foundations',
        sectionOrder: 1,
      },
    ]);
    sectionRepository.findOne.mockResolvedValue({
      id: 'section-1',
      courseId: 'course-1',
      title: 'Foundations',
      sectionOrder: 1,
    });
    sectionRepository.maximum.mockResolvedValue(0);
    lessonRepository.find.mockResolvedValue([
      {
        id: 'lesson-1',
        courseId: 'course-1',
        sectionId: 'section-1',
        title: 'Welcome',
        contentType: 'video',
        videoUrl: 'https://video.example/welcome',
        videoAssetId: null,
        durationMinutes: 10,
        lessonOrder: 1,
        downloadableFiles: [],
        externalLinks: [],
      },
    ]);
    lessonRepository.maximum.mockResolvedValue(0);
  });

  it('creates a persistent course draft for an approved tutor', async () => {
    const draft = await service.createDraft('tutor-1', 'recorded');

    expect(courseRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tutorId: 'tutor-1',
        isDraft: true,
        courseType: 'recorded',
      }),
    );
    expect(draft.id).toBe('course-1');
  });

  it('saves course basics and pricing on an owned draft', async () => {
    await service.updateOwnedCourse('tutor-1', 'course-1', {
      title: completeCourse.title,
      subtitle: completeCourse.subtitle,
      description: completeCourse.description,
      category: 'languages',
      language: 'Arabic',
      level: 'beginner',
      price: 49,
    });

    expect(courseRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        title: completeCourse.title,
        category: 'languages',
        price: 49,
      }),
    );
  });

  it('adds curriculum sections and lessons with video URLs', async () => {
    const section = await service.addSection('tutor-1', 'course-1', {
      title: 'Foundations',
    });
    const lesson = await service.addLesson('tutor-1', 'course-1', {
      sectionId: 'section-1',
      title: 'Welcome lesson',
      contentType: 'video',
      videoUrl: 'https://video.example/welcome',
      durationMinutes: 8,
    });

    expect(section).toEqual(expect.objectContaining({ title: 'Foundations' }));
    expect(lesson).toEqual(
      expect.objectContaining({
        sectionId: 'section-1',
        videoUrl: 'https://video.example/welcome',
      }),
    );
  });

  it('uploads and attaches a validated course cover', async () => {
    storage.upload.mockResolvedValue({
      publicId: 'new-cover',
      secureUrl: 'https://cdn.example/new-cover.webp',
    });

    const result = await service.uploadOwnedCourseMedia(
      'tutor-1',
      'course-1',
      'cover',
      {
        buffer: Buffer.from('cover'),
        mimetype: 'image/webp',
        size: 1024,
      },
    );

    expect(result).toEqual(
      expect.objectContaining({
        url: 'https://cdn.example/new-cover.webp',
        publicId: 'new-cover',
      }),
    );
    expect(courseRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        thumbnailUrl: 'https://cdn.example/new-cover.webp',
        thumbnailPublicId: 'new-cover',
      }),
    );
  });

  it('rejects submission while required course data is incomplete', async () => {
    courseRepository.findOne.mockResolvedValue({
      ...completeCourse,
      subtitle: '',
      thumbnailUrl: null,
      overviewVideoId: null,
      learningOutcomes: [],
    });
    sectionRepository.find.mockResolvedValue([]);
    lessonRepository.find.mockResolvedValue([]);

    await expect(
      service.submitForReview('tutor-1', 'course-1'),
    ).rejects.toThrow('Course is not ready for review');
  });

  it('submits a complete course for publishing review', async () => {
    const submitted = await service.submitForReview('tutor-1', 'course-1');

    expect(courseRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        isDraft: false,
        status: CourseLifecycleStatus.PENDING_REVIEW,
        submittedAt: expect.any(Date),
      }),
    );
    expect(submitted.message).toBe('Course submitted for academy review');
    expect(notificationRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'tutor-1',
        type: 'course_submission_received',
      }),
    );
  });

  it('returns a rejected course to draft before editing and resubmission', async () => {
    courseRepository.findOne.mockResolvedValue({
      ...completeCourse,
      isDraft: false,
      status: CourseLifecycleStatus.REJECTED,
      submittedAt: new Date(),
      reviewNote: 'Clarify the learning outcomes',
    });

    await expect(
      service.reviseRejectedCourse('tutor-1', 'course-1'),
    ).resolves.toEqual(
      expect.objectContaining({
        status: CourseLifecycleStatus.DRAFT,
        isDraft: true,
        submittedAt: null,
      }),
    );
  });
});
