import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';
import { Public } from '../auth/decorators/public.decorator.js';
import { RedisService } from '../redis/redis.service.js';

@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly database: TypeOrmHealthIndicator,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Get('live')
  liveness() {
    return { status: 'ok', service: 'mrh-academy-api' };
  }

  @Public()
  @Get()
  @HealthCheck()
  readiness() {
    return this.runReadinessChecks();
  }

  @Public()
  @Get('ready')
  @HealthCheck()
  ready() {
    return this.runReadinessChecks();
  }

  @Public()
  @Get('integrations')
  integrations() {
    const configured = (name: string) => Boolean(this.config.get<string>(name));
    return {
      status: 'ok',
      integrations: {
        redis: this.redis.connected ? 'ok' : 'degraded',
        stripe: configured('STRIPE_SECRET_KEY') ? 'configured' : 'unconfigured',
        bunny:
          configured('BUNNY_API_KEY') && configured('BUNNY_CDN_HOSTNAME')
            ? 'configured'
            : 'unconfigured',
        gemini: configured('GEMINI_API_KEY') ? 'configured' : 'unconfigured',
        googleOAuth:
          configured('GOOGLE_CLIENT_ID') && configured('GOOGLE_CLIENT_SECRET')
            ? 'configured'
            : 'unconfigured',
        facebookOAuth:
          configured('FACEBOOK_APP_ID') &&
          configured('FACEBOOK_APP_SECRET') &&
          configured('FACEBOOK_CALLBACK_URL')
            ? 'configured'
            : 'unconfigured',
        appleOAuth:
          configured('APPLE_CLIENT_ID') &&
          configured('APPLE_TEAM_ID') &&
          configured('APPLE_KEY_ID') &&
          configured('APPLE_PRIVATE_KEY') &&
          configured('APPLE_CALLBACK_URL')
            ? 'configured'
            : 'unconfigured',
        googleMeet:
          configured('GOOGLE_SERVICE_ACCOUNT_EMAIL') &&
          configured('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY') &&
          configured('GOOGLE_CALENDAR_IMPERSONATE_EMAIL')
            ? 'configured'
            : 'unconfigured',
        cloudinary:
          configured('CLOUDINARY_CLOUD_NAME') &&
          configured('CLOUDINARY_API_KEY') &&
          configured('CLOUDINARY_API_SECRET')
            ? 'configured'
            : 'unconfigured',
        paypal:
          configured('PAYPAL_CLIENT_ID') && configured('PAYPAL_CLIENT_SECRET')
            ? 'configured'
            : 'unconfigured',
        smtp:
          configured('SMTP_USER') && configured('SMTP_PASS')
            ? 'configured'
            : 'unconfigured',
      },
    };
  }

  private runReadinessChecks() {
    return this.health.check([
      () => this.database.pingCheck('database'),
      async () => {
        if (!this.redis.connected) {
          return { redis: { status: 'up', mode: 'fallback' } };
        }
        const pong = await this.redis.redis.ping();
        if (pong !== 'PONG') throw new Error('Redis ping failed');
        return { redis: { status: 'up' } };
      },
    ]);
  }
}
