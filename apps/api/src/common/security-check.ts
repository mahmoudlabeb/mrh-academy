import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export function checkSecurityEnvironment(
  logger: Logger,
  config: ConfigService,
): void {
  const warnings: string[] = [];
  const errors: string[] = [];

  const nodeEnv = config.get<string>('NODE_ENV', 'development');
  const jwtSecret = config.get<string>('JWT_SECRET');
  const frontendUrl = config.get<string>('FRONTEND_URL');

  if (nodeEnv === 'production') {
    if (!frontendUrl) {
      errors.push('FRONTEND_URL must be configured in production');
    } else if (
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(frontendUrl)
    ) {
      errors.push('FRONTEND_URL cannot point to localhost in production');
    } else if (!/^https:\/\//i.test(frontendUrl)) {
      errors.push('FRONTEND_URL must use HTTPS in production');
    }

    if (!jwtSecret || jwtSecret.length < 32) {
      errors.push('JWT_SECRET must be at least 32 characters in production');
    }

    if (jwtSecret === 'super-secret-mrh-academy-key-CHANGE-IN-PRODUCTION') {
      errors.push('JWT_SECRET still set to default value — CHANGE IMMEDIATELY');
    }

    if (
      !config.get<string>('DATABASE_URL') &&
      !config.get<string>('DATABASE_PASSWORD')
    ) {
      errors.push('DATABASE_URL or DATABASE_PASSWORD must be configured');
    }

    if (!config.get<string>('ADMIN_EMAILS')) {
      warnings.push('ADMIN_EMAILS must be configured in production');
    }

    if (!config.get<string>('SUBADMIN_DEFAULT_PASSWORD')) {
      errors.push('SUBADMIN_DEFAULT_PASSWORD must be set in production');
    }

    if (!config.get<string>('STRIPE_SECRET_KEY')) {
      warnings.push(
        'STRIPE_SECRET_KEY not configured — Stripe payments will fail',
      );
    }

    if (!config.get<string>('SMTP_HOST') || !config.get<string>('SMTP_USER')) {
      warnings.push(
        'SMTP not fully configured — email notifications will be unavailable',
      );
    }
  }

  if (nodeEnv === 'development') {
    if (!config.get<string>('REDIS_URL')) {
      warnings.push('REDIS_URL not set — session locking disabled');
    }

    if (!jwtSecret || jwtSecret.length < 10) {
      warnings.push(
        'JWT_SECRET is too short — use a strong secret in production',
      );
    }
  }

  if (errors.length > 0) {
    for (const err of errors) {
      logger.error(`[SECURITY] ${err}`);
    }
    if (nodeEnv === 'production') {
      logger.error(
        `[SECURITY] CRITICAL: ${errors.length} security configuration error(s). Aborting startup.`,
      );
      process.exit(1);
    }
  }

  for (const warn of warnings) {
    logger.warn(`[SECURITY] ${warn}`);
  }

  if (errors.length === 0 && warnings.length === 0) {
    logger.log('[SECURITY] All security checks passed');
  }
}
