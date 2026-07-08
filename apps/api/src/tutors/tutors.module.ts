import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TutorsService } from './tutors.service.js';
import { TutorsController } from './tutors.controller.js';
import { TutorDashboardController } from './tutor-dashboard.controller.js';
import { AvailabilityModule } from '../availability/availability.module.js';
import { TutorProfile } from '../entities/tutor-profile.entity.js';
import { User } from '../entities/user.entity.js';
import { Review } from '../entities/review.entity.js';
import { Lesson } from '../entities/lesson.entity.js';
import { Payment } from '../entities/payment.entity.js';
import { Report } from '../entities/report.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([TutorProfile, User, Review, Lesson, Payment, Report]), AvailabilityModule],
  providers: [TutorsService],
  controllers: [TutorsController, TutorDashboardController],
  exports: [TutorsService],
})
export class TutorsModule {}