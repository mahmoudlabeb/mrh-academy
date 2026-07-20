import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';

@Catch()
export class GoogleAuthExceptionFilter implements ExceptionFilter {
  constructor(private readonly config: ConfigService) {}

  catch(_exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const frontendUrl = this.config.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );
    response.redirect(`${frontendUrl}/login?error=google_auth_failed`);
  }
}
