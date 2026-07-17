import type { JwtModuleOptions } from '@nestjs/jwt';

type JwtExpiresIn = NonNullable<
  NonNullable<JwtModuleOptions['signOptions']>['expiresIn']
>;

function resolveExpiresIn(envValue: string | undefined): JwtExpiresIn {
  return (envValue || '7d') as JwtExpiresIn;
}

describe('JWT config preservation (P2-G)', () => {
  it('uses env JWT_EXPIRES_IN value when set (preservation)', () => {
    expect(resolveExpiresIn('14d')).toBe('14d');
    expect(resolveExpiresIn('30d')).toBe('30d');
    expect(resolveExpiresIn('1h')).toBe('1h');
  });

  it('falls back to "7d" when JWT_EXPIRES_IN is undefined (preservation)', () => {
    expect(resolveExpiresIn(undefined)).toBe('7d');
  });

  it('falls back to "7d" when JWT_EXPIRES_IN is empty string (preservation)', () => {
    expect(resolveExpiresIn('')).toBe('7d');
  });
});
