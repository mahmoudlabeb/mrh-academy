import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'node:crypto';

@Injectable()
export class BunnyService {
  private readonly apiKey: string;
  private readonly libraryId: string;
  private readonly cdnHostname: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('BUNNY_API_KEY', '');
    this.libraryId = this.configService.get<string>('BUNNY_LIBRARY_ID', '');
    this.cdnHostname = this.configService.get<string>('BUNNY_CDN_HOSTNAME', '');
  }

  generateSignedUrl(videoId: string, expirySeconds = 3600): string {
    const expires = Math.floor(Date.now() / 1000) + expirySeconds;
    const url = `https://${this.cdnHostname}/${videoId}/playlist.m3u8`;
    const token = this.signUrl(url, expires, this.apiKey);
    return `${url}?token=${token}&expires=${expires}`;
  }

  private signUrl(url: string, expires: number, key: string): string {
    const hash = crypto
      .createHmac('sha256', key)
      .update(url + expires)
      .digest('hex');
    return hash;
  }

  async getVideoInfo(videoId: string): Promise<any> {
    if (!this.apiKey) return { id: videoId, status: 'mock' };
    const response = await fetch(
      `https://video.bunnycdn.com/library/${this.libraryId}/videos/${videoId}`,
      { headers: { Accept: 'application/json', AccessKey: this.apiKey } },
    );
    if (!response.ok) return { id: videoId, status: 'error' };
    return response.json();
  }
}
