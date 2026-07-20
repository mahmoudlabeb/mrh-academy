import { registerAs } from '@nestjs/config';

export const authConfig = registerAs('auth', () => ({
  jwtSecret: process.env.JWT_SECRET ?? '',
  accessTokenTtl: process.env.JWT_EXPIRES_IN ?? '15m',
  issuer: process.env.JWT_ISSUER ?? 'mrh-academy-api',
  audience: process.env.JWT_AUDIENCE ?? 'mrh-academy-web',
  secureCookies:
    process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production',
}));
