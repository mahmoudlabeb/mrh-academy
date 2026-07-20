import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TutorsService } from './tutors.service.js';
import { TutorsController } from './tutors.controller.js';
import { TutorDashboardController } from './tutor-dashboard.controller.js';
import { AvailabilityModule } from '../availability/availability.module.js';
import { TutorProfile } from './entities/tutor-profile.entity.js';
import { User } from '../users/entities/user.entity.js';
import { Review } from '../reviews/entities/review.entity.js';
import { Lesson } from '../lessons/entities/lesson.entity.js';
import { Payment } from '../payments/entities/payment.entity.js';
import { Report } from '../reports/entities/report.entity.js';
import { StorageModule } from '../integrations/storage/storage.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TutorProfile,
      User,
      Review,
      Lesson,
      Payment,
      Report,
    ]),
    AvailabilityModule,
    StorageModule,
  ],
  providers: [TutorsService],
  controllers: [TutorsController, TutorDashboardController],
  exports: [TutorsService],
})
export class TutorsModule {}
