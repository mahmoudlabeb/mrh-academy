import {
  Controller,
  Post,
  Body,
  UseGuards,
  UnauthorizedException,
  Res,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '@mrh/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { User } from '../users/entities/user.entity.js';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service.js';
import { randomUUID } from 'node:crypto';
import { getJwtSignOptions } from '../auth/jwt-profile.js';
import type { Response } from 'express';

interface AdminUser {
  id: string;
  role: string;
  originalAdminId?: string;
}

@Controller('admin/impersonate')
export class AdminImpersonationController {
  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @RequirePermissions('impersonate_users')
  async impersonate(
    @CurrentUser() admin: AdminUser,
    @Body() dto: { userId: string },
    @Res({ passthrough: true }) response: Response,
  ) {
    const targetUser = await this.userRepository.findOne({
      where: { id: dto.userId },
    });
    if (!targetUser) {
      throw new UnauthorizedException('Target user not found');
    }

    const tokenVersion =
      (await this.redis.get(`refresh_version:${targetUser.id}`)) ??
      randomUUID();
    await this.redis.set(
      `refresh_version:${targetUser.id}`,
      tokenVersion,
      'EX',
      30 * 24 * 60 * 60,
    );
    const payload: Record<string, string> = {
      sub: targetUser.id,
      originalAdminId: admin.id,
      type: 'access',
      sessionId: 'impersonated-session',
      tokenVersion,
      jti: randomUUID(),
    };
    const accessToken = this.jwtService.sign(payload, {
      ...getJwtSignOptions(this.config),
      expiresIn: '1h',
    });
    this.setAccessCookie(response, accessToken);

    return { user: targetUser };
  }

  @Post('unimpersonate')
  @UseGuards(JwtAuthGuard)
  async unimpersonate(
    @CurrentUser() admin: AdminUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (!admin.originalAdminId) {
      throw new UnauthorizedException('Not currently impersonating');
    }

    const originalAdmin = await this.userRepository.findOne({
      where: { id: admin.originalAdminId },
    });
    if (!originalAdmin) {
      throw new UnauthorizedException('Original admin account not found');
    }

    const tokenVersion =
      (await this.redis.get(`refresh_version:${originalAdmin.id}`)) ??
      randomUUID();
    await this.redis.set(
      `refresh_version:${originalAdmin.id}`,
      tokenVersion,
      'EX',
      30 * 24 * 60 * 60,
    );
    const payload: Record<string, string> = {
      sub: originalAdmin.id,
      type: 'access',
      tokenVersion,
      jti: randomUUID(),
    };
    const accessToken = this.jwtService.sign(payload, {
      ...getJwtSignOptions(this.config),
      expiresIn: '15m',
    });
    this.setAccessCookie(response, accessToken);

    return { user: originalAdmin };
  }

  private setAccessCookie(response: Response, token: string) {
    response.cookie('mrh_token', token, {
      httpOnly: true,
      secure:
        this.config.get<string>('COOKIE_SECURE') === 'true' ||
        this.config.get<string>('NODE_ENV') === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 1000,
    });
  }
}
