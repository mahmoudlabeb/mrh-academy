import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'node:crypto';

export type BunnyVideoStatus =
  'created' | 'uploaded' | 'processing' | 'ready' | 'failed';

type BunnyVideoResponse = {
  guid?: string;
  videoId?: string;
  status?: number;
  title?: string;
  length?: number;
  availableResolutions?: string;
  captions?: Array<{ srclang?: string; label?: string }>;
};

@Injectable()
export class BunnyService {
  private readonly apiKey: string;
  private readonly libraryId: string;
  private readonly cdnHostname: string;
  private readonly tokenSecurityKey: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('BUNNY_API_KEY', '');
    this.libraryId = this.configService.get<string>('BUNNY_LIBRARY_ID', '');
    this.cdnHostname = this.configService.get<string>('BUNNY_CDN_HOSTNAME', '');
    this.tokenSecurityKey = this.configService.get<string>(
      'BUNNY_TOKEN_AUTH_KEY',
      '',
    );
  }

  private ensureConfigured() {
    if (!this.apiKey || !this.libraryId) {
      throw new ServiceUnavailableException(
        'Secure video storage is not configured',
      );
    }
  }

  private videoUrl(videoId?: string) {
    const suffix = videoId
      ? `/videos/${encodeURIComponent(videoId)}`
      : '/videos';
    return `https://video.bunnycdn.com/library/${encodeURIComponent(this.libraryId)}${suffix}`;
  }

  private async request(
    url: string,
    init: RequestInit,
    errorMessage: string,
  ): Promise<Response> {
    this.ensureConfigured();
    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        headers: {
          Accept: 'application/json',
          AccessKey: this.apiKey,
          ...init.headers,
        },
        signal: AbortSignal.timeout(60_000),
      });
    } catch {
      throw new BadGatewayException(errorMessage);
    }
    if (!response.ok) {
      throw new BadGatewayException(errorMessage);
    }
    return response;
  }

  async uploadVideo(
    buffer: Buffer,
    title: string,
  ): Promise<{ videoId: string; status: BunnyVideoStatus }> {
    const created = (await (
      await this.request(
        this.videoUrl(),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: title.slice(0, 200) }),
        },
        'Could not create the secure video upload',
      )
    ).json()) as BunnyVideoResponse;
    const videoId = created.guid ?? created.videoId;
    if (!videoId) {
      throw new BadGatewayException(
        'Secure video storage returned an invalid upload',
      );
    }

    try {
      await this.request(
        this.videoUrl(videoId),
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: new Uint8Array(buffer),
        },
        'Could not finish the secure video upload',
      );
    } catch (error) {
      await this.deleteVideo(videoId).catch(() => undefined);
      throw error;
    }

    return { videoId, status: 'processing' };
  }

  async deleteVideo(videoId: string): Promise<void> {
    await this.request(
      this.videoUrl(videoId),
      { method: 'DELETE' },
      'Could not delete the secure video',
    );
  }

  async addCaption(
    videoId: string,
    language: string,
    label: string,
    captions: Buffer,
  ): Promise<void> {
    await this.request(
      `${this.videoUrl(videoId)}/captions/${encodeURIComponent(language)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          srclang: language,
          label: label.slice(0, 100),
          captionsFile: captions.toString('base64'),
        }),
      },
      'Could not upload the video captions',
    );
  }

  async deleteCaption(videoId: string, language: string): Promise<void> {
    await this.request(
      `${this.videoUrl(videoId)}/captions/${encodeURIComponent(language)}`,
      { method: 'DELETE' },
      'Could not delete the video captions',
    );
  }

  generateSignedUrl(videoId: string, expirySeconds = 900): string {
    if (!this.cdnHostname || !this.tokenSecurityKey) {
      throw new ServiceUnavailableException(
        'Bunny Stream token authentication is not configured',
      );
    }
    const expires = Math.floor(Date.now() / 1000) + expirySeconds;
    const tokenPath = `/${videoId}/`;
    const signingData = `token_path=${encodeURIComponent(tokenPath)}`;
    const signature = crypto
      .createHmac('sha256', this.tokenSecurityKey)
      .update(`${tokenPath}${expires}${signingData}`)
      .digest('base64url');
    return `https://${this.cdnHostname}/bcdn_token=HS256-${signature}&expires=${expires}&${signingData}${tokenPath}playlist.m3u8`;
  }

  generateEmbedUrl(
    videoId: string,
    expirySeconds = 900,
  ): { url: string; expiresAt: number } {
    if (!this.libraryId || !this.tokenSecurityKey) {
      throw new ServiceUnavailableException(
        'Bunny Stream embed token authentication is not configured',
      );
    }
    const expiresAt = Math.floor(Date.now() / 1000) + expirySeconds;
    const token = crypto
      .createHash('sha256')
      .update(`${this.tokenSecurityKey}${videoId}${expiresAt}`)
      .digest('hex');
    return {
      url: `https://player.mediadelivery.net/embed/${this.libraryId}/${videoId}?token=${token}&expires=${expiresAt}&autoplay=false&preload=false&responsive=true`,
      expiresAt,
    };
  }

  async getVideoInfo(videoId: string): Promise<BunnyVideoResponse> {
    return (await (
      await this.request(
        this.videoUrl(videoId),
        { method: 'GET' },
        'Could not read the secure video status',
      )
    ).json()) as BunnyVideoResponse;
  }

  async getVideoStatus(videoId: string): Promise<{
    status: BunnyVideoStatus;
    durationSeconds: number | null;
    captions: Array<{ language: string; label: string }>;
  }> {
    const video = await this.getVideoInfo(videoId);
    const numericStatus = video.status ?? 0;
    const status: BunnyVideoStatus =
      numericStatus === 4
        ? 'ready'
        : numericStatus >= 5
          ? 'failed'
          : numericStatus === 3 || numericStatus === 2
            ? 'processing'
            : numericStatus === 1
              ? 'uploaded'
              : 'created';
    return {
      status,
      durationSeconds:
        typeof video.length === 'number' && video.length >= 0
          ? video.length
          : null,
      captions: (video.captions ?? [])
        .filter((caption) => caption.srclang)
        .map((caption) => ({
          language: caption.srclang as string,
          label: caption.label || (caption.srclang as string),
        })),
    };
  }
}
