import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminTutorsController } from './admin-tutors.controller.js';
import { AdminStatsController } from './admin-stats.controller.js';
import { AdminStudentsController } from './admin-students.controller.js';
import { AdminLessonsController } from './admin-lessons.controller.js';
import { AdminEmployeesController } from './admin-employees.controller.js';
import { AdminSettingsController } from './admin-settings.controller.js';
import { AdminCoursesController } from './admin-courses.controller.js';
import { AdminReviewsController } from './admin-reviews.controller.js';
import { AdminImpersonationController } from './admin-impersonation.controller.js';
import { AdminPaymentsController } from './admin-payments.controller.js';
import { AdminReportsController } from './admin-reports.controller.js';
import { AdminEmployeesService } from './admin-employees.service.js';
import { TutorsModule } from '../tutors/tutors.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { PaymentsModule } from '../payments/payments.module.js';
import { ReportsModule } from '../reports/reports.module.js';
import { User } from '../entities/user.entity.js';
import { StudentProfile } from '../entities/student-profile.entity.js';
import { TutorProfile } from '../entities/tutor-profile.entity.js';
import { Lesson } from '../entities/lesson.entity.js';
import { Employee } from '../entities/employee.entity.js';
import { SubAdminProfile } from '../entities/sub-admin-profile.entity.js';
import { Setting } from '../entities/setting.entity.js';
import { Course } from '../entities/course.entity.js';
import { CourseEnrollment } from '../entities/course-enrollment.entity.js';
import { Review } from '../entities/review.entity.js';
import { Payment } from '../entities/payment.entity.js';
import { Report } from '../entities/report.entity.js';
import { Payout } from '../entities/payout.entity.js';

@Module({
  imports: [
    TutorsModule,
    AuthModule,
    PaymentsModule,
    ReportsModule,
    TypeOrmModule.forFeature([
      User,
      StudentProfile,
      TutorProfile,
      Lesson,
      Employee,
      SubAdminProfile,
      Setting,
      Course,
      CourseEnrollment,
      Review,
      Payment,
      Report,
      Payout,
    ]),
  ],
  providers: [AdminEmployeesService],
  controllers: [
    AdminTutorsController,
    AdminStatsController,
    AdminStudentsController,
    AdminLessonsController,
    AdminEmployeesController,
    AdminSettingsController,
    AdminCoursesController,
    AdminReviewsController,
    AdminImpersonationController,
    AdminPaymentsController,
    AdminReportsController,
  ],
})
export class AdminModule {}
