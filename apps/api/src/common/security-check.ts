import { Logger } from '@nestjs/common';

export function checkSecurityEnvironment(logger: Logger) {
  const warnings: string[] = [];
  const errors: string[] = [];

  const nodeEnv = process.env.NODE_ENV || 'development';
  const jwtSecret = process.env.JWT_SECRET;

  if (nodeEnv === 'production') {
    if (!jwtSecret || jwtSecret.length < 32) {
      errors.push('JWT_SECRET must be at least 32 characters in production');
    }

    if (jwtSecret === 'super-secret-mrh-academy-key-CHANGE-IN-PRODUCTION') {
      errors.push('JWT_SECRET still set to default value — CHANGE IMMEDIATELY');
    }

    if (!process.env.DATABASE_URL && !process.env.DATABASE_PASSWORD) {
      errors.push('DATABASE_URL or DATABASE_PASSWORD must be configured');
    }

    if (!process.env.ADMIN_EMAILS) {
      warnings.push('ADMIN_EMAILS must be configured in production');
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      warnings.push(
        'STRIPE_SECRET_KEY not configured — Stripe payments will fail',
      );
    }

    if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
      warnings.push(
        'SMTP not fully configured — email notifications will be unavailable',
      );
    }
  }

  if (nodeEnv === 'development') {
    if (!process.env.REDIS_URL) {
      warnings.push('REDIS_URL not set — session locking disabled');
    }

    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 10) {
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
        `[SECURITY] CRITICAL: ${errors.length} security configuration error(s) — app may malfunction:\n${errors.join('\n')}`,
      );
    }
  }

  for (const warn of warnings) {
    logger.warn(`[SECURITY] ${warn}`);
  }

  if (errors.length === 0 && warnings.length === 0) {
    logger.log('[SECURITY] All security checks passed');
  }

  return { errors, warnings };
}
