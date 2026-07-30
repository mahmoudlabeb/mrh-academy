import { UserRole } from '@mrh/types';
import { IS_PUBLIC_KEY } from '../../auth/decorators/public.decorator.js';
import { ROLES_KEY } from '../../auth/decorators/roles.decorator.js';
import { CoursesController } from '../../courses/courses.controller.js';
import { TutorsController } from '../../tutors/tutors.controller.js';

describe('secure video endpoint permissions', () => {
  it.each([
    [TutorsController, 'uploadProfileVideo'],
    [TutorsController, 'getMyProfileVideo'],
    [TutorsController, 'deleteProfileVideo'],
    [TutorsController, 'uploadProfileVideoCaptions'],
    [TutorsController, 'deleteProfileVideoCaptions'],
    [CoursesController, 'uploadMedia'],
    [CoursesController, 'getOverviewStatus'],
    [CoursesController, 'deleteOverview'],
    [CoursesController, 'uploadOverviewCaptions'],
    [CoursesController, 'deleteOverviewCaptions'],
  ])(
    'restricts %s.%s to tutor accounts',
    (controller: object, methodName: string) => {
      const method = (
        controller as {
          prototype: Record<string, (...args: never[]) => unknown>;
        }
      ).prototype[methodName];
      expect(Reflect.getMetadata(ROLES_KEY, method)).toEqual([UserRole.TUTOR]);
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, method)).not.toBe(true);
    },
  );

  it.each([
    [TutorsController, 'getPublicProfileVideo'],
    [CoursesController, 'getPublicOverview'],
  ])(
    'allows public landing pages to request only signed playback metadata from %s.%s',
    (controller: object, methodName: string) => {
      const method = (
        controller as {
          prototype: Record<string, (...args: never[]) => unknown>;
        }
      ).prototype[methodName];
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, method)).toBe(true);
      expect(Reflect.getMetadata(ROLES_KEY, method)).toBeUndefined();
    },
  );
});
