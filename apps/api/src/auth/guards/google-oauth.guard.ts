import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { RedisService } from '../../redis/redis.service.js';

type OAuthRequest = Request & {
  oauthOptions?: { state: string; nonce: string };
  oauthNonce?: string;
};

@Injectable()
export class GoogleOAuthGuard extends AuthGuard('google') {
  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<OAuthRequest>();
    const response = context.switchToHttp().getResponse<Response>();

    if (request.path.endsWith('/callback')) {
      await this.consumeTransaction(request, response);
    } else {
      await this.createTransaction(request, response);
    }

    return (await super.canActivate(context)) as boolean;
  }

  getAuthenticateOptions(context: ExecutionContext) {
    return context.switchToHttp().getRequest<OAuthRequest>().oauthOptions;
  }

  private async createTransaction(request: OAuthRequest, response: Response) {
    const state = randomBytes(32).toString('base64url');
    const nonce = randomBytes(32).toString('base64url');
    const browserBinding = randomBytes(32).toString('base64url');
    const secure =
      this.config.get<string>('COOKIE_SECURE') === 'true' ||
      this.config.get<string>('NODE_ENV') === 'production';

    await this.redis.set(
      `oauth_state:${this.hash(state)}`,
      JSON.stringify({ browserBinding: this.hash(browserBinding), nonce }),
      'EX',
      10 * 60,
    );
    response.cookie('mrh_oauth_binding', browserBinding, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/api/v1/auth/google/callback',
      maxAge: 10 * 60 * 1000,
    });
    request.oauthOptions = { state, nonce };
  }

  private async consumeTransaction(request: OAuthRequest, response: Response) {
    const state =
      typeof request.query.state === 'string' ? request.query.state : '';
    const browserBinding = request.cookies?.mrh_oauth_binding as
      string | undefined;
    response.clearCookie('mrh_oauth_binding', {
      path: '/api/v1/auth/google/callback',
    });

    if (!state || !browserBinding) {
      throw new UnauthorizedException('Invalid OAuth transaction');
    }

    const encoded = await this.redis.getDel(`oauth_state:${this.hash(state)}`);
    if (!encoded) {
      throw new UnauthorizedException('Invalid or replayed OAuth transaction');
    }

    const transaction = JSON.parse(encoded) as {
      browserBinding: string;
      nonce: string;
    };
    if (!this.matches(transaction.browserBinding, this.hash(browserBinding))) {
      throw new UnauthorizedException('OAuth browser binding failed');
    }

    request.oauthNonce = transaction.nonce;
  }

  private hash(value: string) {
    return createHash('sha256').update(value).digest('base64url');
  }

  private matches(left: string, right: string) {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return (
      leftBuffer.length === rightBuffer.length &&
      timingSafeEqual(leftBuffer, rightBuffer)
    );
  }
}
