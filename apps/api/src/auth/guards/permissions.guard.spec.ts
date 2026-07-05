import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@mrh/types';
import { PermissionsGuard } from './permissions.guard.js';

function createContext(user: unknown): ExecutionContext {
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as jest.Mocked<Reflector>;

  let guard: PermissionsGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new PermissionsGuard(reflector);
  });

  it('allows routes with no required permissions', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    expect(guard.canActivate(createContext({ role: UserRole.SUBADMIN }))).toBe(true);
  });

  it('allows admins regardless of assigned permissions', () => {
    reflector.getAllAndOverride.mockReturnValue(['manage_tutors']);

    expect(guard.canActivate(createContext({ role: UserRole.ADMIN }))).toBe(true);
  });

  it('allows subadmins with all required permissions', () => {
    reflector.getAllAndOverride.mockReturnValue(['manage_tutors']);

    expect(
      guard.canActivate(
        createContext({
          role: UserRole.SUBADMIN,
          assignedPermissions: ['manage_tutors', 'view_reports'],
        }),
      ),
    ).toBe(true);
  });

  it('rejects subadmins missing required permissions', () => {
    reflector.getAllAndOverride.mockReturnValue(['manage_tutors']);

    expect(() =>
      guard.canActivate(
        createContext({
          role: UserRole.SUBADMIN,
          assignedPermissions: ['view_reports'],
        }),
      ),
    ).toThrow(ForbiddenException);
  });
});
