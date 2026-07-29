import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CourseStatus, LessonStatus, ReviewStatus, UserRole } from '@mrh/types';
import { TutorProfile } from './entities/tutor-profile.entity.js';
import { User } from '../users/entities/user.entity.js';
import { Review } from '../reviews/entities/review.entity.js';
import { Lesson } from '../lessons/entities/lesson.entity.js';
import { Payment } from '../payments/entities/payment.entity.js';
import { Report } from '../reports/entities/report.entity.js';
import { ApplyTutorDto, UpdateTutorDto } from './dto/index.js';
import { RedisService } from '../redis/redis.service.js';
import {
  OBJECT_STORAGE,
  type ObjectStorage,
} from '../integrations/storage/object-storage.js';
import { EmailService } from '../integrations/email/email.service.js';
import { CourseEnrollment } from '../courses/entities/course-enrollment.entity.js';

@Injectable()
export class TutorsService {
  private readonly logger = new Logger(TutorsService.name);

  constructor(
    @InjectRepository(TutorProfile)
    private readonly tutorProfileRepository: Repository<TutorProfile>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
    @InjectRepository(Lesson)
    private readonly lessonRepository: Repository<Lesson>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Report)
    private readonly reportRepository: Repository<Report>,
    @InjectRepository(CourseEnrollment)
    private readonly courseEnrollmentRepository: Repository<CourseEnrollment>,
    private readonly redisService: RedisService,
    private readonly emailService: EmailService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  async findAllWithFilters(filters: {
    minPrice?: number;
    maxPrice?: number;
    languages?: string;
    sort?: 'asc' | 'desc';
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const cacheKey = `tutors:filters:${JSON.stringify(filters)}`;
    return this.redisService.getOrSet(
      cacheKey,
      async () => {
        const query = this.tutorProfileRepository
          .createQueryBuilder('tutor')
          .leftJoin('tutor.user', 'user')
          .addSelect([
            'user.id',
            'user.firstName',
            'user.lastName',
            'user.avatarUrl',
          ])
          .where('tutor.status = :status', { status: CourseStatus.APPROVED });

        if (filters.minPrice !== undefined) {
          query.andWhere('tutor.hourlyRate >= :minPrice', {
            minPrice: filters.minPrice,
          });
        }
        if (filters.maxPrice !== undefined) {
          query.andWhere('tutor.hourlyRate <= :maxPrice', {
            maxPrice: filters.maxPrice,
          });
        }
        if (filters.languages) {
          const langs = filters.languages.split(',').map((l) => l.trim());
          query.andWhere('tutor.languages && :languages', { languages: langs });
        }
        if (filters.search) {
          query.andWhere(
            '(user.firstName ILIKE :search OR user.lastName ILIKE :search OR tutor.bio ILIKE :search OR tutor.specialization ILIKE :search)',
            { search: `%${filters.search}%` },
          );
        }

        query.orderBy(
          'tutor.hourlyRate',
          filters.sort === 'desc' ? 'DESC' : 'ASC',
        );
        query.skip(((filters.page ?? 1) - 1) * (filters.limit ?? 24));
        query.take(filters.limit ?? 24);

        return query.getMany();
      },
      60,
    ); // 1 min cache
  }

  async findTopRated(limit = 3) {
    const cacheKey = `tutors:top-rated:${limit}`;
    return this.redisService.getOrSet(
      cacheKey,
      async () => {
        const [tutors, ratings] = await Promise.all([
          this.tutorProfileRepository
            .createQueryBuilder('tutor')
            .leftJoin('tutor.user', 'user')
            .addSelect([
              'user.id',
              'user.firstName',
              'user.lastName',
              'user.avatarUrl',
            ])
            .where('tutor.status = :status', { status: CourseStatus.APPROVED })
            .getMany(),
          this.reviewRepository
            .createQueryBuilder('review')
            .select('review.tutorId', 'tutorId')
            .addSelect('AVG(review.rating)', 'avg')
            .where('review.status = :status', { status: ReviewStatus.APPROVED })
            .groupBy('review.tutorId')
            .getRawMany(),
        ]);

        const ratingMap = new Map(
          ratings.map((r) => [r.tutorId, parseFloat(r.avg) || 0]),
        );

        return tutors
          .map((tutor) => ({
            ...tutor,
            averageRating: ratingMap.get(tutor.userId) ?? 0,
          }))
          .sort((a, b) => b.averageRating - a.averageRating)
          .slice(0, limit);
      },
      300,
    ); // 5 mins
  }

  async findPublicProfile(userId: string) {
    const cacheKey = `tutors:public-profile:${userId}`;
    return this.redisService.getOrSet(
      cacheKey,
      async () => {
        const tutor = await this.tutorProfileRepository.findOne({
          where: { userId, status: CourseStatus.APPROVED },
          relations: { user: true },
        });
        if (!tutor) throw new NotFoundException('Tutor profile not found');

        const avg = await this.reviewRepository
          .createQueryBuilder('review')
          .where('review.tutorId = :tutorId', { tutorId: userId })
          .andWhere('review.status = :status', {
            status: ReviewStatus.APPROVED,
          })
          .select('AVG(review.rating)', 'avg')
          .getRawOne<{ avg: string | null }>();

        const reviewCount = await this.reviewRepository.count({
          where: { tutorId: userId, status: ReviewStatus.APPROVED },
        });

        // Compute additional fields for frontend
        const [studentsCount, lessonsCount] = await Promise.all([
          this.lessonRepository
            .createQueryBuilder('lesson')
            .select('DISTINCT lesson.studentId', 'studentId')
            .where('lesson.tutorId = :tutorId', { tutorId: userId })
            .andWhere('lesson.status = :status', {
              status: LessonStatus.COMPLETED,
            })
            .getRawMany<{ studentId: string }>()
            .then((rows) => rows.length),
          this.lessonRepository.count({
            where: { tutorId: userId, status: LessonStatus.COMPLETED },
          }),
        ]);

        const { user } = tutor;
        if (!user) {
          throw new NotFoundException('Tutor profile user not found');
        }

        return {
          ...tutor,
          user: {
            firstName: user.firstName,
            lastName: user.lastName,
            avatarUrl: user.avatarUrl,
          },
          averageRating: avg?.avg ? parseFloat(avg.avg) || 0 : 0,
          reviewCount,
          studentsCount,
          lessonsCount,
          experienceYears: tutor.experienceYears,
          country: tutor.country,
        };
      },
      300,
    ); // 5 mins
  }

  async applyToBeTutor(
    userId: string,
    dto: ApplyTutorDto,
    documentFile?: Express.Multer.File,
  ) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: { tutorProfile: true },
    });
    if (!user) throw new UnauthorizedException('User not found');

    if (user.tutorProfile) {
      throw new ConflictException('You have already applied to be a tutor');
    }

    if (user.role !== UserRole.STUDENT) {
      throw new BadRequestException('Only students can apply to become tutors');
    }

    let documentUrl: string | undefined;
    if (documentFile) {
      const allowedMimes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ];
      if (!allowedMimes.includes(documentFile.mimetype)) {
        throw new BadRequestException('Document must be a PDF or Word file');
      }
      documentUrl = await this.uploadDocumentToCloudinary(documentFile);
    }

    const tutorProfile = this.tutorProfileRepository.create({
      userId,
      bio: dto.bio,
      specialization: dto.specialization,
      languages: dto.languages,
      hourlyRate: dto.hourlyRate,
      videoUrl: dto.videoUrl,
      country: dto.country?.trim() || null,
      experienceYears: dto.experienceYears ?? null,
      documentUrl,
      status: CourseStatus.PENDING,
      balance: 0,
      totalHoursTaught: 0,
    });

    const savedProfile = await this.tutorProfileRepository.save(tutorProfile);

    await this.sendEmail(
      user.email,
      'تم استلام طلب التدريس | Tutor Application Received — MRH Academy',
      `مرحبًا ${user.firstName}،\n\nتم استلام طلبك للانضمام إلى معلّمي أكاديمية MRH وهو الآن قيد المراجعة.\nالتخصص: ${dto.specialization}\nاللغات: ${dto.languages.join(', ')}\nالسعر بالساعة: $${dto.hourlyRate.toFixed(2)}\nسنرسل إليك النتيجة خلال يومي عمل إلى ثلاثة أيام.\n\nفريق أكاديمية MRH\n\n---\n\nDear ${user.firstName},\n\nYour tutor application has been received and is pending moderation review.\nSpecialization: ${dto.specialization}\nLanguages: ${dto.languages.join(', ')}\nHourly rate: $${dto.hourlyRate.toFixed(2)}\nWe will notify you within 2-3 business days.\n\nMRH Academy Team`,
    );

    return savedProfile;
  }

  async uploadDocumentToCloudinary(file: Express.Multer.File): Promise<string> {
    const { buffer, mimetype } = file;
    const isPdf =
      mimetype === 'application/pdf' &&
      buffer.subarray(0, 5).toString('ascii') === '%PDF-' &&
      buffer
        .subarray(Math.max(0, buffer.length - 2048))
        .includes(Buffer.from('%%EOF'));
    const isLegacyWord =
      mimetype === 'application/msword' &&
      buffer
        .subarray(0, 8)
        .equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
    const isDocx =
      mimetype ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' &&
      buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) &&
      buffer.includes(Buffer.from('[Content_Types].xml')) &&
      buffer.includes(Buffer.from('word/'));
    if (!isPdf && !isLegacyWord && !isDocx) {
      throw new BadRequestException(
        'Tutor document content does not match a supported PDF or Word format',
      );
    }
    const upload = await this.storage.upload(buffer, {
      folder: 'mrh-academy/tutor-documents',
      resourceType: 'raw',
      accessMode: 'authenticated',
    });
    return upload.secureUrl;
  }

  async findAllPending() {
    return this.tutorProfileRepository.find({
      where: { status: CourseStatus.PENDING },
      relations: { user: true },
    });
  }

  async findAll() {
    return this.tutorProfileRepository.find({
      relations: { user: true },
    });
  }

  async findOneByUserId(userId: string) {
    const tutor = await this.tutorProfileRepository.findOne({
      where: { userId },
      relations: { user: true },
    });
    if (!tutor) throw new NotFoundException('Tutor profile not found');
    return tutor;
  }

  async updateTutorProfile(userId: string, dto: UpdateTutorDto) {
    const tutor = await this.tutorProfileRepository.findOne({
      where: { userId },
    });
    if (!tutor) throw new NotFoundException('Tutor profile not found');

    Object.assign(tutor, dto);
    const saved = await this.tutorProfileRepository.save(tutor);
    await this.redisService.delPattern('tutors:*');
    return saved;
  }

  async uploadProfileVideo(
    userId: string,
    file?: Express.Multer.File,
  ): Promise<TutorProfile> {
    if (!file) throw new BadRequestException('A video file is required');
    if (!file.mimetype.startsWith('video/')) {
      throw new BadRequestException('Profile video must be a video file');
    }
    const tutor = await this.tutorProfileRepository.findOne({
      where: { userId },
    });
    if (!tutor) throw new NotFoundException('Tutor profile not found');
    const upload = await this.storage.upload(file.buffer, {
      folder: 'mrh-academy/tutor-profile-videos',
      resourceType: 'video',
    });
    tutor.videoUrl = upload.secureUrl;
    return this.tutorProfileRepository.save(tutor);
  }

  async getTutorStats(userId: string): Promise<{
    completedLessons: number;
    totalHoursTaught: number;
    totalEarnings: number;
    reviewCount: number;
    averageRating: number;
    studentCount: number;
  }> {
    const cacheKey = `tutors:stats:${userId}`;
    return this.redisService.getOrSet(
      cacheKey,
      async () => {
        const profile = await this.tutorProfileRepository.findOne({
          where: { userId },
        });

        const completedLessons = await this.lessonRepository.count({
          where: { tutorId: userId, status: LessonStatus.COMPLETED },
        });

        const reviewCount = await this.reviewRepository.count({
          where: { tutorId: userId, status: ReviewStatus.APPROVED },
        });

        const avg = await this.reviewRepository
          .createQueryBuilder('review')
          .where('review.tutorId = :tutorId', { tutorId: userId })
          .andWhere('review.status = :status', {
            status: ReviewStatus.APPROVED,
          })
          .select('AVG(review.rating)', 'avg')
          .getRawOne<{ avg: string | null }>();

        const studentRows = await this.lessonRepository
          .createQueryBuilder('lesson')
          .select('DISTINCT lesson.studentId', 'studentId')
          .where('lesson.tutorId = :tutorId', { tutorId: userId })
          .getRawMany<{ studentId: string }>();

        return {
          completedLessons,
          totalHoursTaught: profile?.totalHoursTaught ?? 0,
          totalEarnings: profile?.balance ?? 0,
          reviewCount,
          averageRating: avg?.avg ? parseFloat(avg.avg) || 0 : 0,
          studentCount: studentRows.length,
        };
      },
      120,
    ); // 2 min cache
  }

  async getTutorStudents(tutorId: string) {
    const [lessons, enrollments] = await Promise.all([
      this.lessonRepository.find({
        where: { tutorId },
        relations: { student: true },
      }),
      this.courseEnrollmentRepository
        .createQueryBuilder('enrollment')
        .innerJoinAndSelect('enrollment.course', 'course')
        .innerJoinAndSelect('enrollment.student', 'student')
        .where('course.tutorId = :tutorId', { tutorId })
        .getMany(),
    ]);

    const studentMap = new Map<
      string,
      {
        user: User;
        lessonCount: number;
        totalHours: number;
        courseCount: number;
        lastActivityAt: Date;
      }
    >();

    for (const lesson of lessons) {
      if (!lesson.student) continue;
      const existing = studentMap.get(lesson.studentId);
      const hours = lesson.durationMinutes / 60;
      if (existing) {
        existing.lessonCount++;
        existing.totalHours += hours;
        if (lesson.scheduledTime > existing.lastActivityAt) {
          existing.lastActivityAt = lesson.scheduledTime;
        }
      } else {
        studentMap.set(lesson.studentId, {
          user: lesson.student,
          lessonCount: 1,
          totalHours: hours,
          courseCount: 0,
          lastActivityAt: lesson.scheduledTime,
        });
      }
    }

    for (const enrollment of enrollments) {
      if (!enrollment.student) continue;
      const existing = studentMap.get(enrollment.studentId);
      if (existing) {
        existing.courseCount += 1;
        if (enrollment.enrolledAt > existing.lastActivityAt) {
          existing.lastActivityAt = enrollment.enrolledAt;
        }
      } else {
        studentMap.set(enrollment.studentId, {
          user: enrollment.student,
          lessonCount: 0,
          totalHours: 0,
          courseCount: 1,
          lastActivityAt: enrollment.enrolledAt,
        });
      }
    }

    return Array.from(studentMap.values()).map((entry) => ({
      user: {
        id: entry.user.id,
        firstName: entry.user.firstName,
        lastName: entry.user.lastName,
        avatarUrl: entry.user.avatarUrl,
      },
      lessonCount: entry.lessonCount,
      totalHours: entry.totalHours,
      courseCount: entry.courseCount,
      relationship:
        entry.lessonCount > 0 && entry.courseCount > 0
          ? 'live_and_recorded'
          : entry.lessonCount > 0
            ? 'live_lessons'
            : 'recorded_courses',
      lastActivityAt: entry.lastActivityAt,
    }));
  }

  async approveTutor(userId: string) {
    const tutor = await this.findOneByUserId(userId);
    if (!tutor) throw new NotFoundException('Tutor profile not found');
    if (tutor.status === CourseStatus.APPROVED) {
      throw new BadRequestException('Tutor is already approved');
    }
    tutor.status = CourseStatus.APPROVED;
    tutor.rejectionReason = null;
    await this.tutorProfileRepository.save(tutor);

    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) throw new NotFoundException('User not found');

    user.role = UserRole.TUTOR;
    await this.userRepository.save(user);

    await this.redisService.delPattern('tutors:*');

    await this.sendEmail(
      user.email,
      'تم قبول طلب التدريس | Your Tutor Application Has Been Approved',
      `مرحبًا ${user.firstName}، تمت الموافقة على طلبك ويمكنك الآن استخدام لوحة المعلّم.\n\n---\n\nHi ${user.firstName}, your tutor application has been approved. You can now use the tutor dashboard.`,
    );

    return tutor;
  }

  async rejectTutor(userId: string, reason: string) {
    const tutor = await this.findOneByUserId(userId);
    if (!tutor) throw new NotFoundException('Tutor profile not found');
    if (tutor.status === CourseStatus.APPROVED) {
      throw new BadRequestException('Tutor is already approved, cannot reject');
    }

    tutor.status = CourseStatus.REJECTED;
    tutor.rejectionReason = reason;
    await this.tutorProfileRepository.save(tutor);

    await this.redisService.delPattern('tutors:*');

    await this.sendEmail(
      tutor.user.email,
      'تحديث طلب التدريس | Update on Your Tutor Application',
      `مرحبًا ${tutor.user.firstName}، تم رفض طلب التدريس. السبب: ${reason}\n\n---\n\nHi ${tutor.user.firstName}, your tutor application was rejected. Reason: ${reason}`,
    );

    return tutor;
  }

  async sendTutorRejectionNote(userId: string, reason: string) {
    const tutor = await this.findOneByUserId(userId);
    await this.sendEmail(
      tutor.user.email,
      'تحديث طلب التدريس | Update on Your Tutor Application',
      `مرحبًا ${tutor.user.firstName}، ما زال طلب التدريس قيد المراجعة. ملاحظة فريق المراجعة: ${reason}\n\n---\n\nHi ${tutor.user.firstName}, your tutor application is still under review. Moderation note: ${reason}`,
    );
    return { message: 'Moderation note sent successfully' };
  }

  async getAdminStats(): Promise<{
    totalUsers: number;
    totalTutors: number;
    totalStudents: number;
    pendingApplications: number;
    approvedTutors: number;
    totalEarnings: number;
    openReports: number;
    completedLessons: number;
    totalRevenue: number;
  }> {
    const cacheKey = 'admin:stats';
    const stats = await this.redisService.getOrSet(
      cacheKey,
      async () => {
        const totalUsers = await this.userRepository.count();
        const totalTutors = await this.tutorProfileRepository.count({
          where: { status: CourseStatus.APPROVED },
        });
        const studentUsers = await this.userRepository.count({
          where: { role: UserRole.STUDENT },
        });
        const pendingApplications = await this.tutorProfileRepository.count({
          where: { status: CourseStatus.PENDING },
        });
        const approvedTutors = await this.tutorProfileRepository.count({
          where: { status: CourseStatus.APPROVED },
        });

        const completedLessons = await this.lessonRepository.count({
          where: { status: LessonStatus.COMPLETED },
        });

        const totalEarnings = await this.lessonRepository
          .createQueryBuilder('lesson')
          .select('COALESCE(SUM(lesson.price), 0)', 'total')
          .where('lesson.status = :status', { status: LessonStatus.COMPLETED })
          .getRawOne<{ total: number }>()
          .then((r) => parseFloat(String(r?.total ?? '0')));

        const totalRevenue = await this.lessonRepository
          .createQueryBuilder('lesson')
          .select('COALESCE(SUM(lesson.platformFee), 0)', 'total')
          .where('lesson.status = :status', { status: LessonStatus.COMPLETED })
          .getRawOne<{ total: number }>()
          .then((r) => parseFloat(String(r?.total ?? '0')));

        return {
          totalUsers,
          totalTutors,
          totalStudents: studentUsers,
          pendingApplications,
          approvedTutors,
          totalEarnings,
          openReports: 0,
          completedLessons,
          totalRevenue,
        };
      },
      60,
    ); // 1 min cache
    return {
      ...stats,
      openReports: await this.reportRepository.count(),
    };
  }

  private async sendEmail(to: string, subject: string, text: string) {
    try {
      await this.emailService.sendPlainEmail(to, subject, text);
    } catch (error) {
      this.logger.error(
        'Failed to send email',
        error instanceof Error ? error.stack : error,
      );
    }
  }
}
