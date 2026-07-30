import {
  Inject,
  Injectable,
  Logger,
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
import {
  OBJECT_STORAGE,
  type ObjectStorage,
} from '../integrations/storage/object-storage.js';
import { BunnyService } from '../integrations/video/bunny.service.js';
import {
  validateCaptionUpload,
  validateVideoUpload,
} from '../integrations/video/video-upload.validation.js';

@Injectable()
export class CoursesService {
  private readonly logger = new Logger(CoursesService.name);

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
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    private readonly bunnyService: BunnyService,
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

  private getCourseReferralCode(
    tutorId: string,
    courseId: string,
  ): string | null {
    const secret = this.config.get<string>('application.referralSecret');
    if (!secret) return null;
    const signature = createHmac('sha256', secret)
      .update(`${courseId}:${tutorId}`)
      .digest('hex')
      .slice(0, 16);
    return `${tutorId}.${signature}`;
  }

  async findAllApproved(page = 1, limit = 24) {
    return this.courseRepository.find({
      where: { status: CourseStatus.APPROVED, isDraft: false },
      relations: { tutor: true },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
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

    if (
      (course.status !== CourseStatus.APPROVED || course.isDraft) &&
      !canBypass
    ) {
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
      isDraft: false,
      submittedAt: new Date(),
    });
    const savedCourse = await this.courseRepository.save(course);
    return {
      ...savedCourse,
      referralCode: this.getCourseReferralCode(tutorId, savedCourse.id),
    };
  }

  async createDraft(tutorId: string, courseType: 'recorded' | 'live') {
    await this.assertApprovedTutor(tutorId);
    const draft = this.courseRepository.create({
      tutorId,
      title: '',
      description: '',
      price: 0,
      courseType,
      status: CourseStatus.PENDING,
      isDraft: true,
      soldBy: 'academy',
    });
    const saved = await this.courseRepository.save(draft);
    return {
      ...saved,
      referralCode: this.getCourseReferralCode(tutorId, saved.id),
    };
  }

  async updateOwnedCourse(
    tutorId: string,
    courseId: string,
    dto: {
      title?: string;
      subtitle?: string;
      description?: string;
      price?: number;
      thumbnailUrl?: string;
      courseType?: 'recorded' | 'live';
      learningOutcomes?: string[];
      requirements?: string[];
      targetAudience?: string[];
      language?: string;
      level?: string;
      timezone?: string;
      capacity?: number;
      cohortStartAt?: string;
      cohortEndAt?: string;
    },
  ) {
    const course = await this.getOwnedCourse(tutorId, courseId);
    if (!course.isDraft && course.status === CourseStatus.APPROVED) {
      throw new BadRequestException(
        'Approved courses must be returned to draft before structural changes',
      );
    }
    Object.assign(course, {
      ...dto,
      cohortStartAt:
        dto.cohortStartAt === undefined
          ? course.cohortStartAt
          : new Date(dto.cohortStartAt),
      cohortEndAt:
        dto.cohortEndAt === undefined
          ? course.cohortEndAt
          : new Date(dto.cohortEndAt),
    });
    return this.courseRepository.save(course);
  }

  async submitForReview(tutorId: string, courseId: string) {
    const course = await this.getOwnedCourse(tutorId, courseId);
    if (
      !course.isDraft &&
      course.status === CourseStatus.PENDING &&
      course.submittedAt
    ) {
      throw new BadRequestException('Course is already pending review');
    }
    const lessons = await this.lessonRepository.find({
      where: { courseId },
      order: { lessonOrder: 'ASC' },
    });
    const missing: string[] = [];
    if (!course.title.trim()) missing.push('course title');
    if (!course.description.trim()) missing.push('course description');
    if (!course.thumbnailUrl) missing.push('course cover');
    if (!course.overviewVideoId && !course.previewVideoUrl) {
      missing.push('introduction video');
    }
    if (course.price < 0) missing.push('valid price');
    if (!course.learningOutcomes?.length) missing.push('learning outcomes');
    if (course.courseType === 'recorded' && lessons.length === 0) {
      missing.push('at least one curriculum lesson');
    }
    if (course.courseType === 'live') {
      if (!course.cohortStartAt) missing.push('cohort start date');
      if (!course.cohortEndAt) missing.push('cohort end date');
      if (!course.capacity) missing.push('cohort capacity');
      if (
        course.cohortStartAt &&
        course.cohortEndAt &&
        course.cohortEndAt <= course.cohortStartAt
      ) {
        missing.push('cohort end date after its start date');
      }
    }
    if (missing.length) {
      throw new BadRequestException(
        `Course is not ready for review: ${missing.join(', ')}`,
      );
    }
    course.isDraft = false;
    course.status = CourseStatus.PENDING;
    course.submittedAt = new Date();
    const saved = await this.courseRepository.save(course);
    return {
      ...saved,
      message: 'Course submitted for academy review',
    };
  }

  async addLesson(
    tutorId: string,
    courseId: string,
    dto: {
      title: string;
      description?: string;
      contentType?: 'video' | 'article' | 'resource';
      videoAssetId?: string;
      articleContent?: string;
      resourceUrl?: string;
      durationMinutes?: number;
      lessonOrder?: number;
      isPreview?: boolean;
    },
  ) {
    const course = await this.getOwnedCourse(tutorId, courseId);
    if (!course.isDraft) {
      throw new BadRequestException(
        'Only draft courses can change their curriculum',
      );
    }
    const nextOrder =
      dto.lessonOrder ??
      ((await this.lessonRepository.maximum('lessonOrder', { courseId })) ??
        0) + 1;
    return this.lessonRepository.save(
      this.lessonRepository.create({
        courseId,
        title: dto.title,
        description: dto.description ?? null,
        contentType: dto.contentType ?? 'video',
        videoAssetId: dto.videoAssetId ?? null,
        articleContent: dto.articleContent ?? null,
        resourceUrl: dto.resourceUrl ?? null,
        durationMinutes: dto.durationMinutes ?? 0,
        lessonOrder: nextOrder,
        isPreview: dto.isPreview ?? false,
      }),
    );
  }

  async updateLesson(
    tutorId: string,
    courseId: string,
    lessonId: string,
    dto: {
      title?: string;
      description?: string;
      contentType?: 'video' | 'article' | 'resource';
      videoAssetId?: string;
      articleContent?: string;
      resourceUrl?: string;
      durationMinutes?: number;
      lessonOrder?: number;
      isPreview?: boolean;
    },
  ) {
    const course = await this.getOwnedCourse(tutorId, courseId);
    if (!course.isDraft) {
      throw new BadRequestException(
        'Only draft courses can change their curriculum',
      );
    }
    const lesson = await this.lessonRepository.findOne({
      where: { id: lessonId, courseId },
    });
    if (!lesson) throw new NotFoundException('Course lesson not found');
    Object.assign(lesson, dto);
    return this.lessonRepository.save(lesson);
  }

  async removeLesson(tutorId: string, courseId: string, lessonId: string) {
    const course = await this.getOwnedCourse(tutorId, courseId);
    if (!course.isDraft) {
      throw new BadRequestException(
        'Only draft courses can change their curriculum',
      );
    }
    const result = await this.lessonRepository.delete({
      id: lessonId,
      courseId,
    });
    if (!result.affected)
      throw new NotFoundException('Course lesson not found');
    return { deleted: true, lessonId };
  }

  async uploadOwnedCourseMedia(
    tutorId: string,
    courseId: string,
    kind: 'cover' | 'preview',
    file: { buffer: Buffer; mimetype: string; size: number } | undefined,
  ) {
    const course = await this.getOwnedCourse(tutorId, courseId);
    if (!course.isDraft) {
      throw new BadRequestException('Media can only be changed on a draft');
    }
    if (!file) throw new BadRequestException('Media file is required');
    const isCover = kind === 'cover';
    if (!isCover) {
      validateVideoUpload(file);
      const previousVideoId = course.overviewVideoId;
      const uploaded = await this.bunnyService.uploadVideo(
        file.buffer,
        `Course overview ${courseId}`,
      );
      course.overviewVideoId = uploaded.videoId;
      course.overviewCaptionLanguages = null;
      course.previewVideoUrl = null;
      try {
        await this.courseRepository.save(course);
      } catch (error) {
        await this.bunnyService
          .deleteVideo(uploaded.videoId)
          .catch(() => undefined);
        throw error;
      }
      if (previousVideoId) {
        await this.bunnyService.deleteVideo(previousVideoId).catch((error) => {
          this.logger.warn(
            `Could not remove replaced course overview ${previousVideoId}: ${
              error instanceof Error ? error.message : 'unknown error'
            }`,
          );
        });
      }
      return {
        kind,
        courseId,
        videoId: uploaded.videoId,
        status: uploaded.status,
        captions: [],
      };
    }
    const allowed = isCover ? ['image/jpeg', 'image/png', 'image/webp'] : [];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException(
        isCover
          ? 'Course cover must be JPEG, PNG, or WebP'
          : 'Introduction video must be MP4, WebM, or MOV',
      );
    }
    const maximum = 5 * 1024 * 1024;
    if (file.size > maximum) {
      throw new BadRequestException('Course cover must be 5MB or smaller');
    }
    const uploaded = await this.storage.upload(file.buffer, {
      folder: `mrh-academy/courses/${courseId}`,
      resourceType: 'image',
    });
    course.thumbnailUrl = uploaded.secureUrl;
    await this.courseRepository.save(course);
    return {
      kind,
      url: uploaded.secureUrl,
      courseId,
    };
  }

  async deleteOwnedCourseOverview(tutorId: string, courseId: string) {
    const course = await this.getOwnedCourse(tutorId, courseId);
    if (!course.isDraft) {
      throw new BadRequestException('Media can only be changed on a draft');
    }
    if (!course.overviewVideoId) return { deleted: false };
    const videoId = course.overviewVideoId;
    const captionLanguages = course.overviewCaptionLanguages;
    const legacyUrl = course.previewVideoUrl;
    course.overviewVideoId = null;
    course.overviewCaptionLanguages = null;
    course.previewVideoUrl = null;
    await this.courseRepository.save(course);
    try {
      await this.bunnyService.deleteVideo(videoId);
    } catch (error) {
      course.overviewVideoId = videoId;
      course.overviewCaptionLanguages = captionLanguages;
      course.previewVideoUrl = legacyUrl;
      await this.courseRepository.save(course);
      throw error;
    }
    return { deleted: true };
  }

  async uploadOwnedCourseOverviewCaption(
    tutorId: string,
    courseId: string,
    file: Express.Multer.File | undefined,
    languageValue: string | undefined,
    labelValue: string | undefined,
  ) {
    const { language, label } = validateCaptionUpload(
      file,
      languageValue,
      labelValue,
    );
    const course = await this.getOwnedCourse(tutorId, courseId);
    if (!course.isDraft) {
      throw new BadRequestException('Media can only be changed on a draft');
    }
    if (!course.overviewVideoId) {
      throw new NotFoundException('Upload a course overview video first');
    }
    await this.bunnyService.addCaption(
      course.overviewVideoId,
      language,
      label,
      file!.buffer,
    );
    course.overviewCaptionLanguages = Array.from(
      new Set([...(course.overviewCaptionLanguages ?? []), language]),
    );
    await this.courseRepository.save(course);
    return { language, label };
  }

  async deleteOwnedCourseOverviewCaption(
    tutorId: string,
    courseId: string,
    language: string,
  ) {
    const course = await this.getOwnedCourse(tutorId, courseId);
    if (!course.isDraft) {
      throw new BadRequestException('Media can only be changed on a draft');
    }
    if (
      !course.overviewVideoId ||
      !(course.overviewCaptionLanguages ?? []).includes(language)
    ) {
      throw new NotFoundException('Caption track not found');
    }
    await this.bunnyService.deleteCaption(course.overviewVideoId, language);
    course.overviewCaptionLanguages = (
      course.overviewCaptionLanguages ?? []
    ).filter((item) => item !== language);
    await this.courseRepository.save(course);
    return { deleted: true, language };
  }

  private async buildCourseOverviewPlayback(course: Course) {
    if (!course.overviewVideoId) return { status: 'missing' as const };
    const details = await this.bunnyService.getVideoStatus(
      course.overviewVideoId,
    );
    if (details.status !== 'ready') {
      return {
        status: details.status,
        durationSeconds: details.durationSeconds,
        captions: details.captions,
      };
    }
    const playback = this.bunnyService.generateEmbedUrl(course.overviewVideoId);
    return {
      status: details.status,
      embedUrl: playback.url,
      expiresAt: playback.expiresAt,
      durationSeconds: details.durationSeconds,
      captions: details.captions,
    };
  }

  async getOwnedCourseOverview(tutorId: string, courseId: string) {
    const course = await this.getOwnedCourse(tutorId, courseId);
    return this.buildCourseOverviewPlayback(course);
  }

  async getPublicCourseOverview(courseId: string) {
    const course = await this.courseRepository.findOne({
      where: {
        id: courseId,
        status: CourseStatus.APPROVED,
        isDraft: false,
      },
    });
    if (!course) throw new NotFoundException('Course not found');
    return this.buildCourseOverviewPlayback(course);
  }

  private async assertApprovedTutor(tutorId: string) {
    const tutorProfile = await this.tutorProfileRepository.findOne({
      where: { userId: tutorId },
      select: { userId: true, status: true },
    });
    if (tutorProfile?.status !== CourseStatus.APPROVED) {
      throw new ForbiddenException(
        'Your tutor account must be approved before creating courses',
      );
    }
  }

  private async getOwnedCourse(tutorId: string, courseId: string) {
    const course = await this.courseRepository.findOne({
      where: { id: courseId, tutorId },
    });
    if (!course) throw new NotFoundException('Course not found');
    return course;
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

      const enrollment = manager.create(CourseEnrollment, {
        studentId,
        courseId,
        platformFee,
        tutorShare,
        soldBy,
        referralTutorId: hasValidReferral ? course.tutorId : null,
        tutorShareAvailableAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        tutorShareReleasedAt: null,
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
          const creditedAmountUsd =
            deposit.creditedAmountUsd ??
            (deposit.currency === 'EGP'
              ? Number(deposit.amount) /
                (await this.commissionService.getEgpRate())
              : Number(deposit.amount));
          const refundedAmountUsd =
            Number(deposit.amount) > 0
              ? (Number(deposit.refundedAmount ?? 0) / Number(deposit.amount)) *
                creditedAmountUsd
              : 0;
          const available = Math.max(
            0,
            creditedAmountUsd -
              refundedAmountUsd -
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
