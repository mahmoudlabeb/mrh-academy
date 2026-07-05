import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RedisService } from '../../redis/redis.service.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly redisService: RedisService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user || !user.id) {
      throw new UnauthorizedException('Session expired or logged in from another device');
    }

    // Non-students (tutor, admin, subadmin) have no sessionId — skip Redis check
    if (!user.sessionId) {
      return true;
    }

    const activeSession = await this.redisService.get(`user_session:${user.id}`);
    // Redis unset/offline — DO NOT allow in dev or prod; it must fail closed
    if (activeSession === null && !this.redisService.connected) {
      throw new Error('Redis is unavailable — Session enforcement failed.');
    }
    if (activeSession !== user.sessionId) {
      throw new UnauthorizedException('Session expired or logged in from another device');
    }

    return true;
  }
}
