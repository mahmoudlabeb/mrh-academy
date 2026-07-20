import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Lesson } from './entities/lesson.entity.js';
import { LessonBook } from './entities/lesson-book.entity.js';
import { TutorProfile } from '../tutors/entities/tutor-profile.entity.js';
import { StudentProfile } from '../students/entities/student-profile.entity.js';
import { Classroom } from '../classroom/entities/classroom.entity.js';
import { User } from '../users/entities/user.entity.js';
import { TutorAvailability } from '../tutors/entities/tutor-availability.entity.js';
import { CalendarService } from '../integrations/google/calendar.service.js';
import { EmailService } from '../integrations/email/email.service.js';
import { LessonsController } from './lessons.controller.js';
import { LessonBooksController } from './lesson-books.controller.js';
import { LessonsService } from './lessons.service.js';
import { LessonBooksService } from './lesson-books.service.js';
import { ReminderService } from './reminder.service.js';
import { PaymentsModule } from '../payments/payments.module.js';
import { RedisModule } from '../redis/redis.module.js';

@Module({
  imports: [
    PaymentsModule,
    RedisModule,
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
    ReminderService,
  ],
  exports: [LessonsService],
})
export class LessonsModule {}
