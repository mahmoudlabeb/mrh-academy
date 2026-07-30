import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { createHmac, randomUUID } from 'node:crypto';
import {
  CourseLifecycleStatus,
  CourseStatus,
  FinancialLedgerStatus,
  FinancialTransactionType,
  PaymentStatus,
  UserRole,
} from '@mrh/types';
import { Course } from './entities/course.entity.js';
import { CourseEnrollment } from './entities/course-enrollment.entity.js';
import { CourseLesson } from './entities/course-lesson.entity.js';
import { CourseSection } from './entities/course-section.entity.js';
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
import { Notification } from '../messages/entities/notification.entity.js';
import { FinancialLedgerService } from '../payments/financial-ledger.service.js';

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
    @InjectRepository(CourseSection)
    private readonly sectionRepository: Repository<CourseSection>,
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
    private readonly financialLedgerService: FinancialLedgerService,
    @Optional()
    @InjectRepository(Notification)
    private readonly notificationRepository?: Repository<Notification>,
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
      where: { status: CourseLifecycleStatus.ACTIVE, isDraft: false },
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
      (course.status !== CourseLifecycleStatus.ACTIVE || course.isDraft) &&
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

  async findPublicCurriculum(courseId: string) {
    const course = await this.courseRepository.findOne({
      where: {
        id: courseId,
        status: CourseLifecycleStatus.ACTIVE,
        isDraft: false,
      },
      select: { id: true },
    });
    if (!course) throw new NotFoundException('Course not found');
    const lessons = await this.lessonRepository.find({
      where: { courseId },
      relations: { section: true },
      select: {
        id: true,
        title: true,
        description: true,
        contentType: true,
        durationMinutes: true,
        lessonOrder: true,
        isPreview: true,
        sectionId: true,
        section: {
          id: true,
          title: true,
          sectionOrder: true,
        },
      },
      order: {
        section: { sectionOrder: 'ASC' },
        lessonOrder: 'ASC',
      },
    });
    return lessons.map((lesson) => ({
      ...lesson,
      sectionTitle: lesson.section?.title ?? null,
      sectionOrder: lesson.section?.sectionOrder ?? null,
      section: undefined,
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
      status: CourseLifecycleStatus.DRAFT,
      isDraft: true,
      submittedAt: null,
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
      status: CourseLifecycleStatus.DRAFT,
      isDraft: true,
      soldBy: 'academy',
      language: 'Arabic',
      level: 'beginner',
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
      category?: string;
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
    if (course.status !== CourseLifecycleStatus.DRAFT || !course.isDraft) {
      throw new BadRequestException('Only draft courses can be edited');
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
    const saved = await this.courseRepository.save(course);
    return {
      ...saved,
      referralCode: this.getCourseReferralCode(tutorId, saved.id),
    };
  }

  async submitForReview(tutorId: string, courseId: string) {
    const course = await this.getOwnedCourse(tutorId, courseId);
    if (course.status !== CourseLifecycleStatus.DRAFT || !course.isDraft) {
      throw new BadRequestException('Only draft courses can be submitted');
    }
    const readiness = await this.buildReadiness(course);
    if (!readiness.ready) {
      throw new BadRequestException(
        `Course is not ready for review: ${readiness.items
          .filter((item) => !item.complete)
          .map((item) => item.label)
          .join(', ')}`,
      );
    }
    course.isDraft = false;
    course.status = CourseLifecycleStatus.PENDING_REVIEW;
    course.submittedAt = new Date();
    course.reviewedBy = null;
    course.reviewedAt = null;
    course.reviewDecision = null;
    course.reviewNote = null;
    const saved = await this.courseRepository.save(course);
    await this.notifyTutor(
      tutorId,
      'course_submission_received',
      'Submission received',
      `${course.title} was submitted for academy review.`,
    );
    return {
      ...saved,
      message: 'Course submitted for academy review',
    };
  }

  async reviseRejectedCourse(tutorId: string, courseId: string) {
    const course = await this.getOwnedCourse(tutorId, courseId);
    if (course.status !== CourseLifecycleStatus.REJECTED) {
      throw new BadRequestException(
        'Only rejected courses can be returned to draft',
      );
    }
    course.status = CourseLifecycleStatus.DRAFT;
    course.isDraft = true;
    course.submittedAt = null;
    const saved = await this.courseRepository.save(course);
    return {
      ...saved,
      message: 'Course returned to draft for revision',
    };
  }

  async getOwnedCourseStudio(tutorId: string, courseId: string) {
    const course = await this.getOwnedCourse(tutorId, courseId);
    const [sections, lessons, readiness] = await Promise.all([
      this.sectionRepository.find({
        where: { courseId },
        order: { sectionOrder: 'ASC' },
      }),
      this.lessonRepository.find({
        where: { courseId },
        order: { lessonOrder: 'ASC' },
      }),
      this.buildReadiness(course),
    ]);
    return {
      course: {
        ...course,
        referralCode: this.getCourseReferralCode(tutorId, course.id),
      },
      sections,
      lessons,
      readiness,
    };
  }

  async getOwnedCourseReadiness(tutorId: string, courseId: string) {
    const course = await this.getOwnedCourse(tutorId, courseId);
    return this.buildReadiness(course);
  }

  private async buildReadiness(course: Course) {
    const [sections, lessons] = await Promise.all([
      this.sectionRepository.find({
        where: { courseId: course.id },
        order: { sectionOrder: 'ASC' },
      }),
      this.lessonRepository.find({
        where: { courseId: course.id },
        order: { lessonOrder: 'ASC' },
      }),
    ]);
    const recordedLessonsComplete =
      course.courseType !== 'recorded' ||
      (lessons.length > 0 &&
        lessons.every((lesson) => {
          if (lesson.contentType === 'video') {
            return Boolean(lesson.videoUrl || lesson.videoAssetId);
          }
          if (lesson.contentType === 'article') {
            return Boolean(lesson.articleContent?.trim());
          }
          return Boolean(
            lesson.resourceUrl ||
            lesson.downloadableFiles?.length ||
            lesson.externalLinks?.length,
          );
        }));
    const liveScheduleComplete =
      course.courseType !== 'live' ||
      Boolean(
        course.cohortStartAt &&
        course.cohortEndAt &&
        course.cohortEndAt > course.cohortStartAt &&
        course.capacity,
      );
    const items = [
      {
        key: 'basics',
        label:
          'complete title, subtitle, description, category, level, and language',
        complete: Boolean(
          course.title.trim().length >= 10 &&
          (course.subtitle?.trim().length ?? 0) >= 20 &&
          course.description.trim().length >= 100 &&
          course.category?.trim() &&
          course.level &&
          course.language,
        ),
      },
      {
        key: 'audience',
        label: 'learning outcomes, requirements, and target audience',
        complete: Boolean(
          course.learningOutcomes?.length &&
          course.requirements?.length &&
          course.targetAudience?.length,
        ),
      },
      {
        key: 'curriculum',
        label: 'at least one section and complete curriculum lesson',
        complete: sections.length > 0 && recordedLessonsComplete,
      },
      {
        key: 'media',
        label: 'course cover and introduction video',
        complete: Boolean(
          course.thumbnailUrl &&
          (course.overviewVideoId || course.previewVideoUrl),
        ),
      },
      {
        key: 'pricing',
        label: 'valid course price',
        complete: Number.isFinite(Number(course.price)) && course.price >= 0,
      },
      {
        key: 'schedule',
        label: 'valid live cohort schedule and capacity',
        complete: liveScheduleComplete,
      },
    ].filter((item) => item.key !== 'schedule' || course.courseType === 'live');
    const completed = items.filter((item) => item.complete).length;
    return {
      ready: completed === items.length,
      completed,
      total: items.length,
      progress: Math.round((completed / items.length) * 100),
      items,
    };
  }

  async addSection(
    tutorId: string,
    courseId: string,
    dto: { title?: string; description?: string; sectionOrder?: number },
  ) {
    const course = await this.getOwnedCourse(tutorId, courseId);
    if (!course.isDraft) {
      throw new BadRequestException(
        'Only draft courses can change their curriculum',
      );
    }
    if (!dto.title?.trim()) {
      throw new BadRequestException('Section title is required');
    }
    const nextOrder =
      dto.sectionOrder ??
      ((await this.sectionRepository.maximum('sectionOrder', { courseId })) ??
        0) + 1;
    return this.sectionRepository.save(
      this.sectionRepository.create({
        courseId,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        sectionOrder: nextOrder,
      }),
    );
  }

  async updateSection(
    tutorId: string,
    courseId: string,
    sectionId: string,
    dto: { title?: string; description?: string; sectionOrder?: number },
  ) {
    const course = await this.getOwnedCourse(tutorId, courseId);
    if (!course.isDraft) {
      throw new BadRequestException(
        'Only draft courses can change their curriculum',
      );
    }
    const section = await this.assertOwnedSection(courseId, sectionId);
    if (dto.title !== undefined && !dto.title.trim()) {
      throw new BadRequestException('Section title is required');
    }
    Object.assign(section, {
      ...dto,
      ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
      ...(dto.description !== undefined
        ? { description: dto.description.trim() || null }
        : {}),
    });
    return this.sectionRepository.save(section);
  }

  async removeSection(tutorId: string, courseId: string, sectionId: string) {
    const course = await this.getOwnedCourse(tutorId, courseId);
    if (!course.isDraft) {
      throw new BadRequestException(
        'Only draft courses can change their curriculum',
      );
    }
    await this.assertOwnedSection(courseId, sectionId);
    await this.lessonRepository.update(
      { courseId, sectionId },
      { sectionId: null },
    );
    await this.sectionRepository.delete({ id: sectionId, courseId });
    return { deleted: true, sectionId };
  }

  async reorderSections(tutorId: string, courseId: string, ids: string[]) {
    const course = await this.getOwnedCourse(tutorId, courseId);
    if (!course.isDraft) {
      throw new BadRequestException(
        'Only draft courses can change their curriculum',
      );
    }
    const sections = await this.sectionRepository.find({
      where: { courseId },
      order: { sectionOrder: 'ASC' },
    });
    this.assertSameIds(
      ids,
      sections.map((section) => section.id),
      'sections',
    );
    await this.sectionRepository.save(
      ids.map((id, index) => ({
        ...sections.find((section) => section.id === id)!,
        sectionOrder: index + 1,
      })),
    );
    return this.sectionRepository.find({
      where: { courseId },
      order: { sectionOrder: 'ASC' },
    });
  }

  private async assertOwnedSection(courseId: string, sectionId: string) {
    const section = await this.sectionRepository.findOne({
      where: { id: sectionId, courseId },
    });
    if (!section) throw new NotFoundException('Course section not found');
    return section;
  }

  private assertSameIds(actual: string[], expected: string[], label: string) {
    if (
      actual.length !== expected.length ||
      new Set(actual).size !== actual.length ||
      actual.some((id) => !expected.includes(id))
    ) {
      throw new BadRequestException(
        `Reorder request must include every ${label} item exactly once`,
      );
    }
  }

  async addLesson(
    tutorId: string,
    courseId: string,
    dto: {
      title?: string;
      sectionId?: string;
      description?: string;
      contentType?: 'video' | 'article' | 'resource';
      videoAssetId?: string;
      videoUrl?: string;
      articleContent?: string;
      resourceUrl?: string;
      externalLinks?: string[];
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
    if (!dto.title?.trim()) {
      throw new BadRequestException('Lesson title is required');
    }
    if (dto.sectionId) {
      await this.assertOwnedSection(courseId, dto.sectionId);
    }
    const nextOrder =
      dto.lessonOrder ??
      ((await this.lessonRepository.maximum('lessonOrder', { courseId })) ??
        0) + 1;
    return this.lessonRepository.save(
      this.lessonRepository.create({
        courseId,
        sectionId: dto.sectionId ?? null,
        title: dto.title.trim(),
        description: dto.description ?? null,
        contentType: dto.contentType ?? 'video',
        videoAssetId: dto.videoAssetId ?? null,
        videoUrl: dto.videoUrl ?? null,
        articleContent: dto.articleContent ?? null,
        resourceUrl: dto.resourceUrl ?? null,
        downloadableFiles: [],
        externalLinks: (dto.externalLinks ?? []).map((url) => ({
          title: url,
          url,
        })),
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
      sectionId?: string;
      description?: string;
      contentType?: 'video' | 'article' | 'resource';
      videoAssetId?: string;
      videoUrl?: string;
      articleContent?: string;
      resourceUrl?: string;
      externalLinks?: string[];
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
    if (dto.sectionId) {
      await this.assertOwnedSection(courseId, dto.sectionId);
    }
    if (dto.title !== undefined && !dto.title.trim()) {
      throw new BadRequestException('Lesson title is required');
    }
    const { externalLinks, ...lessonChanges } = dto;
    Object.assign(lesson, lessonChanges, {
      ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
      ...(externalLinks !== undefined
        ? {
            externalLinks: externalLinks.map((url) => ({
              title: url,
              url,
            })),
          }
        : {}),
    });
    return this.lessonRepository.save(lesson);
  }

  async reorderLessons(tutorId: string, courseId: string, ids: string[]) {
    const course = await this.getOwnedCourse(tutorId, courseId);
    if (!course.isDraft) {
      throw new BadRequestException(
        'Only draft courses can change their curriculum',
      );
    }
    const lessons = await this.lessonRepository.find({
      where: { courseId },
      order: { lessonOrder: 'ASC' },
    });
    this.assertSameIds(
      ids,
      lessons.map((lesson) => lesson.id),
      'lessons',
    );
    await this.lessonRepository.save(
      ids.map((id, index) => ({
        ...lessons.find((lesson) => lesson.id === id)!,
        lessonOrder: index + 1,
      })),
    );
    return this.lessonRepository.find({
      where: { courseId },
      order: { lessonOrder: 'ASC' },
    });
  }

  async removeLesson(tutorId: string, courseId: string, lessonId: string) {
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
    await this.lessonRepository.remove(lesson);
    await Promise.all(
      (lesson.downloadableFiles ?? []).map((file) =>
        this.storage
          .destroy(file.publicId, { resourceType: 'raw' })
          .catch((error) => {
            this.logger.warn(
              `Could not remove lesson file ${file.publicId}: ${
                error instanceof Error ? error.message : 'unknown error'
              }`,
            );
          }),
      ),
    );
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
    const previousPublicId = course.thumbnailPublicId;
    course.thumbnailUrl = uploaded.secureUrl;
    course.thumbnailPublicId = uploaded.publicId;
    try {
      await this.courseRepository.save(course);
    } catch (error) {
      await this.storage
        .destroy(uploaded.publicId, {
          resourceType: 'image',
          deliveryType: 'upload',
        })
        .catch(() => undefined);
      throw error;
    }
    if (previousPublicId) {
      await this.storage
        .destroy(previousPublicId, {
          resourceType: 'image',
          deliveryType: 'upload',
        })
        .catch((error) => {
          this.logger.warn(
            `Could not remove replaced course cover ${previousPublicId}: ${
              error instanceof Error ? error.message : 'unknown error'
            }`,
          );
        });
    }
    return {
      kind,
      url: uploaded.secureUrl,
      publicId: uploaded.publicId,
      courseId,
    };
  }

  async deleteOwnedCourseCover(tutorId: string, courseId: string) {
    const course = await this.getOwnedCourse(tutorId, courseId);
    if (!course.isDraft) {
      throw new BadRequestException('Media can only be changed on a draft');
    }
    if (!course.thumbnailUrl) return { deleted: false };
    const publicId = course.thumbnailPublicId;
    const previousUrl = course.thumbnailUrl;
    course.thumbnailUrl = null;
    course.thumbnailPublicId = null;
    await this.courseRepository.save(course);
    if (publicId) {
      try {
        await this.storage.destroy(publicId, {
          resourceType: 'image',
          deliveryType: 'upload',
        });
      } catch (error) {
        course.thumbnailUrl = previousUrl;
        course.thumbnailPublicId = publicId;
        await this.courseRepository.save(course);
        throw error;
      }
    }
    return { deleted: true };
  }

  async uploadLessonFile(
    tutorId: string,
    courseId: string,
    lessonId: string,
    file:
      | { buffer: Buffer; mimetype: string; size: number; originalname: string }
      | undefined,
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
    if (!file) throw new BadRequestException('Lesson file is required');
    const allowed = new Set([
      'application/pdf',
      'application/zip',
      'application/x-zip-compressed',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg',
      'image/png',
      'text/plain',
    ]);
    if (!allowed.has(file.mimetype)) {
      throw new BadRequestException(
        'Lesson files must be PDF, ZIP, Office, image, or text files',
      );
    }
    if (file.size > 20 * 1024 * 1024) {
      throw new BadRequestException('Lesson files must be 20MB or smaller');
    }
    const uploaded = await this.storage.upload(file.buffer, {
      folder: `mrh-academy/courses/${courseId}/lessons/${lessonId}`,
      resourceType: 'raw',
      accessMode: 'authenticated',
    });
    const storedFile = {
      id: randomUUID(),
      name: file.originalname,
      url: this.storage.signedUrl(uploaded.publicId, {
        resourceType: 'raw',
        deliveryType: 'authenticated',
      }),
      publicId: uploaded.publicId,
      size: file.size,
      mimeType: file.mimetype,
    };
    lesson.downloadableFiles = [
      ...(lesson.downloadableFiles ?? []),
      storedFile,
    ];
    try {
      await this.lessonRepository.save(lesson);
    } catch (error) {
      await this.storage
        .destroy(uploaded.publicId, { resourceType: 'raw' })
        .catch(() => undefined);
      throw error;
    }
    return storedFile;
  }

  async deleteLessonFile(
    tutorId: string,
    courseId: string,
    lessonId: string,
    fileId: string,
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
    const file = (lesson.downloadableFiles ?? []).find(
      (item) => item.id === fileId,
    );
    if (!file) throw new NotFoundException('Lesson file not found');
    lesson.downloadableFiles = lesson.downloadableFiles.filter(
      (item) => item.id !== fileId,
    );
    await this.lessonRepository.save(lesson);
    try {
      await this.storage.destroy(file.publicId, { resourceType: 'raw' });
    } catch (error) {
      lesson.downloadableFiles = [...lesson.downloadableFiles, file];
      await this.lessonRepository.save(lesson);
      throw error;
    }
    return { deleted: true, fileId };
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
        status: CourseLifecycleStatus.ACTIVE,
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

  private async notifyTutor(
    userId: string,
    type: string,
    title: string,
    body: string,
  ) {
    if (!this.notificationRepository) return;
    try {
      await this.notificationRepository.save(
        this.notificationRepository.create({ userId, type, title, body }),
      );
    } catch (error) {
      this.logger.error(
        `Failed to create ${type} notification for tutor ${userId}`,
        error,
      );
    }
  }

  async enroll(
    studentId: string,
    courseId: string,
    dto?: {
      idempotencyKey?: string;
      promoCode?: string;
      referralCode?: string;
    },
  ) {
    const course = await this.courseRepository.findOne({
      where: {
        id: courseId,
        status: CourseLifecycleStatus.ACTIVE,
        isDraft: false,
      },
    });
    if (!course)
      throw new NotFoundException('Course not found or not yet approved');

    const hasValidReferral = this.isValidCourseReferral(
      dto?.referralCode,
      course.tutorId,
      courseId,
    );
    const soldBy = hasValidReferral ? 'tutor' : 'academy';

    const purchase = await this.dataSource.transaction(async (manager) => {
      const studentProfile = await manager.findOne(StudentProfile, {
        where: { userId: studentId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!studentProfile)
        throw new NotFoundException('Student profile not found');

      if (dto?.idempotencyKey) {
        const keyed = await manager.findOne(CourseEnrollment, {
          where: { idempotencyKey: dto.idempotencyKey },
          lock: { mode: 'pessimistic_write' },
        });
        if (keyed) {
          if (keyed.studentId !== studentId || keyed.courseId !== courseId) {
            throw new BadRequestException(
              'Enrollment key is already in use for another purchase',
            );
          }
          return { enrollment: keyed, created: false, finalPrice: 0 };
        }
      }
      const existing = await manager.findOne(CourseEnrollment, {
        where: { studentId, courseId },
        lock: { mode: 'pessimistic_write' },
      });
      if (existing) {
        return { enrollment: existing, created: false, finalPrice: 0 };
      }

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
        idempotencyKey: dto?.idempotencyKey ?? null,
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
          where: {
            userId: studentId,
            status: In([
              PaymentStatus.SUCCEEDED,
              PaymentStatus.PARTIALLY_REFUNDED,
            ]),
          },
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
      if (finalPrice > 0) {
        await this.financialLedgerService.record(manager, {
          eventKey: `course_purchase:${enrollment.id}`,
          transactionType: FinancialTransactionType.COURSE_PURCHASE,
          status: FinancialLedgerStatus.SUCCEEDED,
          provider: 'internal',
          method: 'wallet',
          amount: finalPrice,
          currency: 'USD',
          userId: studentId,
          tutorId: course.tutorId,
          courseId,
          enrollmentId: enrollment.id,
          adminCommission: platformFee,
          tutorShare,
          balanceBefore: Number(studentProfile.balance),
          balanceAfter:
            Math.round((Number(studentProfile.balance) - finalPrice) * 100) /
            100,
          metadata: {
            soldBy,
            promoApplied: Boolean(dto?.promoCode),
          },
        });
      }
      return { enrollment, created: true, finalPrice };
    });

    if (purchase.created) {
      const notificationRepository =
        this.dataSource.getRepository(Notification);
      await notificationRepository.save([
        notificationRepository.create({
          userId: studentId,
          type: 'course_enrolled',
          title: 'Course purchase confirmed',
          body: `Your payment was confirmed and ${course.title} is now available in your library.`,
        }),
        notificationRepository.create({
          userId: course.tutorId,
          type: 'course_sold',
          title: 'New course enrollment',
          body: `A student purchased ${course.title}. Your recorded share is $${Number(purchase.enrollment.tutorShare ?? 0).toFixed(2)}.`,
        }),
      ]);
    }

    return {
      message: 'Enrolled successfully',
      courseId,
      enrollmentId: purchase.enrollment.id,
      duplicate: !purchase.created,
    };
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
