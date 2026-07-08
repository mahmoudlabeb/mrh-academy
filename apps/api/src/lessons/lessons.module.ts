import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Lesson } from '../entities/lesson.entity.js';
import { TutorProfile } from '../entities/tutor-profile.entity.js';
import { StudentProfile } from '../entities/student-profile.entity.js';
import { Classroom } from '../entities/classroom.entity.js';
import { User } from '../entities/user.entity.js';
import { CommissionService } from '../services/commission.service.js';
import { CalendarService } from '../services/calendar.service.js';
import { EmailService } from '../services/email.service.js';
import { LessonsController } from './lessons.controller.js';
import { LessonsService } from './lessons.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Lesson,
      TutorProfile,
      StudentProfile,
      Classroom,
      User,
    ]),
  ],
  controllers: [LessonsController],
  providers: [LessonsService, CalendarService, EmailService],
})
export class LessonsModule {}
