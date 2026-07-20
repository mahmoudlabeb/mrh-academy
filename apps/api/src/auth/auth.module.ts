import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import type { JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { GoogleStrategy } from './strategies/google.strategy.js';
import { GoogleConfigGuard } from './guards/google-config.guard.js';
import { User } from '../users/entities/user.entity.js';
import { StudentProfile } from '../students/entities/student-profile.entity.js';
import { TutorProfile } from '../tutors/entities/tutor-profile.entity.js';
import { SubAdminProfile } from '../admin/entities/sub-admin-profile.entity.js';
import { EmailService } from '../integrations/email/email.service.js';
import { GoogleAuthExceptionFilter } from './filters/google-auth-exception.filter.js';
import { getJwtSignOptions, getJwtVerifyOptions } from './jwt-profile.js';
import { GoogleOAuthGuard } from './guards/google-oauth.guard.js';

type JwtExpiresIn = NonNullable<
  NonNullable<JwtModuleOptions['signOptions']>['expiresIn']
>;

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      User,
      StudentProfile,
      TutorProfile,
      SubAdminProfile,
    ]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET')!,
        signOptions: {
          ...getJwtSignOptions(configService),
          expiresIn: configService.get<JwtExpiresIn>('JWT_EXPIRES_IN') || '7d',
        },
        verifyOptions: getJwtVerifyOptions(configService),
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    GoogleStrategy,
    EmailService,
    GoogleConfigGuard,
    GoogleOAuthGuard,
    GoogleAuthExceptionFilter,
  ],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
