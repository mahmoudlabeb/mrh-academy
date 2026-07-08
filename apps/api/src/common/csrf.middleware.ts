import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response, NextFunction } from 'express';

@Injectable()
export class CsrfOriginMiddleware implements NestMiddleware {
  private readonly allowedOrigins: Set<string>;

  constructor(private readonly configService: ConfigService) {
    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );
    const env = this.configService.get<string>('NODE_ENV', 'development');
    this.allowedOrigins = new Set([
      frontendUrl,
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      ...(env === 'development' ? ['http://localhost:4000'] : []),
    ]);
  }

  private isAllowedUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      const origin = `${parsed.protocol}//${parsed.host}`;
      return this.allowedOrigins.has(origin);
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

    if (!origin && !referer) {
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
