import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@mrh/types';
import { User } from '../users/entities/user.entity.js';
import { AuthService } from './auth.service.js';
import { RedisService } from '../redis/redis.service.js';
import { EmailService } from '../integrations/email/email.service.js';
import { RegisterDto } from './dto/register.dto.js';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn().mockResolvedValue(true),
}));

describe('AuthService', () => {
  let service: AuthService;

  const userRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    softDelete: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
    })),
  };

  const dataSource = {
    transaction: jest.fn(),
  };

  const redisService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  const emailService = {
    sendEmail: jest.fn().mockResolvedValue(undefined),
  };

  const makeTransactionManager = () => ({
    create: jest.fn((_entity, data) => data),
    save: jest.fn(async (entity) => {
      if (entity.id) return entity;
      return { ...entity, id: 'new-user-id' };
    }),
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: getDataSourceToken(), useValue: dataSource },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn((payload, _options) => `token-${payload.type}`),
            verify: jest.fn((token) => {
              if (token === 'valid-refresh')
                return {
                  sub: 'user-1',
                  email: 'test@test.com',
                  role: UserRole.STUDENT,
                  type: 'refresh',
                  sessionId: 'session-1',
                };
              if (token === 'expired-refresh') throw new Error('jwt expired');
              if (token === 'student-refresh')
                return {
                  sub: 'student-1',
                  email: 'student@test.com',
                  role: UserRole.STUDENT,
                  type: 'refresh',
                  sessionId: 'session-1',
                };
              throw new UnauthorizedException('Invalid token');
            }),
          },
        },
        { provide: RedisService, useValue: redisService },
        { provide: EmailService, useValue: emailService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    const registerDto: RegisterDto = {
      email: 'new@test.com',
      password: 'StrongPass1',
      firstName: 'New',
      lastName: 'User',
      role: 'student',
    };

    it('throws ConflictException if email already exists', async () => {
      userRepository.findOne.mockResolvedValue({ id: 'existing' });
      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('registers a student role and creates student profile', async () => {
      userRepository.findOne.mockResolvedValue(null);
      const savedUser = {
        id: 'new-user-id',
        email: 'new@test.com',
        role: UserRole.STUDENT,
        firstName: 'New',
        lastName: 'User',
        passwordHash: 'hashed-password',
      };
      const txManager = makeTransactionManager();
      txManager.save.mockImplementation(async (entity) => {
        if (entity.email) return savedUser;
        return entity;
      });
      dataSource.transaction.mockImplementation(async (cb) => cb(txManager));

      const result = await service.register(registerDto);

      expect(result.user.role).toBe(UserRole.STUDENT);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('registers a tutor role and creates tutor profile', async () => {
      userRepository.findOne.mockResolvedValue(null);
      const savedUser = {
        id: 'new-tutor-id',
        email: 'tutor@test.com',
        role: UserRole.TUTOR,
        passwordHash: 'hashed-password',
      };
      const txManager = makeTransactionManager();
      txManager.save.mockImplementation(async (entity) => {
        if (entity.email) return savedUser;
        return entity;
      });
      dataSource.transaction.mockImplementation(async (cb) => cb(txManager));

      const result = await service.register({
        ...registerDto,
        email: 'tutor@test.com',
        role: 'tutor',
      });

      expect(result.user.role).toBe(UserRole.TUTOR);
    });
  });

  describe('login', () => {
    const loginDto = { email: 'test@test.com', password: 'password123' };

    it('returns auth response on valid credentials', async () => {
      const queryBuilder = {
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          id: 'user-1',
          email: 'test@test.com',
          role: UserRole.STUDENT,
          passwordHash: 'hashed-password',
          firstName: 'Test',
          lastName: 'User',
        }),
      };
      userRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      const result = await service.login(loginDto);
      expect(result.accessToken).toContain('token-');
      expect(result.refreshToken).toContain('token-');
    });

    it('throws UnauthorizedException if user not found', async () => {
      const queryBuilder = {
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      userRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException if password is wrong', async () => {
      const queryBuilder = {
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          id: 'user-1',
          email: 'test@test.com',
          passwordHash: 'hashed-password',
        }),
      };
      userRepository.createQueryBuilder.mockReturnValue(queryBuilder);
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('getMe', () => {
    it('returns user without passwordHash', async () => {
      userRepository.findOne.mockResolvedValue({
        id: 'user-1',
        email: 'test@test.com',
        passwordHash: 'secret',
        firstName: 'Test',
        tutorProfile: null,
        studentProfile: { id: 'sp-1' },
      });

      const result = await service.getMe('user-1');
      expect(result).not.toHaveProperty('passwordHash');
      expect(result.email).toBe('test@test.com');
    });

    it('throws if user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);
      await expect(service.getMe('user-1')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('forgotPassword', () => {
    it('sends reset email if user exists', async () => {
      userRepository.findOne.mockResolvedValue({
        id: 'user-1',
        email: 'test@test.com',
      });

      const result = await service.forgotPassword({
        email: 'test@test.com',
      });

      expect(redisService.set).toHaveBeenCalled();
      expect(emailService.sendEmail).toHaveBeenCalled();
      expect(result.message).toContain('reset link has been sent');
    });

    it('returns same message even if user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      const result = await service.forgotPassword({
        email: 'unknown@test.com',
      });

      expect(result.message).toContain('reset link has been sent');
      expect(emailService.sendEmail).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('resets password with valid token', async () => {
      redisService.get.mockResolvedValue('test@test.com');
      const queryBuilder = {
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          id: 'user-1',
          email: 'test@test.com',
          passwordHash: 'old-hash',
        }),
      };
      userRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      const result = await service.resetPassword({
        token: 'valid-token',
        newPassword: 'NewPass1',
      });

      expect(redisService.del).toHaveBeenCalledWith('reset_token:valid-token');
      expect(result.message).toContain('Password reset successfully');
    });

    it('throws if token is invalid', async () => {
      redisService.get.mockResolvedValue(null);
      await expect(
        service.resetPassword({ token: 'bad-token', newPassword: 'NewPass1' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('logout', () => {
    it('clears session and sets refresh blocklist', async () => {
      await service.logout('user-1');
      expect(redisService.del).toHaveBeenCalledWith('user_session:user-1');
      expect(redisService.set).toHaveBeenCalledWith(
        'refresh_blocklist:user-1',
        'revoked',
        'EX',
        30 * 24 * 60 * 60,
      );
    });
  });

  describe('deleteAccount', () => {
    it('soft deletes user and logs out', async () => {
      await service.deleteAccount('user-1');
      expect(userRepository.softDelete).toHaveBeenCalledWith({ id: 'user-1' });
      expect(redisService.del).toHaveBeenCalledWith('user_session:user-1');
    });
  });

  describe('refreshTokens', () => {
    it('returns new tokens with valid refresh token', async () => {
      userRepository.findOne.mockResolvedValue({
        id: 'user-1',
        email: 'test@test.com',
        role: UserRole.STUDENT,
      });
      redisService.get
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('session-1');

      const result = await service.refreshTokens('student-refresh');
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('throws if user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);
      await expect(service.refreshTokens('valid-refresh')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws if refresh token is revoked', async () => {
      userRepository.findOne.mockResolvedValue({
        id: 'user-1',
        email: 'test@test.com',
        role: UserRole.STUDENT,
      });
      redisService.get.mockResolvedValue('revoked');

      await expect(service.refreshTokens('valid-refresh')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws if token is expired', async () => {
      await expect(service.refreshTokens('expired-refresh')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('handleGoogleLogin', () => {
    const googleProfile = {
      googleId: 'google-123',
      email: 'google@test.com',
      firstName: 'Google',
      lastName: 'User',
    };

    it('returns auth response for existing google user', async () => {
      userRepository.findOne.mockResolvedValueOnce({
        id: 'existing-google',
        email: 'google@test.com',
        role: UserRole.STUDENT,
        googleId: 'google-123',
        passwordHash: 'hash',
      });

      const result = await service.handleGoogleLogin(googleProfile);
      expect(result.accessToken).toBeDefined();
    });

    it('creates new user if googleId not found', async () => {
      userRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      userRepository.create.mockReturnValue({
        googleId: 'google-123',
        email: 'google@test.com',
        firstName: 'Google',
        lastName: 'User',
        role: UserRole.STUDENT,
        isVerified: true,
        passwordHash: 'hashed-password',
      });

      const txManager = makeTransactionManager();
      txManager.save.mockImplementation(async (entity) => {
        if (entity.email) return { ...entity, id: 'new-google-user' };
        return entity;
      });
      dataSource.transaction.mockImplementation(async (cb) => cb(txManager));

      const result = await service.handleGoogleLogin(googleProfile);
      expect(result.accessToken).toBeDefined();
    });
  });
});
