import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'node:crypto';

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
      url: `https://iframe.mediadelivery.net/embed/${this.libraryId}/${videoId}?token=${token}&expires=${expiresAt}`,
      expiresAt,
    };
  }

  async getVideoInfo(videoId: string): Promise<any> {
    if (!this.apiKey) return { id: videoId, status: 'mock' };
    const response = await fetch(
      `https://video.bunnycdn.com/library/${this.libraryId}/videos/${videoId}`,
      {
        headers: { Accept: 'application/json', AccessKey: this.apiKey },
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!response.ok) return { id: videoId, status: 'error' };
    return response.json();
  }
}
