import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
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
  ) {
    cloudinary.config({
      cloud_name: this.configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get<string>('CLOUDINARY_API_SECRET'),
    });
  }

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
        'Password change is not available for accounts linked via Google',
      );
    }

    const isPasswordValid = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    user.passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.userRepository.save(user);

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
      const isPasswordValid = await bcrypt.compare(
        dto.currentPassword,
        user.passwordHash,
      );
      if (!isPasswordValid) {
        throw new UnauthorizedException('Current password is incorrect');
      }
    }

    user.email = dto.newEmail;
    try {
      const updated = await this.userRepository.save(user);
      return this.sanitizeUser(updated);
    } catch (error: unknown) {
      if (this.isEmailConflict(error)) {
        throw new ConflictException('Email is already registered');
      }
      throw error;
    }
  }

  async updateAvatar(userId: string, file: AvatarFile | undefined) {
    if (!file) {
      throw new BadRequestException('Avatar file is required');
    }
    if (file.size > this.maxAvatarSize) {
      throw new BadRequestException('Avatar file must be 2MB or smaller');
    }

    const uploadResult = await this.uploadToCloudinary(file.buffer);

    await this.userRepository.update(userId, {
      avatarUrl: uploadResult.secure_url,
    });

    return { avatarUrl: uploadResult.secure_url };
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
        await manager.increment(
          StudentProfile,
          { userId: lesson.studentId },
          'balance',
          lesson.price,
        );

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

  private uploadToCloudinary(buffer: Buffer): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'mrh-academy/avatars' },
        (error, result) => {
          if (error || !result) {
            reject(
              error instanceof Error
                ? error
                : new Error('Cloudinary upload failed'),
            );
            return;
          }
          resolve(result);
        },
      );
      stream.end(buffer);
    });
  }

  private sanitizeUser(user: User) {
    const safeUser = { ...user } as Partial<User>;
    delete safeUser.passwordHash;
    return safeUser;
  }
}
