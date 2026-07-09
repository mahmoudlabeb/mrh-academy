import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Lesson } from '../entities/lesson.entity.js';
import { LessonBook } from '../entities/lesson-book.entity.js';
import { TutorProfile } from '../entities/tutor-profile.entity.js';
import { StudentProfile } from '../entities/student-profile.entity.js';
import { Classroom } from '../entities/classroom.entity.js';
import { User } from '../entities/user.entity.js';
import { TutorAvailability } from '../entities/tutor-availability.entity.js';
import { CalendarService } from '../services/calendar.service.js';
import { EmailService } from '../services/email.service.js';
import { LessonsController } from './lessons.controller.js';
import { LessonBooksController } from './lesson-books.controller.js';
import { LessonsService } from './lessons.service.js';
import { LessonBooksService } from './lesson-books.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Lesson,
      LessonBook,
      TutorProfile,
      StudentProfile,
      Classroom,
      User,
      TutorAvailability,
    ]),
  ],
  controllers: [LessonsController, LessonBooksController],
  providers: [
    LessonsService,
    LessonBooksService,
    CalendarService,
    EmailService,
  ],
  exports: [LessonsService],
})
export class LessonsModule {}
