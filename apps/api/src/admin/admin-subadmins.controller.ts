import {
  Body,
  Controller,
  Get,
  Post,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { UserRole } from '@mrh/types';
import { User } from '../entities/user.entity.js';
import { SubAdminProfile } from '../entities/sub-admin-profile.entity.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { EmailService } from '../services/email.service.js';
import { AuthService } from '../auth/auth.service.js';
import {
  InviteSubAdminDto,
  AcceptInviteDto,
} from './dto/invite-subadmin.dto.js';

@Controller('admin/subadmins')
export class AdminSubAdminsController {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(SubAdminProfile)
    private readonly subAdminRepository: Repository<SubAdminProfile>,
    private readonly emailService: EmailService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  @Roles(UserRole.ADMIN)
  async list() {
    const subadmins = await this.userRepository.find({
      where: { role: UserRole.SUBADMIN },
      relations: { subAdminProfile: true },
      order: { createdAt: 'DESC' },
    });
    return subadmins.map((u) => ({
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      isActive: u.isActive,
      hasInviteToken: !!u.inviteToken,
      inviteTokenExpires: u.inviteTokenExpires,
      permissions: u.subAdminProfile?.assignedPermissions ?? [],
      createdAt: u.createdAt,
    }));
  }

  @Post('invite')
  @Roles(UserRole.ADMIN)
  async invite(@Body() dto: InviteSubAdminDto) {
    const email = dto.email.trim().toLowerCase();

    const existing = await this.userRepository.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    const inviteToken = randomUUID();
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    const user = this.userRepository.create({
      email,
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      role: UserRole.SUBADMIN,
      isActive: false,
      passwordHash: await bcrypt.hash(randomUUID(), 12),
      inviteToken,
      inviteTokenExpires: expiresAt,
    });
    await this.userRepository.save(user);

    await this.subAdminRepository.save(
      this.subAdminRepository.create({
        userId: user.id,
        assignedPermissions: [],
      }),
    );

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const inviteLink = `${frontendUrl}/invite/accept?token=${inviteToken}`;

    await this.emailService.sendEmail(
      email,
      'You are invited to join MRH Academy',
      `<p>Hello ${dto.firstName},</p>
<p>You have been invited to join MRH Academy as a Sub-Admin.</p>
<p>Click <a href="${inviteLink}">here</a> to accept your invitation and set your password.</p>
<p>This link expires in 48 hours.</p>`,
    );

    return { message: 'Invitation sent' };
  }

  @Public()
  @Post('accept-invite')
  async acceptInvite(@Body() dto: AcceptInviteDto) {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .addSelect('user.inviteToken')
      .addSelect('user.inviteTokenExpires')
      .where('user.inviteToken = :token', { token: dto.token })
      .getOne();

    if (!user) {
      throw new BadRequestException('Invalid invitation token');
    }

    if (user.inviteTokenExpires && new Date() > user.inviteTokenExpires) {
      throw new UnauthorizedException('Invitation token has expired');
    }

    user.passwordHash = await bcrypt.hash(dto.password, 12);
    user.isActive = true;
    (user as any).inviteToken = null;
    (user as any).inviteTokenExpires = null;
    await this.userRepository.save(user);

    return this.authService.buildAuthResponse(user);
  }
}
