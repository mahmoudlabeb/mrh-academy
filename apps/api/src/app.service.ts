import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from './redis/redis.service.js';

export type IntegrationStatus = {
  redis: 'ok' | 'degraded' | 'unconfigured';
  stripe: 'configured' | 'unconfigured';
  bunny: 'configured' | 'unconfigured';
  gemini: 'configured' | 'unconfigured';
  googleOAuth: 'configured' | 'unconfigured';
  cloudinary: 'configured' | 'unconfigured';
};

@Injectable()
export class AppService {
  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  getHello(): string {
    return 'Hello World!';
  }

  async getIntegrationStatus(): Promise<IntegrationStatus> {
    let redis: IntegrationStatus['redis'] = 'degraded';
    if (this.redisService.connected) {
      try {
        const pong = await this.redisService.redis.ping();
        redis = pong === 'PONG' ? 'ok' : 'degraded';
      } catch {
        redis = 'degraded';
      }
    }

    const has = (key: string) => Boolean(this.configService.get<string>(key));

    return {
      redis,
      stripe: has('STRIPE_SECRET_KEY') ? 'configured' : 'unconfigured',
      bunny:
        has('BUNNY_API_KEY') && has('BUNNY_CDN_HOSTNAME')
          ? 'configured'
          : 'unconfigured',
      gemini: has('GEMINI_API_KEY') ? 'configured' : 'unconfigured',
      googleOAuth:
        has('GOOGLE_CLIENT_ID') && has('GOOGLE_CLIENT_SECRET')
          ? 'configured'
          : 'unconfigured',
      cloudinary:
        has('CLOUDINARY_CLOUD_NAME') &&
        has('CLOUDINARY_API_KEY') &&
        has('CLOUDINARY_API_SECRET')
          ? 'configured'
          : 'unconfigured',
    };
  }
}
