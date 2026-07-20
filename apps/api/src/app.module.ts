import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module.js';
import { ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard.js';
import { RolesGuard } from './auth/guards/roles.guard.js';
import { PermissionsGuard } from './auth/guards/permissions.guard.js';
import { SessionGuard } from './auth/guards/session.guard.js';
import { MaintenanceGuard } from './auth/guards/maintenance.guard.js';
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
import { ClassroomModule } from './classroom/classroom.module.js';
import { CoursesModule } from './courses/courses.module.js';
import { StudentsModule } from './students/students.module.js';
import { VocabularyModule } from './vocabulary/vocabulary.module.js';
import { CsrfOriginMiddleware } from './common/csrf.middleware.js';
import { HealthModule } from './health/health.module.js';
import { SnakeNamingStrategy } from './common/database/snake-naming.strategy.js';
import { applicationConfig } from './config/application.config.js';
import { authConfig } from './config/auth.config.js';
import { databaseConfig } from './config/database.config.js';
import { integrationsConfig } from './config/integrations.config.js';
import { environmentValidationSchema } from './config/environment.validation.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [applicationConfig, authConfig, databaseConfig, integrationsConfig],
      validationSchema: environmentValidationSchema,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule.forFeature(databaseConfig)],
      inject: [databaseConfig.KEY],
      useFactory: (database: ConfigType<typeof databaseConfig>) => ({
        type: 'postgres' as const,
        ...database.connection,
        autoLoadEntities: true,
        namingStrategy: new SnakeNamingStrategy(),
        synchronize: false,
        migrations: ['dist/database/migrations/*.js'],
        migrationsRun: false,
      }),
    }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 100 }]),
    ScheduleModule.forRoot(),
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
    HealthModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
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
    {
      provide: APP_GUARD,
      useClass: MaintenanceGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CsrfOriginMiddleware).forRoutes('*');
  }
}
