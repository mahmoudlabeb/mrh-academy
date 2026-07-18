import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response, NextFunction } from 'express';

/** Header sent by the official web app (see apps/web/src/lib/api-client.ts). */
export const MRH_CLIENT_HEADER = 'x-mrh-client';
export const MRH_CLIENT_WEB = 'mrh-web';

@Injectable()
export class CsrfOriginMiddleware implements NestMiddleware {
  private readonly allowedOrigins: Set<string>;
  private readonly isProduction: boolean;

  constructor(private readonly configService: ConfigService) {
    const env = this.configService.get<string>('NODE_ENV', 'development');
    this.isProduction = env === 'production';
    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      this.isProduction ? '' : 'http://localhost:3000',
    );
    this.allowedOrigins = new Set(
      this.isProduction
        ? frontendUrl
          ? [frontendUrl]
          : []
        : [
            frontendUrl,
            'http://localhost:3000',
            'http://127.0.0.1:3000',
            'http://localhost:4000',
          ],
    );
  }

  private isAllowedUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      const origin = `${parsed.protocol}//${parsed.host}`;
      if (this.allowedOrigins.has(origin)) return true;
      return false;
    } catch {
      return false;
    }
  }

  use(req: Request, _res: Response, next: NextFunction) {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      next();
      return;
    }

    const origin = req.headers['origin'];
    const referer = req.headers['referer'];
    const clientHeader = req.headers[MRH_CLIENT_HEADER];

    if (!origin && !referer) {
      if (
        this.isProduction &&
        clientHeader !== MRH_CLIENT_WEB &&
        !req.originalUrl.includes('webhooks/stripe')
      ) {
        throw new ForbiddenException(
          'CSRF validation failed: missing origin and client header',
        );
      }
      next();
      return;
    }

    if (origin && !this.isAllowedUrl(origin)) {
      throw new ForbiddenException('CSRF validation failed: invalid origin');
    }

    if (!origin && referer && !this.isAllowedUrl(referer)) {
      throw new ForbiddenException('CSRF validation failed: invalid referer');
    }

    next();
  }
}
