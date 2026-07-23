import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { createHmac } from 'node:crypto';
import { CourseStatus, PaymentStatus, UserRole } from '@mrh/types';
import { Course } from './entities/course.entity.js';
import { CourseEnrollment } from './entities/course-enrollment.entity.js';
import { CourseLesson } from './entities/course-lesson.entity.js';
import { CourseLessonCompletion } from './entities/course-lesson-completion.entity.js';
import { TutorProfile } from '../tutors/entities/tutor-profile.entity.js';
import { StudentProfile } from '../students/entities/student-profile.entity.js';
import { CoursePromoCode } from './entities/course-promo-code.entity.js';
import { CommissionService } from '../payments/commission.service.js';
import { ConfigService } from '@nestjs/config';
import { Payment } from '../payments/entities/payment.entity.js';
import { CourseFundingAllocation } from '../payments/entities/course-funding-allocation.entity.js';

@Injectable()
export class CoursesService {
  constructor(
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
    @InjectRepository(CourseEnrollment)
    private readonly enrollmentRepository: Repository<CourseEnrollment>,
    @InjectRepository(CourseLesson)
    private readonly lessonRepository: Repository<CourseLesson>,
    @InjectRepository(CourseLessonCompletion)
    private readonly completionRepository: Repository<CourseLessonCompletion>,
    @InjectRepository(TutorProfile)
    private readonly tutorProfileRepository: Repository<TutorProfile>,
    @InjectRepository(StudentProfile)
    private readonly studentProfileRepository: Repository<StudentProfile>,
    private readonly commissionService: CommissionService,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  private isValidCourseReferral(
    referralCode: string | undefined,
    tutorId: string,
    courseId: string,
  ): boolean {
    if (!referralCode) {
      return false;
    }
    const secret = this.config.get<string>('application.referralSecret');
    if (!secret) {
      return false;
    }
    return referralCode === this.getCourseReferralCode(tutorId, courseId);
  }

  private getCourseReferralCode(tutorId: string, courseId: string): string {
    const secret = this.config.get<string>('application.referralSecret');
    if (!secret) {
      throw new Error('Referral signing secret is not configured');
    }
    const signature = createHmac('sha256', secret)
      .update(`${courseId}:${tutorId}`)
      .digest('hex')
      .slice(0, 16);
    return `${tutorId}.${signature}`;
  }

  async findAllApproved() {
    return this.courseRepository.find({
      where: { status: CourseStatus.APPROVED },
      relations: { tutor: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, viewerId?: string, viewerRole?: UserRole) {
    const course = await this.courseRepository.findOne({
      where: { id },
      relations: { tutor: true },
    });
    if (!course) throw new NotFoundException('Course not found');

    const canBypass =
      viewerRole === UserRole.ADMIN ||
      viewerRole === UserRole.SUBADMIN ||
      (viewerId && course.tutorId === viewerId);

    if (course.status !== CourseStatus.APPROVED && !canBypass) {
      throw new NotFoundException('Course not found');
    }

    return course;
  }

  async isEnrolled(studentId: string, courseId: string): Promise<boolean> {
    const enrollment = await this.enrollmentRepository.findOne({
      where: { studentId, courseId },
    });
    return Boolean(enrollment);
  }

  async assertEnrollment(studentId: string, courseId: string) {
    const enrolled = await this.isEnrolled(studentId, courseId);
    if (!enrolled) {
      throw new ForbiddenException(
        'You must enroll in this course to access its content',
      );
    }
  }

  async findLessons(courseId: string, userId: string, role: UserRole) {
    const course = await this.findOne(courseId, userId, role);
    if (role === UserRole.STUDENT) {
      await this.assertEnrollment(userId, courseId);
    } else if (role === UserRole.TUTOR && course.tutorId !== userId) {
      throw new ForbiddenException('You do not own this course');
    }

    const lessons = await this.lessonRepository.find({
      where: { courseId },
      order: { lessonOrder: 'ASC' },
    });

    if (role !== UserRole.STUDENT) {
      return lessons.map((lesson) => ({
        ...lesson,
        isCompleted: false,
      }));
    }

    const enrollment = await this.enrollmentRepository.findOne({
      where: { studentId: userId, courseId },
    });
    if (!enrollment) {
      return lessons.map((lesson) => ({
        ...lesson,
        isCompleted: false,
      }));
    }

    const completions = await this.completionRepository.find({
      where: { enrollmentId: enrollment.id },
      select: { courseLessonId: true },
    });
    const completedIds = new Set(completions.map((c) => c.courseLessonId));

    return lessons.map((lesson) => ({
      ...lesson,
      isCompleted: completedIds.has(lesson.id),
    }));
  }

  async create(
    tutorId: string,
    dto: {
      title: string;
      description: string;
      price: number;
      thumbnailUrl?: string;
      tags?: string[];
    },
  ) {
    const tutorProfile = await this.tutorProfileRepository.findOne({
      where: { userId: tutorId },
      select: { userId: true, status: true },
    });
    if (tutorProfile?.status !== CourseStatus.APPROVED) {
      throw new ForbiddenException(
        'Your tutor account must be approved before creating courses',
      );
    }

    const course = this.courseRepository.create({
      tutorId,
      title: dto.title,
      description: dto.description,
      price: dto.price,
      thumbnailUrl: dto.thumbnailUrl,
      status: CourseStatus.PENDING,
    });
    const savedCourse = await this.courseRepository.save(course);
    return {
      ...savedCourse,
      referralCode: this.getCourseReferralCode(tutorId, savedCourse.id),
    };
  }

  async enroll(
    studentId: string,
    courseId: string,
    dto?: {
      promoCode?: string;
      referralCode?: string;
    },
  ) {
    const course = await this.courseRepository.findOne({
      where: { id: courseId, status: CourseStatus.APPROVED },
    });
    if (!course)
      throw new NotFoundException('Course not found or not yet approved');

    const hasValidReferral = this.isValidCourseReferral(
      dto?.referralCode,
      course.tutorId,
      courseId,
    );
    const soldBy = hasValidReferral ? 'tutor' : 'academy';

    await this.dataSource.transaction(async (manager) => {
      const existing = await manager.findOne(CourseEnrollment, {
        where: { studentId, courseId },
        lock: { mode: 'pessimistic_write' },
      });
      if (existing)
        throw new BadRequestException('Already enrolled in this course');

      const studentProfile = await manager.findOne(StudentProfile, {
        where: { userId: studentId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!studentProfile)
        throw new NotFoundException('Student profile not found');

      let finalPrice = course.price;
      if (dto?.promoCode) {
        const promo = await manager.findOne(CoursePromoCode, {
          where: { code: dto.promoCode, courseId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!promo) {
          throw new BadRequestException('Invalid promo code');
        }
        if (promo.currentUses >= promo.usageLimit) {
          throw new BadRequestException('Promo code usage limit reached');
        }

        finalPrice = 0;

        promo.currentUses += 1;
        await manager.save(promo);
      }

      if (studentProfile.balance < finalPrice)
        throw new BadRequestException('Insufficient balance');

      if (finalPrice > 0) {
        const debitResult = await manager.decrement(
          StudentProfile,
          { userId: studentId },
          'balance',
          finalPrice,
        );
        if (!debitResult.affected) {
          throw new NotFoundException('Student profile not found');
        }
      }

      const { platformFee, tutorShare } =
        await this.commissionService.calculateCourseEarnings(
          finalPrice,
          soldBy,
        );

      if (tutorShare > 0) {
        const creditResult = await manager.increment(
          TutorProfile,
          { userId: course.tutorId },
          'balance',
          tutorShare,
        );
        if (!creditResult.affected) {
          throw new NotFoundException('Tutor profile not found');
        }
      }

      const enrollment = manager.create(CourseEnrollment, {
        studentId,
        courseId,
        platformFee,
        tutorShare,
        soldBy,
        referralTutorId: hasValidReferral ? course.tutorId : null,
      });
      await manager.save(enrollment);

      // Attribute pooled wallet funds to deposits in FIFO order. This makes a
      // later Stripe refund able to identify exactly which course access and
      // commissions were funded by the refunded deposit.
      let amountToAllocate = finalPrice;
      if (amountToAllocate > 0) {
        const deposits = await manager.find(Payment, {
          where: { userId: studentId, status: PaymentStatus.APPROVED },
          order: { createdAt: 'ASC' },
          lock: { mode: 'pessimistic_write' },
        });
        for (const deposit of deposits) {
          if (amountToAllocate <= 0) break;
          const available = Math.max(
            0,
            Number(deposit.amount) -
              Number(deposit.refundedAmount ?? 0) -
              Number(deposit.allocatedAmount ?? 0),
          );
          if (available <= 0) continue;
          const allocated = Math.min(available, amountToAllocate);
          deposit.allocatedAmount =
            Number(deposit.allocatedAmount ?? 0) + allocated;
          await manager.save(Payment, deposit);
          await manager.save(
            CourseFundingAllocation,
            manager.create(CourseFundingAllocation, {
              paymentId: deposit.id,
              enrollmentId: enrollment.id,
              amount: allocated,
            }),
          );
          amountToAllocate =
            Math.round((amountToAllocate - allocated) * 100) / 100;
        }
      }
    });

    return { message: 'Enrolled successfully', courseId };
  }

  async getEnrollments(studentId: string) {
    return this.enrollmentRepository.find({
      where: { studentId },
      relations: { course: { tutor: true } },
      order: { enrolledAt: 'DESC' },
    });
  }

  async getMyCourses(tutorId: string) {
    const courses = await this.courseRepository.find({
      where: { tutorId },
      order: { createdAt: 'DESC' },
    });
    return courses.map((course) => ({
      ...course,
      referralCode: this.getCourseReferralCode(tutorId, course.id),
    }));
  }

  async getTutorReferralStats(tutorId: string) {
    const rows = await this.enrollmentRepository
      .createQueryBuilder('enrollment')
      .innerJoin(Course, 'course', 'course.id = enrollment.course_id')
      .select('enrollment.sold_by', 'soldBy')
      .addSelect('COUNT(*)', 'sales')
      .addSelect('COALESCE(SUM(enrollment.tutor_share), 0)', 'tutorEarnings')
      .addSelect('COALESCE(SUM(enrollment.platform_fee), 0)', 'academyEarnings')
      .where('course.tutor_id = :tutorId', { tutorId })
      .groupBy('enrollment.sold_by')
      .getRawMany<{
        soldBy: 'tutor' | 'academy';
        sales: string;
        tutorEarnings: string;
        academyEarnings: string;
      }>();

    const empty = { sales: 0, tutorEarnings: 0, academyEarnings: 0 };
    return {
      tutor: {
        ...empty,
        ...this.toReferralStats(rows.find((row) => row.soldBy === 'tutor')),
      },
      academy: {
        ...empty,
        ...this.toReferralStats(rows.find((row) => row.soldBy === 'academy')),
      },
    };
  }

  private toReferralStats(row?: {
    sales: string;
    tutorEarnings: string;
    academyEarnings: string;
  }) {
    if (!row) return {};
    return {
      sales: Number(row.sales),
      tutorEarnings: Number(row.tutorEarnings),
      academyEarnings: Number(row.academyEarnings),
    };
  }

  async markLessonComplete(
    studentId: string,
    courseId: string,
    lessonId: string,
  ) {
    await this.assertEnrollment(studentId, courseId);

    const lesson = await this.lessonRepository.findOne({
      where: { id: lessonId, courseId },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');

    const enrollment = await this.enrollmentRepository.findOne({
      where: { studentId, courseId },
    });
    if (!enrollment) throw new NotFoundException('Enrollment not found');

    return this.dataSource.transaction(async (manager) => {
      const existing = await manager.findOne(CourseLessonCompletion, {
        where: { enrollmentId: enrollment.id, courseLessonId: lessonId },
      });

      if (!existing) {
        await manager.save(
          CourseLessonCompletion,
          manager.create(CourseLessonCompletion, {
            enrollmentId: enrollment.id,
            courseLessonId: lessonId,
          }),
        );
      }

      const totalLessons = await manager.count(CourseLesson, {
        where: { courseId },
      });
      const completedCount = await manager.count(CourseLessonCompletion, {
        where: { enrollmentId: enrollment.id },
      });
      const progressPercentage =
        totalLessons > 0
          ? Math.round((completedCount / totalLessons) * 100)
          : 0;

      await manager.update(
        CourseEnrollment,
        { id: enrollment.id },
        { progressPercentage },
      );

      return {
        lessonId,
        progressPercentage,
        isCompleted: true,
      };
    });
  }
}
