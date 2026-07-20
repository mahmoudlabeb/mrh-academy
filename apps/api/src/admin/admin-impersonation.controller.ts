import {
  Controller,
  Post,
  Body,
  UseGuards,
  UnauthorizedException,
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
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @RequirePermissions('impersonate_users')
  async impersonate(
    @CurrentUser() admin: AdminUser,
    @Body() dto: { userId: string },
  ) {
    const targetUser = await this.userRepository.findOne({
      where: { id: dto.userId },
    });
    if (!targetUser) {
      throw new UnauthorizedException('Target user not found');
    }

    const payload: Record<string, string> = {
      sub: targetUser.id,
      email: targetUser.email,
      role: targetUser.role,
      originalAdminId: admin.id,
      type: 'access',
      sessionId: 'impersonated-session',
    };
    const accessToken = this.jwtService.sign(payload, { expiresIn: '1h' });

    return { accessToken, user: targetUser };
  }

  @Post('unimpersonate')
  @UseGuards(JwtAuthGuard)
  async unimpersonate(@CurrentUser() admin: AdminUser) {
    if (!admin.originalAdminId) {
      throw new UnauthorizedException('Not currently impersonating');
    }

    const originalAdmin = await this.userRepository.findOne({
      where: { id: admin.originalAdminId },
    });
    if (!originalAdmin) {
      throw new UnauthorizedException('Original admin account not found');
    }

    const payload: Record<string, string> = {
      sub: originalAdmin.id,
      email: originalAdmin.email,
      role: originalAdmin.role,
      type: 'access',
    };
    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });

    return { accessToken, user: originalAdmin };
  }
}
