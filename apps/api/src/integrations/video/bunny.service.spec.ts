import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BunnyService } from './bunny.service.js';

describe('BunnyService', () => {
  const configuredValues: Record<string, string> = {
    BUNNY_API_KEY: 'api-key',
    BUNNY_LIBRARY_ID: 'library-1',
    BUNNY_CDN_HOSTNAME: 'cdn.example.test',
    BUNNY_TOKEN_AUTH_KEY: 'token-key',
  };

  const createService = (values: Record<string, string> = configuredValues) =>
    new BunnyService({
      get: jest.fn((key: string, fallback = '') => values[key] ?? fallback),
    } as unknown as ConfigService);

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('refuses unsigned playback URLs when token authentication is absent', () => {
    const service = createService({});

    expect(() => service.generateSignedUrl('video-1')).toThrow(
      ServiceUnavailableException,
    );
    expect(() => service.generateEmbedUrl('video-1')).toThrow(
      ServiceUnavailableException,
    );
  });

  it('generates expiring signed CDN and embed URLs', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-29T12:00:00Z'));
    const service = createService();

    const signedUrl = new URL(service.generateSignedUrl('video-1', 600));
    const embed = service.generateEmbedUrl('video-1', 600);
    const embedUrl = new URL(embed.url);

    expect(signedUrl.hostname).toBe('cdn.example.test');
    expect(signedUrl.pathname).toContain('/video-1/playlist.m3u8');
    expect(signedUrl.pathname).toContain('bcdn_token=HS256-');
    expect(signedUrl.pathname).toContain('&expires=1785327000&');
    expect(embedUrl.hostname).toBe('iframe.mediadelivery.net');
    expect(embedUrl.pathname).toBe('/embed/library-1/video-1');
    expect(embedUrl.searchParams.get('token')).toMatch(/^[a-f0-9]{64}$/);
    expect(embed.expiresAt).toBe(1785327000);
  });

  it('uses authenticated, time-bounded requests for video metadata', async () => {
    const response = {
      ok: true,
      json: jest.fn(async () => ({ guid: 'video-1', status: 4 })),
    };
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(response as unknown as Response);

    await expect(createService().getVideoInfo('video-1')).resolves.toEqual({
      guid: 'video-1',
      status: 4,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://video.bunnycdn.com/library/library-1/videos/video-1',
      expect.objectContaining({
        headers: {
          Accept: 'application/json',
          AccessKey: 'api-key',
        },
        signal: expect.any(AbortSignal),
      }),
    );
  });
});
