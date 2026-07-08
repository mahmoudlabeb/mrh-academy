import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Course } from '../entities/course.entity.js';
import { CourseEnrollment } from '../entities/course-enrollment.entity.js';
import { CourseLesson } from '../entities/course-lesson.entity.js';
import { CourseLessonCompletion } from '../entities/course-lesson-completion.entity.js';
import { TutorProfile } from '../entities/tutor-profile.entity.js';
import { StudentProfile } from '../entities/student-profile.entity.js';
import { CoursesController } from './courses.controller.js';
import { CoursesService } from './courses.service.js';
import { BunnyService } from '../services/bunny.service.js';

@Module({
  imports: [
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
