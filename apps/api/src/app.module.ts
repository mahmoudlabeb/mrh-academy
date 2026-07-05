import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import * as Joi from 'joi';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard.js';
import { RolesGuard } from './auth/guards/roles.guard.js';
import { PermissionsGuard } from './auth/guards/permissions.guard.js';
import { SessionGuard } from './auth/guards/session.guard.js';
import { RedisModule } from './redis/redis.module.js';
import { ReviewsModule } from './reviews/reviews.module.js';
import { UsersModule } from './users/users.module.js';
import { TutorsModule } from './tutors/tutors.module.js';
import { AdminModule } from './admin/admin.module.js';
import { ArticlesModule } from './articles/articles.module.js';
import { AvailabilityModule } from './availability/availability.module.js';
// import { PaymentsModule } from './payments/payments.module.js';
import * as dbEntities from './entities/index.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        PORT: Joi.number().default(4000),
        DATABASE_HOST: Joi.string().default('localhost'),
        DATABASE_PORT: Joi.number().default(5432),
        DATABASE_USER: Joi.string().default('mrh_admin'),
        DATABASE_PASSWORD: Joi.string().default('mrh_password_dev'),
        DATABASE_NAME: Joi.string().default('mrh_academy_db'),
        JWT_SECRET: Joi.string().required(),
        JWT_EXPIRES_IN: Joi.string().default('7d'),
        REDIS_URL: Joi.string().default('redis://localhost:6379'),
        FRONTEND_URL: Joi.string().default('http://localhost:3000'),
        GOOGLE_CLIENT_ID: Joi.string().optional().allow(''),
        GOOGLE_CLIENT_SECRET: Joi.string().optional().allow(''),
        GOOGLE_CALLBACK_URL: Joi.string().optional().allow(''),
        CLOUDINARY_CLOUD_NAME: Joi.string().optional().allow(''),
        CLOUDINARY_API_KEY: Joi.string().optional().allow(''),
        CLOUDINARY_API_SECRET: Joi.string().optional().allow(''),
        NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
      }),
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('DATABASE_URL'),
        ssl: true,
        autoLoadEntities: true,
        entities: Object.values(dbEntities),
        synchronize: true, // For development/testing
      }),
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    RedisModule,
    AuthModule,
    UsersModule,
    TutorsModule,
    AdminModule,
    ArticlesModule,
    AvailabilityModule,
    // PaymentsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: SessionGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
})
export class AppModule {}
