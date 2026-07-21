import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Inject } from '@nestjs/common';
import { DataSource, In, Repository } from 'typeorm';
import { LessonStatus, UserRole } from '@mrh/types';
import { Lesson } from '../lessons/entities/lesson.entity.js';
import { StudentProfile } from '../students/entities/student-profile.entity.js';

import { User } from './entities/user.entity.js';
import { RedisService } from '../redis/redis.service.js';
import {
  ChangeEmailDto,
  ChangePasswordDto,
  UpdateNotificationPreferencesDto,
  UpdateProfileDto,
} from './dto/index.js';
import {
  mergeNotificationPreferences,
  NotificationPreferences,
} from '../common/types/notification-preferences.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import { randomBytes, createHash } from 'node:crypto';
import { EmailService } from '../integrations/email/email.service.js';
import {
  OBJECT_STORAGE,
  type ObjectStorage,
} from '../integrations/storage/object-storage.js';

type AvatarFile = {
  buffer: Buffer;
  mimetype: string;
  size: number;
};

@Injectable()
export class UsersService {
  private readonly maxAvatarSize = 2 * 1024 * 1024;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly emailService: EmailService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  async getMe(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: {
        studentProfile: true,
        tutorProfile: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.sanitizeUser(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (dto.firstName !== undefined) user.firstName = dto.firstName;
    if (dto.lastName !== undefined) user.lastName = dto.lastName;
    if (dto.phone !== undefined) user.phone = dto.phone;
    if (dto.timezone !== undefined) user.timezone = dto.timezone;

    const updated = await this.userRepository.save(user);
    return this.sanitizeUser(updated);
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :userId', { userId })
      .getOne();

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Google-only accounts have no password
    if (!user.passwordHash) {
      throw new BadRequestException(
        'Password change requires Google reauthentication',
      );
    }

    const isPasswordValid = await verifyPassword(
      dto.currentPassword,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    user.passwordHash = await hashPassword(dto.newPassword);
    await this.userRepository.save(user);
    await this.redisService.del(`user_session:${userId}`);
    await this.redisService.set(
      `refresh_blocklist:${userId}`,
      'revoked',
      'EX',
      30 * 24 * 60 * 60,
    );

    return { message: 'Password updated successfully' };
  }

  async changeEmail(userId: string, dto: ChangeEmailDto) {
    const existing = await this.userRepository.findOne({
      where: { email: dto.newEmail },
    });
    if (existing && existing.id !== userId) {
      throw new ConflictException('Email is already registered');
    }

    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :userId', { userId })
      .getOne();

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.passwordHash) {
      const isPasswordValid = await verifyPassword(
        dto.currentPassword,
        user.passwordHash,
      );
      if (!isPasswordValid) {
        throw new UnauthorizedException('Current password is incorrect');
      }
    }

    if (!user.passwordHash) {
      const recentlyReauthenticated = await this.redisService.get(
        `google_reauth:${userId}`,
      );
      if (!recentlyReauthenticated) {
        throw new UnauthorizedException(
          'Reauthenticate with Google before changing your email',
        );
      }
    }

    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    await this.redisService.set(
      `email_change:${tokenHash}`,
      JSON.stringify({ userId, newEmail: dto.newEmail.trim().toLowerCase() }),
      'EX',
      user.role === UserRole.ADMIN || user.role === UserRole.SUBADMIN
        ? 10 * 60
        : 30 * 60,
    );
    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );
    const confirmationUrl = `${frontendUrl}/confirm-email?token=${encodeURIComponent(token)}`;
    await this.emailService.sendEmail(
      user.email,
      'Confirm your MRH Academy email change',
      `<p>A request was made to change your account email to ${dto.newEmail}.</p><p>Confirm it here: <a href="${confirmationUrl}">${confirmationUrl}</a></p>`,
    );
    return { message: 'Check your new email address to confirm the change' };
  }

  async confirmEmailChange(token: string) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const encoded = await this.redisService.getDel(`email_change:${tokenHash}`);
    if (!encoded)
      throw new BadRequestException('Invalid or expired email change token');
    const pending = JSON.parse(encoded) as { userId: string; newEmail: string };
    const conflict = await this.userRepository.findOne({
      where: { email: pending.newEmail },
    });
    if (conflict && conflict.id !== pending.userId) {
      throw new ConflictException('Email is already registered');
    }
    const user = await this.userRepository.findOne({
      where: { id: pending.userId },
    });
    if (!user) throw new BadRequestException('Invalid email change request');
    const previousEmail = user.email;
    user.email = pending.newEmail;
    user.isVerified = true;
    try {
      await this.userRepository.save(user);
    } catch (error: unknown) {
      if (this.isEmailConflict(error)) {
        throw new ConflictException('Email is already registered');
      }
      throw error;
    }
    await this.redisService.del(`user_session:${user.id}`);
    await this.redisService.set(
      `refresh_version:${user.id}`,
      randomBytes(16).toString('hex'),
      'EX',
      30 * 24 * 60 * 60,
    );
    await this.emailService.sendEmail(
      previousEmail,
      'Your MRH Academy email was changed',
      '<p>Your account email was changed. If you did not request this, contact support immediately.</p>',
    );
    return { message: 'Email changed successfully' };
  }

  async updateAvatar(userId: string, file: AvatarFile | undefined) {
    if (!file) {
      throw new BadRequestException('Avatar file is required');
    }
    if (file.size > this.maxAvatarSize) {
      throw new BadRequestException('Avatar file must be 2MB or smaller');
    }
    if (!this.isSupportedImage(file.buffer, file.mimetype)) {
      throw new BadRequestException(
        'Avatar content does not match its image type',
      );
    }

    const uploadResult = await this.storage.upload(file.buffer, {
      folder: 'mrh-academy/avatars',
      resourceType: 'image',
    });

    await this.userRepository.update(userId, {
      avatarUrl: uploadResult.secureUrl,
    });

    return { avatarUrl: uploadResult.secureUrl };
  }

  async getNotificationPreferences(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'notificationPreferences'],
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return mergeNotificationPreferences(user.notificationPreferences);
  }

  async updateNotificationPreferences(
    userId: string,
    dto: UpdateNotificationPreferencesDto,
  ) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const current = mergeNotificationPreferences(user.notificationPreferences);
    const next: NotificationPreferences = { ...current, ...dto };
    user.notificationPreferences = next;
    await this.userRepository.save(user);
    return next;
  }

  async switchRole(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: { tutorProfile: true, studentProfile: true },
    });
    if (!user) throw new UnauthorizedException('User not found');

    if (user.role === UserRole.STUDENT) {
      if (!user.tutorProfile) {
        throw new BadRequestException(
          'You need to apply and be approved as a tutor first',
        );
      }
      user.role = UserRole.TUTOR;
    } else if (user.role === UserRole.TUTOR) {
      user.role = UserRole.STUDENT;
    } else {
      throw new BadRequestException('Admins cannot switch roles');
    }

    const saved = await this.userRepository.save(user);
    return this.sanitizeUser(saved);
  }

  async deleteMe(userId: string) {
    await this.dataSource.transaction(async (manager) => {
      const user = await manager.findOne(User, {
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      const lessons = await manager.find(Lesson, {
        where: [
          {
            studentId: userId,
            status: In([LessonStatus.PENDING, LessonStatus.CONFIRMED]),
          },
          {
            tutorId: userId,
            status: In([LessonStatus.PENDING, LessonStatus.CONFIRMED]),
          },
        ],
      });

      for (const lesson of lessons) {
        // Pending lessons have not been charged yet. Only confirmed lessons
        // may be refunded during account deletion.
        if (lesson.status === LessonStatus.CONFIRMED) {
          await manager.increment(
            StudentProfile,
            { userId: lesson.studentId },
            'balance',
            lesson.price,
          );
        }

        lesson.status = LessonStatus.CANCELLED;
        await manager.save(Lesson, lesson);
      }

      user.deletedAt = new Date();
      await manager.save(User, user);
    });

    // Invalidate Redis session after transaction completes
    await this.redisService.del(`user_session:${userId}`);

    return { message: 'Account deleted successfully' };
  }

  private isEmailConflict(error: unknown) {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const databaseError = error as { code?: string; constraint?: string };
    return (
      databaseError.code === '23505' ||
      Boolean(databaseError.constraint?.includes('email'))
    );
  }

  private isSupportedImage(buffer: Buffer, mime: string) {
    if (mime === 'image/jpeg') {
      return buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
    }
    if (mime === 'image/png') {
      return buffer
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    }
    return mime === 'image/webp' && buffer.subarray(0, 4).toString() === 'RIFF';
  }

  private sanitizeUser(user: User) {
    const safeUser = { ...user } as Partial<User>;
    delete safeUser.passwordHash;
    return safeUser;
  }
}
