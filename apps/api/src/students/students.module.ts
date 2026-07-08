import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentProfile } from '../entities/student-profile.entity.js';
import { Payment } from '../entities/payment.entity.js';
import { Lesson } from '../entities/lesson.entity.js';
import { TutorProfile } from '../entities/tutor-profile.entity.js';
import { Review } from '../entities/review.entity.js';
import { StudentsController } from './students.controller.js';
import { StudentsService } from './students.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([StudentProfile, Payment, Lesson, TutorProfile, Review])],
  controllers: [StudentsController],
  providers: [StudentsService],
})
export class StudentsModule {}
