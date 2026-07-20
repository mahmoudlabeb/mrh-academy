import { ForbiddenException, Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const CSRF_COOKIE = 'mrh_csrf';
const CSRF_HEADER = 'x-csrf-token';

@Injectable()
export class CsrfOriginMiddleware implements NestMiddleware {
  private readonly allowedOrigins: Set<string>;
  private readonly secureCookies: boolean;

  constructor(private readonly config: ConfigService) {
    const environment = this.config.get<string>('NODE_ENV', 'development');
    const frontendUrl = this.config.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );
    this.secureCookies = environment === 'production';
    this.allowedOrigins = new Set([
      frontendUrl,
      ...(environment === 'production'
        ? []
        : [
            'http://localhost:3000',
            'http://127.0.0.1:3000',
            'http://localhost:4000',
          ]),
    ]);
  }

  use(req: Request, res: Response, next: NextFunction) {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      if (!this.readCookie(req)) {
        res.cookie(CSRF_COOKIE, randomBytes(32).toString('base64url'), {
          httpOnly: false,
          secure: this.secureCookies,
          sameSite: 'strict',
          path: '/',
        });
      }
      next();
      return;
    }

    if (req.originalUrl.includes('/webhooks/stripe')) {
      next();
      return;
    }

    const origin = req.headers.origin;
    const referer = req.headers.referer;
    if (!origin && !referer) {
      throw new ForbiddenException('CSRF validation failed: missing origin');
    }
    if (origin && !this.isAllowedUrl(origin)) {
      throw new ForbiddenException('CSRF validation failed: invalid origin');
    }
    if (!origin && referer && !this.isAllowedUrl(referer)) {
      throw new ForbiddenException('CSRF validation failed: invalid referer');
    }

    const cookieToken = this.readCookie(req);
    const headerToken = req.get(CSRF_HEADER);
    if (
      !cookieToken ||
      !headerToken ||
      !this.tokensMatch(cookieToken, headerToken)
    ) {
      throw new ForbiddenException('CSRF validation failed: token mismatch');
    }

    next();
  }

  private readCookie(req: Request): string | undefined {
    return (req.cookies as Record<string, string> | undefined)?.[CSRF_COOKIE];
  }

  private isAllowedUrl(value: string): boolean {
    try {
      return this.allowedOrigins.has(new URL(value).origin);
    } catch {
      return false;
    }
  }

  private tokensMatch(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return (
      leftBuffer.length === rightBuffer.length &&
      timingSafeEqual(leftBuffer, rightBuffer)
    );
  }
}
