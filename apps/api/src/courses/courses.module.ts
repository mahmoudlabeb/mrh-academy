import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Course } from './entities/course.entity.js';
import { CourseEnrollment } from './entities/course-enrollment.entity.js';
import { CourseLesson } from './entities/course-lesson.entity.js';
import { CourseLessonCompletion } from './entities/course-lesson-completion.entity.js';
import { TutorProfile } from '../tutors/entities/tutor-profile.entity.js';
import { StudentProfile } from '../students/entities/student-profile.entity.js';
import { CoursesController } from './courses.controller.js';
import { CoursesService } from './courses.service.js';
import { BunnyService } from '../integrations/video/bunny.service.js';
import { PaymentsModule } from '../payments/payments.module.js';

@Module({
  imports: [
    PaymentsModule,
    TypeOrmModule.forFeature([
      Course,
      CourseEnrollment,
      CourseLesson,
      CourseLessonCompletion,
      TutorProfile,
      StudentProfile,
    ]),
  ],
  controllers: [CoursesController],
  providers: [CoursesService, BunnyService],
})
export class CoursesModule {}
