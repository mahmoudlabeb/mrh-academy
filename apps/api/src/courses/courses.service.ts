import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CourseStatus } from '@mrh/types';
import { Course } from '../entities/course.entity.js';
import { CourseEnrollment } from '../entities/course-enrollment.entity.js';
import { CourseLesson } from '../entities/course-lesson.entity.js';
import { TutorProfile } from '../entities/tutor-profile.entity.js';
import { StudentProfile } from '../entities/student-profile.entity.js';
import { CommissionService } from '../services/commission.service.js';

@Injectable()
export class CoursesService {
  constructor(
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
    @InjectRepository(CourseEnrollment)
    private readonly enrollmentRepository: Repository<CourseEnrollment>,
    @InjectRepository(CourseLesson)
    private readonly lessonRepository: Repository<CourseLesson>,
    @InjectRepository(TutorProfile)
    private readonly tutorProfileRepository: Repository<TutorProfile>,
    @InjectRepository(StudentProfile)
    private readonly studentProfileRepository: Repository<StudentProfile>,
    private readonly commissionService: CommissionService,
    private readonly dataSource: DataSource,
  ) {}

  async findAllApproved() {
    return this.courseRepository.find({
      where: { status: CourseStatus.APPROVED },
      relations: { tutor: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    const course = await this.courseRepository.findOne({
      where: { id },
      relations: { tutor: true },
    });
    if (!course) throw new NotFoundException('Course not found');
    return course;
  }

  async findLessons(courseId: string) {
    return this.lessonRepository.find({
      where: { courseId },
      order: { lessonOrder: 'ASC' },
    });
  }

  async create(tutorId: string, dto: { title: string; description: string; price: number; thumbnailUrl?: string; tags?: string[] }) {
    const course = this.courseRepository.create({
      tutorId,
      title: dto.title,
      description: dto.description,
      price: dto.price,
      thumbnailUrl: dto.thumbnailUrl,
      status: CourseStatus.PENDING,
    });
    return this.courseRepository.save(course);
  }

  async enroll(studentId: string, courseId: string, dto?: { promoCode?: string; referralCode?: string; soldBy?: 'tutor' | 'academy' }) {
    const course = await this.courseRepository.findOne({
      where: { id: courseId, status: CourseStatus.APPROVED },
    });
    if (!course) throw new NotFoundException('Course not found or not yet approved');

    const hasValidReferral = dto?.referralCode === course.tutorId;
    const soldBy = hasValidReferral ? 'tutor' : 'academy';
    const { platformFee, tutorShare } = await this.commissionService.calculateCourseEarnings(course.price, soldBy);

    await this.dataSource.transaction(async (manager) => {
      const existing = await manager.findOne(CourseEnrollment, {
        where: { studentId, courseId },
        lock: { mode: 'pessimistic_write' },
      });
      if (existing) throw new BadRequestException('Already enrolled in this course');

      const studentProfile = await manager.findOne(StudentProfile, {
        where: { userId: studentId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!studentProfile) throw new NotFoundException('Student profile not found');
      if (studentProfile.balance < course.price) throw new BadRequestException('Insufficient balance');

      await manager.decrement(StudentProfile, { userId: studentId }, 'balance', course.price);

      await manager.increment(TutorProfile, { userId: course.tutorId }, 'balance', tutorShare);

      const enrollment = manager.create(CourseEnrollment, {
        studentId,
        courseId,
        platformFee,
        tutorShare,
        soldBy,
        referralTutorId: hasValidReferral ? course.tutorId : null,
      });
      await manager.save(enrollment);
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
    return this.courseRepository.find({
      where: { tutorId },
      order: { createdAt: 'DESC' },
    });
  }
}
