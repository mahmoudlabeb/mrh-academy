import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CourseLifecycleStatus } from '@mrh/types';
import { DataSource, Repository } from 'typeorm';
import { Course } from '../courses/entities/course.entity.js';
import { CourseLesson } from '../courses/entities/course-lesson.entity.js';
import { CourseSection } from '../courses/entities/course-section.entity.js';
import { BunnyService } from '../integrations/video/bunny.service.js';
import { Notification } from '../messages/entities/notification.entity.js';
import { AdminAuditLog } from './entities/admin-audit-log.entity.js';

type CourseDecision = 'approved' | 'rejected';

@Injectable()
export class CourseReviewService {
  private readonly logger = new Logger(CourseReviewService.name);

  constructor(
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
    @InjectRepository(CourseSection)
    private readonly sectionRepository: Repository<CourseSection>,
    @InjectRepository(CourseLesson)
    private readonly lessonRepository: Repository<CourseLesson>,
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    private readonly dataSource: DataSource,
    private readonly bunnyService: BunnyService,
  ) {}

  async list(status?: CourseLifecycleStatus) {
    const courses = await this.courseRepository.find({
      where: status ? { status } : {},
      relations: { tutor: true },
      order: {
        submittedAt: 'DESC',
        createdAt: 'DESC',
      },
    });
    return courses.map((course) => ({
      id: course.id,
      tutorId: course.tutorId,
      tutorName: course.tutor
        ? `${course.tutor.firstName} ${course.tutor.lastName}`.trim()
        : 'Unknown',
      itemType: course.courseType,
      title: course.title,
      description: course.description,
      submittedAt: course.submittedAt,
      createdAt: course.createdAt,
      price: course.price,
      language: course.language,
      category: course.category,
      status: course.status,
      thumbnailUrl: course.thumbnailUrl,
      reviewedAt: course.reviewedAt,
      reviewDecision: course.reviewDecision,
      reviewNote: course.reviewNote,
      isApproved: course.status === CourseLifecycleStatus.ACTIVE,
    }));
  }

  async getDetails(id: string) {
    const course = await this.courseRepository.findOne({
      where: { id },
      relations: { tutor: { tutorProfile: true } },
    });
    if (!course) throw new NotFoundException('Course submission not found');
    const [sections, lessons, overviewPlayback] = await Promise.all([
      this.sectionRepository.find({
        where: { courseId: id },
        order: { sectionOrder: 'ASC' },
      }),
      this.lessonRepository.find({
        where: { courseId: id },
        order: { lessonOrder: 'ASC' },
      }),
      this.getOverviewPlayback(course),
    ]);
    return {
      ...course,
      tutor: course.tutor
        ? {
            id: course.tutor.id,
            firstName: course.tutor.firstName,
            lastName: course.tutor.lastName,
            email: course.tutor.email,
            avatarUrl: course.tutor.avatarUrl,
            profile: course.tutor.tutorProfile
              ? {
                  bio: course.tutor.tutorProfile.bio,
                  specialization:
                    course.tutor.tutorProfile.specialization,
                  languages: course.tutor.tutorProfile.languages,
                  experienceYears:
                    course.tutor.tutorProfile.experienceYears,
                }
              : null,
          }
        : null,
      sections,
      lessons,
      overviewPlayback,
    };
  }

  approve(
    courseId: string,
    adminId: string,
    input: { note?: string; videoQualityApproved?: boolean },
  ) {
    return this.decide(courseId, adminId, 'approved', input.note, {
      videoQualityApproved: input.videoQualityApproved,
    });
  }

  reject(
    courseId: string,
    adminId: string,
    reason: string,
  ) {
    return this.decide(courseId, adminId, 'rejected', reason);
  }

  private async decide(
    courseId: string,
    adminId: string,
    decision: CourseDecision,
    note?: string,
    options?: { videoQualityApproved?: boolean },
  ) {
    const normalizedNote = note?.trim() || null;
    if (decision === 'rejected' && !normalizedNote) {
      throw new BadRequestException('A rejection reason is required');
    }
    const result = await this.dataSource.transaction(async (manager) => {
      const course = await manager.findOne(Course, {
        where: { id: courseId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!course) throw new NotFoundException('Course submission not found');
      if (course.tutorId === adminId) {
        throw new ForbiddenException(
          'Tutors cannot review their own submissions',
        );
      }
      if (course.status !== CourseLifecycleStatus.PENDING_REVIEW) {
        throw new BadRequestException(
          'Only pending submissions can be reviewed',
        );
      }

      const reviewedAt = new Date();
      course.status =
        decision === 'approved'
          ? CourseLifecycleStatus.ACTIVE
          : CourseLifecycleStatus.REJECTED;
      course.isDraft = false;
      course.reviewedBy = adminId;
      course.reviewedAt = reviewedAt;
      course.reviewDecision = decision;
      course.reviewNote = normalizedNote;
      if (decision === 'approved' && options?.videoQualityApproved) {
        course.videoQualityApprovedAt = reviewedAt;
        course.videoQualityApprovedBy = adminId;
      }
      const saved = await manager.save(Course, course);
      await manager.save(
        AdminAuditLog,
        manager.create(AdminAuditLog, {
          adminId,
          targetUserId: course.tutorId,
          action: `course_submission_${decision}`,
          ipAddress: null,
          metadata: {
            courseId: course.id,
            itemType: course.courseType,
            decision,
            note: normalizedNote,
          },
        }),
      );
      return saved;
    });

    await this.notifyDecision(result, decision, normalizedNote);
    return {
      ...result,
      message:
        decision === 'approved'
          ? 'Course approved successfully'
          : 'Course rejected successfully',
    };
  }

  private async getOverviewPlayback(course: Course) {
    if (!course.overviewVideoId) {
      return course.previewVideoUrl
        ? { status: 'ready' as const, embedUrl: course.previewVideoUrl }
        : { status: 'missing' as const };
    }
    try {
      const details = await this.bunnyService.getVideoStatus(
        course.overviewVideoId,
      );
      const playback = this.bunnyService.generateEmbedUrl(
        course.overviewVideoId,
      );
      return {
        status: details.status,
        embedUrl: playback.url,
        expiresAt: playback.expiresAt,
        durationSeconds: details.durationSeconds,
        captions: details.captions,
      };
    } catch (error) {
      this.logger.error(
        `Failed to prepare review playback for course ${course.id}`,
        error,
      );
      return { status: 'unavailable' as const };
    }
  }

  private async notifyDecision(
    course: Course,
    decision: CourseDecision,
    note: string | null,
  ) {
    try {
      await this.notificationRepository.save(
        this.notificationRepository.create({
          userId: course.tutorId,
          type:
            decision === 'approved'
              ? 'course_submission_approved'
              : 'course_submission_rejected',
          title:
            decision === 'approved'
              ? 'Submission approved'
              : 'Changes requested',
          body:
            decision === 'approved'
              ? `${course.title} is now active and visible to students.${note ? ` Note: ${note}` : ''}`
              : `${course.title} needs changes. Reason: ${note}`,
        }),
      );
    } catch (error) {
      this.logger.error(
        `Failed to notify tutor about ${decision} course ${course.id}`,
        error,
      );
    }
  }
}
