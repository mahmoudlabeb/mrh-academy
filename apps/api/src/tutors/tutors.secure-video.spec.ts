import { CourseStatus } from '@mrh/types';
import { TutorsService } from './tutors.service.js';

describe('TutorsService secure introduction videos', () => {
  const tutorRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
  };
  const redis = {
    delPattern: jest.fn(),
  };
  const bunny = {
    uploadVideo: jest.fn(),
    deleteVideo: jest.fn(),
    addCaption: jest.fn(),
    deleteCaption: jest.fn(),
    getVideoStatus: jest.fn(),
    generateEmbedUrl: jest.fn(),
  };
  const service = new TutorsService(
    tutorRepository as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    redis as never,
    {} as never,
    {} as never,
    bunny as never,
  );
  const mp4 = Buffer.concat([
    Buffer.from([0, 0, 0, 24]),
    Buffer.from('ftyp'),
    Buffer.from('isom0000'),
  ]);

  beforeEach(() => {
    jest.clearAllMocks();
    tutorRepository.findOne.mockResolvedValue({
      userId: 'tutor-1',
      status: CourseStatus.APPROVED,
      introVideoId: 'old-video',
      introCaptionLanguages: ['en'],
      videoUrl: 'https://legacy.example/video.mp4',
    });
    tutorRepository.save.mockImplementation(async (profile) => profile);
    bunny.uploadVideo.mockResolvedValue({
      videoId: 'new-video',
      status: 'processing',
    });
    bunny.deleteVideo.mockResolvedValue(undefined);
  });

  it('replaces a tutor introduction atomically and clears legacy delivery', async () => {
    await expect(
      service.uploadProfileVideo('tutor-1', {
        buffer: mp4,
        mimetype: 'video/mp4',
        size: mp4.length,
      } as Express.Multer.File),
    ).resolves.toEqual({
      videoId: 'new-video',
      status: 'processing',
      captions: [],
    });

    expect(tutorRepository.findOne).toHaveBeenCalledWith({
      where: { userId: 'tutor-1' },
    });
    expect(tutorRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        introVideoId: 'new-video',
        introCaptionLanguages: null,
        videoUrl: null,
      }),
    );
    expect(bunny.deleteVideo).toHaveBeenCalledWith('old-video');
    expect(redis.delPattern).toHaveBeenCalledWith('tutors:*');
  });

  it('removes the newly uploaded asset when saving its reference fails', async () => {
    tutorRepository.save.mockRejectedValue(new Error('database unavailable'));

    await expect(
      service.uploadProfileVideo('tutor-1', {
        buffer: mp4,
        mimetype: 'video/mp4',
        size: mp4.length,
      } as Express.Multer.File),
    ).rejects.toThrow('database unavailable');
    expect(bunny.deleteVideo).toHaveBeenCalledWith('new-video');
    expect(bunny.deleteVideo).not.toHaveBeenCalledWith('old-video');
  });

  it('restores the tutor reference when remote deletion fails', async () => {
    bunny.deleteVideo.mockRejectedValue(new Error('provider failed'));

    await expect(service.deleteProfileVideo('tutor-1')).rejects.toThrow(
      'provider failed',
    );
    expect(tutorRepository.save).toHaveBeenCalledTimes(2);
    expect(tutorRepository.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        introVideoId: 'old-video',
        introCaptionLanguages: ['en'],
      }),
    );
  });

  it('serves a short-lived player only from an approved public profile', async () => {
    bunny.getVideoStatus.mockResolvedValue({
      status: 'ready',
      durationSeconds: 42,
      captions: [{ language: 'en', label: 'English' }],
    });
    bunny.generateEmbedUrl.mockReturnValue({
      url: 'https://player.mediadelivery.net/embed/library/new-video?token=x',
      expiresAt: 456,
    });

    await expect(service.getPublicProfileVideo('tutor-1')).resolves.toEqual({
      status: 'ready',
      embedUrl:
        'https://player.mediadelivery.net/embed/library/new-video?token=x',
      expiresAt: 456,
      durationSeconds: 42,
      captions: [{ language: 'en', label: 'English' }],
    });
    expect(tutorRepository.findOne).toHaveBeenCalledWith({
      where: { userId: 'tutor-1', status: CourseStatus.APPROVED },
    });
  });
});
