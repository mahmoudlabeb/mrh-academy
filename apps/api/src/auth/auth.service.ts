import {
  Injectable,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository, QueryFailedError } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import { CourseStatus, UserRole } from '@mrh/types';
import { User } from '../users/entities/user.entity.js';
import { StudentProfile } from '../students/entities/student-profile.entity.js';
import { TutorProfile } from '../tutors/entities/tutor-profile.entity.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { RedisService } from '../redis/redis.service.js';
import { EmailService } from '../integrations/email/email.service.js';
import {
  assertPasswordAllowed,
  hashPassword,
  verifyPassword,
} from './password.js';
import { getJwtSignOptions, getJwtVerifyOptions } from './jwt-profile.js';

type JwtTokenPayload = {
  sub: string;
  jti: string;
  sessionId?: string;
  type: 'access' | 'refresh';
  familyId?: string;
  tokenVersion: string;
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
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly emailService: EmailService,
  ) {}

  private getAccessTokenExpiry(): string {
    return this.configService.get<string>('JWT_EXPIRES_IN', '15m');
  }

  private validatePassword(password: string) {
    assertPasswordAllowed(password);
  }

  private getAdminEmails(): string[] {
    return (this.configService.get<string>('ADMIN_EMAILS') ?? '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private tokensMatch(left: string, right: string) {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return (
      leftBuffer.length === rightBuffer.length &&
      timingSafeEqual(leftBuffer, rightBuffer)
    );
  }

  private async sendVerificationEmail(user: User) {
    const token = randomBytes(32).toString('base64url');
    await this.redisService.set(
      `email_verification:${this.hashToken(token)}`,
      user.id,
      'EX',
      24 * 60 * 60,
    );
    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );
    const verifyUrl = `${frontendUrl}/verify-email?token=${encodeURIComponent(token)}`;
    await this.emailService.sendEmail(
      user.email,
      'Verify your MRH Academy email',
      `<p>Confirm your email address by opening <a href="${verifyUrl}">this link</a>.</p><p>This link expires in 24 hours.</p>`,
    );
  }

  async verifyEmail(token: string) {
    const key = `email_verification:${this.hashToken(token)}`;
    const userId = await this.redisService.getDel(key);
    if (!userId)
      throw new BadRequestException('Invalid or expired verification token');
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new BadRequestException('Invalid verification token');
    user.isVerified = true;
    await this.userRepository.save(user);
    return { message: 'Email verified successfully' };
  }

  async resendVerification(email: string) {
    const user = await this.userRepository.findOne({
      where: { email: email.trim().toLowerCase() },
    });
    if (user && !user.isVerified && user.passwordHash) {
      await this.sendVerificationEmail(user);
    }
    return {
      message: 'If that email requires verification, a link has been sent',
    };
  }

  private async getTokenVersion(userId: string): Promise<string> {
    const key = `refresh_version:${userId}`;
    const existing = await this.redisService.get(key);
    if (existing) return existing;

    const created = randomUUID();
    if (typeof (this.redisService as any).setNX === 'function') {
      await this.redisService.setNX(key, created, 30 * 24 * 60 * 60);
      return (await this.redisService.get(key)) ?? created;
    }
    await this.redisService.set(key, created, 'EX', 30 * 24 * 60 * 60);
    return created;
  }

  private async revokeSessions(userId: string) {
    await this.redisService.del(`user_session:${userId}`);
    await this.redisService.set(
      `refresh_version:${userId}`,
      randomUUID(),
      'EX',
      30 * 24 * 60 * 60,
    );
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

  private signAccessToken(base: Omit<JwtTokenPayload, 'type' | 'jti'>) {
    return this.jwtService.sign(
      { ...base, jti: randomUUID(), type: 'access' } satisfies JwtTokenPayload,
      {
        ...getJwtSignOptions(this.configService),
        expiresIn: this.getAccessTokenExpiry() as any,
      },
    );
  }

  private signRefreshToken(base: Omit<JwtTokenPayload, 'type' | 'jti'>) {
    const jti = randomUUID();
    const token = this.jwtService.sign(
      { ...base, jti, type: 'refresh' } satisfies JwtTokenPayload,
      { ...getJwtSignOptions(this.configService), expiresIn: '30d' },
    );
    return { jti, token };
  }

  async buildAuthResponse(
    user: User,
    existingSessionId?: string,
    existingFamilyId?: string,
  ) {
    const base: Omit<JwtTokenPayload, 'type' | 'jti'> = {
      sub: user.id,
      tokenVersion: await this.getTokenVersion(user.id),
    };

    if (user.role === UserRole.STUDENT) {
      base.sessionId = await this.establishStudentSession(
        user.id,
        existingSessionId,
      );
    }

    const accessToken = this.signAccessToken(base);
    const familyId = existingFamilyId ?? randomUUID();
    const refresh = this.signRefreshToken({ ...base, familyId });
    await this.redisService.set(
      `refresh_token:${familyId}:${refresh.jti}`,
      this.hashToken(refresh.token),
      'EX',
      30 * 24 * 60 * 60,
    );
    const { passwordHash: _passwordHash, ...safeUser } = user;
    return {
      accessToken,
      refreshToken: refresh.token,
      user: safeUser,
    };
  }

  async register(dto: RegisterDto) {
    const existing = await this.userRepository.findOne({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    this.validatePassword(dto.password);
    const hashedPassword = await hashPassword(dto.password);
    const adminEmails = this.getAdminEmails();
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

      await this.sendVerificationEmail(result);
      const { passwordHash: _passwordHash, ...safeUser } = result;
      return {
        user: safeUser,
        verificationRequired: true,
      };
    } catch (error: unknown) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string })?.code === '23505'
      ) {
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

    if (!user.isVerified && user.passwordHash) {
      throw new UnauthorizedException(
        'Please verify your email address before signing in',
      );
    }

    const isPasswordValid = user.passwordHash
      ? await verifyPassword(user.passwordHash, dto.password)
      : false;
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
          passwordHash: null,
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

    await this.redisService.set(`google_reauth:${user.id}`, '1', 'EX', 10 * 60);
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

    const token = randomBytes(32).toString('base64url');
    await this.redisService.set(
      `password_reset:${this.hashToken(token)}`,
      dto.email.trim().toLowerCase(),
      'EX',
      15 * 60,
    );

    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );
    const resetUrl = `${frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;

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
    const email = await this.redisService.getDel(
      `password_reset:${this.hashToken(dto.token)}`,
    );
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

    this.validatePassword(dto.newPassword);
    const hashedPassword = await hashPassword(dto.newPassword);
    user.passwordHash = hashedPassword;
    await this.userRepository.save(user);

    await this.revokeSessions(user.id);
    await this.emailService.sendEmail(
      user.email,
      'Your MRH Academy password was changed',
      '<p>Your password was changed successfully. If you did not make this change, contact support immediately.</p>',
    );

    return { message: 'Password reset successfully' };
  }

  async logout(userId: string) {
    await this.revokeSessions(userId);
  }

  async deleteAccount(userId: string) {
    await this.userRepository.softDelete({ id: userId });
    await this.logout(userId);
  }

  async refreshTokens(refreshToken: string) {
    try {
      const decoded = this.jwtService.verify<JwtTokenPayload>(
        refreshToken,
        getJwtVerifyOptions(this.configService),
      );

      if (
        decoded.type !== 'refresh' ||
        !decoded.jti ||
        !decoded.familyId ||
        !decoded.tokenVersion
      ) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      if (
        await this.redisService.get(
          `refresh_family_revoked:${decoded.familyId}`,
        )
      ) {
        throw new UnauthorizedException('Refresh token has been revoked');
      }

      const currentVersion = await this.redisService.get(
        `refresh_version:${decoded.sub}`,
      );
      if (!currentVersion || currentVersion !== decoded.tokenVersion) {
        throw new UnauthorizedException('Refresh token has been revoked');
      }

      const storedHash = await this.redisService.getDel(
        `refresh_token:${decoded.familyId}:${decoded.jti}`,
      );
      if (
        !storedHash ||
        !this.tokensMatch(storedHash, this.hashToken(refreshToken))
      ) {
        await this.redisService.set(
          `refresh_family_revoked:${decoded.familyId}`,
          'reused',
          'EX',
          30 * 24 * 60 * 60,
        );
        throw new UnauthorizedException('Refresh token reuse detected');
      }

      const user = await this.userRepository.findOne({
        where: { id: decoded.sub },
      });

      if (!user) {
        throw new UnauthorizedException('Invalid refresh token');
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

      return this.buildAuthResponse(user, decoded.sessionId, decoded.familyId);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }
}
