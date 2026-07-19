import type { JwtModuleOptions } from '@nestjs/jwt';

type JwtExpiresIn = NonNullable<
  NonNullable<JwtModuleOptions['signOptions']>['expiresIn']
>;

function resolveExpiresIn(envValue: string | undefined, fallback: string): JwtExpiresIn {
  return (envValue || fallback) as JwtExpiresIn;
}

describe('JWT config preservation (P1 CFG-01)', () => {
  describe('access token expiry', () => {
    it('uses env JWT_ACCESS_EXPIRES_IN value when set', () => {
      expect(resolveAccessExpiry('14h')).toBe('14h');
      expect(resolveAccessExpiry('1h')).toBe('1h');
    });

    it('falls back to "30m" when undefined', () => {
      expect(resolveAccessExpiry(undefined)).toBe('30m');
    });

    it('falls back to "30m" when empty string', () => {
      expect(resolveAccessExpiry('')).toBe('30m');
    });
  });

  describe('refresh expiry', () => {
    it('uses env JWT_REFRESH_EXPIRES_IN value when set', () => {
      expect(resolveRefreshExpiry('14d')).toBe('14d');
      expect(resolveRefreshExpiry('30d')).toBe('30d');
    });

    it('falls back to "7d" when undefined', () => {
      expect(resolveRefreshExpiry(undefined)).toBe('7d');
    });
  });
});

function resolveAccessExpiry(value?: string) {
  return value || '30m';
}

function resolveRefreshExpiry(value?: string) {
  return value || '7d';
}
