import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
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
import { ReminderService } from './services/reminder.service.js';
import { EmailService } from './services/email.service.js';
import { Lesson } from './entities/lesson.entity.js';
import { RedisModule } from './redis/redis.module.js';
import { UsersModule } from './users/users.module.js';
import { TutorsModule } from './tutors/tutors.module.js';
import { AdminModule } from './admin/admin.module.js';
import { ArticlesModule } from './articles/articles.module.js';
import { AvailabilityModule } from './availability/availability.module.js';
import { ReviewsModule } from './reviews/reviews.module.js';
import { PaymentsModule } from './payments/payments.module.js';
import { LessonsModule } from './lessons/lessons.module.js';
import { MessagesModule } from './messages/messages.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { ClassroomModule } from './gateway/classroom.module.js';
import { CoursesModule } from './courses/courses.module.js';
import { StudentsModule } from './students/students.module.js';
import { SharedModule } from './shared/shared.module.js';
import { VocabularyModule } from './vocabulary/vocabulary.module.js';
import { CsrfOriginMiddleware } from './common/csrf.middleware.js';
import { XssCleanMiddleware } from './common/xss-clean.middleware.js';
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
        STRIPE_SECRET_KEY: Joi.string().optional().allow(''),
        STRIPE_WEBHOOK_SECRET: Joi.string().optional().allow(''),
        BUNNY_API_KEY: Joi.string().optional().allow(''),
        BUNNY_LIBRARY_ID: Joi.string().optional().allow(''),
        GEMINI_API_KEY: Joi.string().optional().allow(''),
        DB_SYNCHRONIZE: Joi.string().valid('true', 'false').default('false'),
        RUN_MIGRATIONS: Joi.string().valid('true', 'false').default('false'),
        DATABASE_SSL_REJECT_UNAUTHORIZED: Joi.string()
          .valid('true', 'false')
          .default('true'),
        NODE_ENV: Joi.string()
          .valid('development', 'test', 'production')
          .default('development'),
      }),
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const dbUrl = configService.get<string>('DATABASE_URL');
        const nodeEnv = configService.get<string>('NODE_ENV', 'development');
        const sslRejectUnauthorized =
          configService.get<string>('DATABASE_SSL_REJECT_UNAUTHORIZED') !==
          'false';
        const runMigrations =
          configService.get<string>('RUN_MIGRATIONS') === 'true';
        const dbSynchronize =
          configService.get<string>('DB_SYNCHRONIZE') === 'true';

        return {
          type: 'postgres',
          ...(dbUrl
            ? {
                url: dbUrl,
                ssl: { rejectUnauthorized: sslRejectUnauthorized },
              }
            : {
                host: configService.get<string>('DATABASE_HOST'),
                port: configService.get<number>('DATABASE_PORT'),
                username: configService.get<string>('DATABASE_USER'),
                password: configService.get<string>('DATABASE_PASSWORD'),
                database: configService.get<string>('DATABASE_NAME'),
                ssl: false,
              }),
          autoLoadEntities: true,
          entities: Object.values(dbEntities),
          synchronize: dbSynchronize && nodeEnv !== 'production',
          migrations: ['dist/database/migrations/*.js'],
          migrationsRun: runMigrations,
        };
      },
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([Lesson]),
    SharedModule,
    RedisModule,
    AuthModule,
    UsersModule,
    TutorsModule,
    AdminModule,
    ArticlesModule,
    AvailabilityModule,
    ReviewsModule,
    PaymentsModule,
    LessonsModule,
    MessagesModule,
    ReportsModule,
    ClassroomModule,
    CoursesModule,
    StudentsModule,
    VocabularyModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    ReminderService,
    EmailService,
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
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CsrfOriginMiddleware, XssCleanMiddleware).forRoutes('*');
  }
}
