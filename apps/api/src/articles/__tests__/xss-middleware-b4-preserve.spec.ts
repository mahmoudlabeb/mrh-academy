import { UserRole } from '@mrh/types';
import { Public } from '../../auth/decorators/public.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';

describe('B4 Preservation — CsrfOriginMiddleware and Auth Decorators', () => {
  it('should have Public decorator exported and usable', () => {
    expect(Public).toBeDefined();
    expect(typeof Public).toBe('function');
  });

  it('should have Roles decorator exported and usable', () => {
    expect(Roles).toBeDefined();
    expect(typeof Roles).toBe('function');
  });

  it('Roles decorator should accept UserRole.ADMIN', () => {
    const decorated = Roles(UserRole.ADMIN);
    expect(decorated).toBeDefined();
  });

  it('should have UserRole enum with expected values', () => {
    expect(UserRole.ADMIN).toBe('admin');
    expect(UserRole.STUDENT).toBe('student');
    expect(UserRole.TUTOR).toBe('tutor');
  });
});
