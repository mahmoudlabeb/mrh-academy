import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { User } from '../entities/user.entity.js';
import { StudentProfile } from '../entities/student-profile.entity.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RedisService } from '../redis/redis.service.js';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.userRepository.findOne({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    try {
      const result = await this.dataSource.transaction(async (manager) => {
        const user = manager.create(User, {
          email: dto.email,
          passwordHash: hashedPassword,
          firstName: dto.firstName,
          lastName: dto.lastName,
          role: 'student' as any,
        });
        const savedUser = await manager.save(user);

        const profile = manager.create(StudentProfile, {
          userId: savedUser.id,
        });
        await manager.save(profile);

        return savedUser;
      });

      const payload: Record<string, string> = {
        sub: result.id,
        email: result.email,
        role: result.role,
      };
      if (result.role === 'student') {
        const sessionId = randomUUID();
        payload.sessionId = sessionId;
        await this.redisService.set(
          `user_session:${result.id}`,
          sessionId,
          'EX',
          7 * 24 * 60 * 60,
        );
      }

      const accessToken = this.jwtService.sign(payload);

      const { passwordHash, ...safeUser } = result;
      return { accessToken, user: safeUser };
    } catch (error: any) {
      // Check for unique constraint violation on email
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

    const payload: Record<string, string> = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    if (user.role === 'student') {
      const sessionId = randomUUID();
      payload.sessionId = sessionId;
      await this.redisService.set(
        `user_session:${user.id}`,
        sessionId,
        'EX',
        7 * 24 * 60 * 60,
      );
    }

    const accessToken = this.jwtService.sign(payload);

    const { passwordHash, ...safeUser } = user;
    return { accessToken, user: safeUser };
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

    const { passwordHash, ...safeUser } = user;
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
      where: [
        { googleId: googleProfile.googleId },
        { email: googleProfile.email },
      ],
    });

    if (!user) {
      const newUser = this.userRepository.create({
        googleId: googleProfile.googleId,
        email: googleProfile.email,
        firstName: googleProfile.firstName,
        lastName: googleProfile.lastName,
        avatarUrl: googleProfile.avatarUrl,
        role: 'student' as any,
        isVerified: true,
        passwordHash: '',
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
    } else if (!user.googleId) {
      user.googleId = googleProfile.googleId;
      user = await this.userRepository.save(user);
    }

    const payload: Record<string, string> = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    if (user.role === 'student') {
      const sessionId = randomUUID();
      payload.sessionId = sessionId;
      await this.redisService.set(
        `user_session:${user.id}`,
        sessionId,
        'EX',
        7 * 24 * 60 * 60,
      );
    }

    const accessToken = this.jwtService.sign(payload);

    const { passwordHash, ...safeUser } = user;
    return { accessToken, user: safeUser };
  }

  async logout(userId: string) {
    await this.redisService.del(`user_session:${userId}`);
  }
}
