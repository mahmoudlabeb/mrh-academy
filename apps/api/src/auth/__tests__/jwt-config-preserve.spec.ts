import type { JwtModuleOptions } from '@nestjs/jwt';

type JwtExpiresIn = NonNullable<
  NonNullable<JwtModuleOptions['signOptions']>['expiresIn']
>;

function resolveExpiresIn(envValue: string | undefined): JwtExpiresIn {
  return (envValue || '15m') as JwtExpiresIn;
}

describe('JWT config preservation (P2-G)', () => {
  it('uses env JWT_EXPIRES_IN value when set (preservation)', () => {
    expect(resolveExpiresIn('14d')).toBe('14d');
    expect(resolveExpiresIn('30d')).toBe('30d');
    expect(resolveExpiresIn('1h')).toBe('1h');
  });

  it('falls back to "15m" when JWT_EXPIRES_IN is undefined (preservation)', () => {
    expect(resolveExpiresIn(undefined)).toBe('15m');
  });

  it('falls back to "15m" when JWT_EXPIRES_IN is empty string (preservation)', () => {
    expect(resolveExpiresIn('')).toBe('15m');
  });
});
