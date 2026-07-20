import type { ConfigService } from '@nestjs/config';
import type { JwtSignOptions, JwtVerifyOptions } from '@nestjs/jwt';

export const JWT_ALGORITHM = 'HS256' as const;

export function getJwtSignOptions(config: ConfigService): JwtSignOptions {
  return {
    algorithm: JWT_ALGORITHM,
    issuer: config.get<string>('JWT_ISSUER', 'mrh-academy-api'),
    audience: config.get<string>('JWT_AUDIENCE', 'mrh-academy-web'),
  };
}

export function getJwtVerifyOptions(config: ConfigService): JwtVerifyOptions {
  return {
    algorithms: [JWT_ALGORITHM],
    issuer: config.get<string>('JWT_ISSUER', 'mrh-academy-api'),
    audience: config.get<string>('JWT_AUDIENCE', 'mrh-academy-web'),
  };
}
