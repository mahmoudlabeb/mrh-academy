import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TutorsService } from './tutors.service.js';
import { TutorsController } from './tutors.controller.js';
import { TutorProfile } from '../entities/tutor-profile.entity.js';
import { User } from '../entities/user.entity.js';
import { Review } from '../entities/review.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([TutorProfile, User, Review])],
  providers: [TutorsService],
  controllers: [TutorsController],
  exports: [TutorsService],
})
export class TutorsModule {}
