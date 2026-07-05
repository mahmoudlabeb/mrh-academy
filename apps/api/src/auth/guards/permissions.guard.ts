import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@mrh/types';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator.js';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<{
      user?: { role: UserRole; assignedPermissions?: string[] };
    }>();

    if (!user) {
      throw new ForbiddenException('Authenticated user is required.');
    }

    if (user.role === UserRole.ADMIN) {
      return true;
    }

    if (user.role !== UserRole.SUBADMIN) {
      throw new ForbiddenException('Insufficient role for this action.');
    }

    const assignedPermissions = user.assignedPermissions ?? [];
    const hasAllPermissions = requiredPermissions.every((permission) =>
      assignedPermissions.includes(permission),
    );

    if (!hasAllPermissions) {
      throw new ForbiddenException('Insufficient permissions for this action.');
    }

    return true;
  }
}
