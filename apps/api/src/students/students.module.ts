import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentProfile } from '../entities/student-profile.entity.js';
import { Payment } from '../entities/payment.entity.js';
import { Lesson } from '../entities/lesson.entity.js';
import { TutorProfile } from '../entities/tutor-profile.entity.js';
import { Review } from '../entities/review.entity.js';
import { StudentsController } from './students.controller.js';
import { StudentsService } from './students.service.js';
import { UsersModule } from '../users/users.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StudentProfile,
      Payment,
      Lesson,
      TutorProfile,
      Review,
    ]),
    UsersModule,
  ],
  controllers: [StudentsController],
  providers: [StudentsService],
})
export class StudentsModule {}
