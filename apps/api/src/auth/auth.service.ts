import {
  Injectable,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { CourseStatus, UserRole } from '@mrh/types';
import { User } from '../entities/user.entity.js';
import { StudentProfile } from '../entities/student-profile.entity.js';
import { TutorProfile } from '../entities/tutor-profile.entity.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { RedisService } from '../redis/redis.service.js';
import { EmailService } from '../services/email.service.js';

function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS;
  if (!raw) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('ADMIN_EMAILS should be set in production');
    }
    return [];
  }
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

type JwtTokenPayload = {
  sub: string;
  email: string;
  role: UserRole;
  sessionId?: string;
  type: 'access' | 'refresh';
  originalAdminId?: string;
};

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
    private readonly emailService: EmailService,
  ) {}

  private async clearRevocation(userId: string) {
    await this.redisService.del(`refresh_blocklist:${userId}`);
  }

  private async establishStudentSession(
    userId: string,
    existingSessionId?: string,
  ): Promise<string> {
    const sessionId = existingSessionId ?? randomUUID();
    await this.redisService.set(
      `user_session:${userId}`,
      sessionId,
      'EX',
      7 * 24 * 60 * 60,
    );
    return sessionId;
  }

  private signAccessToken(base: Omit<JwtTokenPayload, 'type'>) {
    return this.jwtService.sign(
      { ...base, type: 'access' } satisfies JwtTokenPayload,
      { expiresIn: '15m' },
    );
  }

  private signRefreshToken(base: Omit<JwtTokenPayload, 'type'>) {
    return this.jwtService.sign(
      { ...base, type: 'refresh' } satisfies JwtTokenPayload,
      { expiresIn: '30d' },
    );
  }

  private async buildAuthResponse(user: User, existingSessionId?: string) {
    await this.clearRevocation(user.id);

    const base: Omit<JwtTokenPayload, 'type'> = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    if (user.role === UserRole.STUDENT) {
      base.sessionId = await this.establishStudentSession(
        user.id,
        existingSessionId,
      );
    }

    const accessToken = this.signAccessToken(base);
    const refreshToken = this.signRefreshToken(base);
    const { passwordHash: _passwordHash, ...safeUser } = user;
    return { accessToken, refreshToken, user: safeUser };
  }

  async register(dto: RegisterDto) {
    const existing = await this.userRepository.findOne({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);
    const adminEmails = getAdminEmails();
    const isOwner = adminEmails.includes(dto.email.toLowerCase());

    let role: UserRole;
    if (isOwner) {
      role = UserRole.ADMIN;
    } else if (dto.role === 'tutor') {
      role = UserRole.TUTOR;
    } else {
      role = UserRole.STUDENT;
    }

    try {
      const result = await this.dataSource.transaction(async (manager) => {
        const user = manager.create(User, {
          email: dto.email,
          passwordHash: hashedPassword,
          firstName: dto.firstName,
          lastName: dto.lastName,
          role,
        });
        const savedUser = await manager.save(user);

        if (role === UserRole.TUTOR) {
          const tutorProfile = manager.create(TutorProfile, {
            userId: savedUser.id,
            bio: '',
            specialization: '',
            languages: [],
            hourlyRate: 0,
            balance: 0,
            totalHoursTaught: 0,
            status: CourseStatus.PENDING,
          });
          await manager.save(tutorProfile);
        } else if (role === UserRole.STUDENT) {
          const profile = manager.create(StudentProfile, {
            userId: savedUser.id,
          });
          await manager.save(profile);
        }

        return savedUser;
      });

      return this.buildAuthResponse(result);
    } catch (error: any) {
      if (error.code === '23505' || error.constraint?.includes('email')) {
        throw new ConflictException('Email is already registered');
      }
      throw error;
    }
  }

  async login(dto: LoginDto) {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email: dto.email })
      .getOne();

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.buildAuthResponse(user);
  }

  async getMe(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: {
        tutorProfile: true,
        studentProfile: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const { passwordHash: _passwordHash, ...safeUser } = user;
    return safeUser;
  }

  async handleGoogleLogin(googleProfile: {
    googleId: string;
    email: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
  }) {
    let user = await this.userRepository.findOne({
      where: { googleId: googleProfile.googleId },
    });

    if (!user) {
      const existingByEmail = await this.userRepository.findOne({
        where: { email: googleProfile.email },
      });

      if (existingByEmail) {
        if (
          existingByEmail.googleId &&
          existingByEmail.googleId !== googleProfile.googleId
        ) {
          throw new ConflictException(
            'This email is linked to a different Google account',
          );
        }
        if (!existingByEmail.isVerified && existingByEmail.passwordHash) {
          throw new ConflictException(
            'An account with this email already exists. Please log in with your password first to link Google.',
          );
        }
        existingByEmail.googleId = googleProfile.googleId;
        existingByEmail.isVerified = true;
        if (googleProfile.avatarUrl && !existingByEmail.avatarUrl) {
          existingByEmail.avatarUrl = googleProfile.avatarUrl;
        }
        user = await this.userRepository.save(existingByEmail);
      } else {
        const newUser = this.userRepository.create({
          googleId: googleProfile.googleId,
          email: googleProfile.email,
          firstName: googleProfile.firstName,
          lastName: googleProfile.lastName,
          avatarUrl: googleProfile.avatarUrl,
          role: UserRole.STUDENT,
          isVerified: true,
          passwordHash: await bcrypt.hash(randomUUID(), 12),
        });

        const savedUser = await this.dataSource.transaction(async (manager) => {
          const s = await manager.save(newUser);
          const profile = manager.create(StudentProfile, {
            userId: s.id,
          });
          await manager.save(profile);
          return s;
        });

        user = savedUser;
      }
    }

    return this.buildAuthResponse(user);
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    if (!user) {
      return {
        message: 'If that email is registered, a reset link has been sent',
      };
    }

    const token = randomUUID();
    await this.redisService.set(`reset_token:${token}`, dto.email, 'EX', 3600);

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

    await this.emailService.sendEmail(
      dto.email,
      'Password Reset - MRH Academy',
      `<p>You requested a password reset.</p>
<p>Click <a href="${resetUrl}">here</a> to reset your password.</p>
<p>This link expires in 1 hour.</p>
<p>If you did not request this, please ignore this email.</p>`,
    );

    return {
      message: 'If that email is registered, a reset link has been sent',
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const email = await this.redisService.get(`reset_token:${dto.token}`);
    if (!email) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email })
      .getOne();

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 12);
    user.passwordHash = hashedPassword;
    await this.userRepository.save(user);

    await this.redisService.del(`reset_token:${dto.token}`);
    await this.clearRevocation(user.id);

    return { message: 'Password reset successfully' };
  }

  async logout(userId: string) {
    await this.redisService.del(`user_session:${userId}`);
    await this.redisService.set(
      `refresh_blocklist:${userId}`,
      'revoked',
      'EX',
      30 * 24 * 60 * 60,
    );
  }

  async deleteAccount(userId: string) {
    await this.userRepository.softDelete({ id: userId });
    await this.logout(userId);
  }

  async refreshTokens(refreshToken: string) {
    try {
      const decoded = this.jwtService.verify(refreshToken) as JwtTokenPayload;

      if (decoded.type && decoded.type !== 'refresh') {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const user = await this.userRepository.findOne({
        where: { id: decoded.sub },
      });

      if (!user) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const blocklisted = await this.redisService.get(
        `refresh_blocklist:${user.id}`,
      );
      if (blocklisted) {
        throw new UnauthorizedException('Refresh token has been revoked');
      }

      if (user.role === UserRole.STUDENT) {
        if (!decoded.sessionId) {
          throw new UnauthorizedException('Invalid refresh token');
        }
        const activeSession = await this.redisService.get(
          `user_session:${user.id}`,
        );
        if (activeSession !== decoded.sessionId) {
          throw new UnauthorizedException(
            'Session expired or logged in from another device',
          );
        }
      }

      return this.buildAuthResponse(user, decoded.sessionId);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }
}
