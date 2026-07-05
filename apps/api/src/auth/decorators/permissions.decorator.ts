import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'PERMISSIONS';
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
