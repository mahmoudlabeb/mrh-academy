import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v2 as cloudinary } from 'cloudinary';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { CourseStatus, LessonStatus, UserRole } from '@mrh/types';
import { TutorProfile } from '../entities/tutor-profile.entity.js';
import { User } from '../entities/user.entity.js';
import { Review } from '../entities/review.entity.js';
import { Lesson } from '../entities/lesson.entity.js';
import { Payment } from '../entities/payment.entity.js';
import { Report } from '../entities/report.entity.js';
import { ApplyTutorDto, UpdateTutorDto } from './dto/index.js';
import { RedisService } from '../redis/redis.service.js';

@Injectable()
export class TutorsService {
  private mailTransporter: nodemailer.Transporter;

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
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    cloudinary.config({
      cloud_name: this.configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get<string>('CLOUDINARY_API_SECRET'),
    });

    const smtpUser = this.configService.get<string>('SMTP_USER');
    const smtpPass = this.configService.get<string>('SMTP_PASS');

    if (!smtpUser || !smtpPass) {
      this.mailTransporter = nodemailer.createTransport({
        jsonTransport: true,
      });
      return;
    }

    this.mailTransporter = nodemailer.createTransport({
      host:
        this.configService.get<string>('SMTP_HOST') || 'smtp.ethereal.email',
      port: parseInt(this.configService.get<string>('SMTP_PORT') || '587', 10),
      secure: this.configService.get<string>('SMTP_SECURE') === 'true',
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    } as nodemailer.TransportOptions);
  }

  async findAllWithFilters(filters: {
    minPrice?: number;
    maxPrice?: number;
    languages?: string;
    sort?: 'asc' | 'desc';
    search?: string;
  }) {
    const cacheKey = `tutors:filters:${JSON.stringify(filters)}`;
    return this.redisService.getOrSet(
      cacheKey,
      async () => {
        const query = this.tutorProfileRepository
          .createQueryBuilder('tutor')
          .leftJoinAndSelect('tutor.user', 'user')
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
            .leftJoinAndSelect('tutor.user', 'user')
            .where('tutor.status = :status', { status: CourseStatus.APPROVED })
            .getMany(),
          this.reviewRepository
            .createQueryBuilder('review')
            .select('review.tutorId', 'tutorId')
            .addSelect('AVG(review.rating)', 'avg')
            .where('review.status = :status', { status: CourseStatus.APPROVED })
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
            status: CourseStatus.APPROVED,
          })
          .select('AVG(review.rating)', 'avg')
          .getRawOne<{ avg: string | null }>();

        const reviewCount = await this.reviewRepository.count({
          where: { tutorId: userId, status: CourseStatus.APPROVED },
        });

        const { user } = tutor;
        return {
          ...tutor,
          user: {
            firstName: user.firstName,
            lastName: user.lastName,
            avatarUrl: user.avatarUrl,
          },
          averageRating: avg?.avg ? parseFloat(avg.avg) || 0 : 0,
          reviewCount,
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
      documentUrl = await this.uploadDocumentToCloudinary(documentFile.buffer);
    }

    const tutorProfile = this.tutorProfileRepository.create({
      userId,
      bio: dto.bio,
      specialization: dto.specialization,
      languages: dto.languages,
      hourlyRate: dto.hourlyRate,
      videoUrl: dto.videoUrl,
      documentUrl,
      status: CourseStatus.PENDING,
      balance: 0,
      totalHoursTaught: 0,
    });

    const savedProfile = await this.tutorProfileRepository.save(tutorProfile);

    await this.sendEmail(
      user.email,
      'Tutor Application Received — MRH Academy',
      `Dear ${user.firstName},\n\nThank you for applying to become a tutor at MRH Academy. Your application has been received and is currently pending review by our moderation team.\n\nSpecialization: ${dto.specialization}\nLanguages: ${dto.languages.join(', ')}\nHourly Rate: $${dto.hourlyRate.toFixed(2)}\n\nWe will review your application within 2-3 business days and notify you of the outcome via email.\n\nBest regards,\nMRH Academy Team`,
    );

    return savedProfile;
  }

  async uploadDocumentToCloudinary(buffer: Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'mrh-academy/tutor-documents', resource_type: 'raw' },
        (error, result) => {
          if (error || !result) {
            reject(new Error('Cloudinary upload failed'));
            return;
          }
          resolve(result.secure_url);
        },
      );
      stream.end(buffer);
    });
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

  async getTutorStats(userId: string): Promise<{
    completedLessons: number;
    totalHoursTaught: number;
    totalEarnings: number;
    reviewCount: number;
    averageRating: number;
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
          where: { tutorId: userId, status: CourseStatus.APPROVED },
        });

        const avg = await this.reviewRepository
          .createQueryBuilder('review')
          .where('review.tutorId = :tutorId', { tutorId: userId })
          .andWhere('review.status = :status', {
            status: CourseStatus.APPROVED,
          })
          .select('AVG(review.rating)', 'avg')
          .getRawOne<{ avg: string | null }>();

        return {
          completedLessons,
          totalHoursTaught: profile?.totalHoursTaught ?? 0,
          totalEarnings: profile?.balance ?? 0,
          reviewCount,
          averageRating: avg?.avg ? parseFloat(avg.avg) || 0 : 0,
        };
      },
      120,
    ); // 2 min cache
  }

  async getTutorStudents(tutorId: string) {
    const lessons = await this.lessonRepository.find({
      where: { tutorId },
      relations: { student: true },
    });

    const studentMap = new Map<
      string,
      { user: User; lessonCount: number; totalHours: number }
    >();

    for (const lesson of lessons) {
      if (!lesson.student) continue;
      const existing = studentMap.get(lesson.studentId);
      const hours = lesson.durationMinutes / 60;
      if (existing) {
        existing.lessonCount++;
        existing.totalHours += hours;
      } else {
        studentMap.set(lesson.studentId, {
          user: lesson.student,
          lessonCount: 1,
          totalHours: hours,
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
    }));
  }

  async approveTutor(userId: string) {
    const tutor = await this.findOneByUserId(userId);
    if (!tutor) throw new NotFoundException('Tutor profile not found');
    if (tutor.status === CourseStatus.APPROVED) {
      throw new BadRequestException('Tutor is already approved');
    }
    if (tutor.status === CourseStatus.REJECTED) {
      throw new BadRequestException('Tutor was rejected, cannot approve');
    }

    tutor.status = CourseStatus.APPROVED;
    await this.tutorProfileRepository.save(tutor);

    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) throw new NotFoundException('User not found');

    user.role = UserRole.TUTOR;
    await this.userRepository.save(user);

    await this.redisService.delPattern('tutors:*');

    await this.sendEmail(
      user.email,
      'Congratulations! Your Tutor Application Has Been Approved',
      `Hi ${user.firstName}, great news! Your tutor application has been approved. You can now start using the tutor dashboard.`,
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
      'Update on Your Tutor Application',
      `Hi ${tutor.user.firstName}, unfortunately your tutor application has been rejected. Reason: ${reason}`,
    );

    return tutor;
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
    return this.redisService.getOrSet(
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

        const openReports = await this.reportRepository.count();

        return {
          totalUsers,
          totalTutors,
          totalStudents: studentUsers,
          pendingApplications,
          approvedTutors,
          totalEarnings,
          openReports,
          completedLessons,
          totalRevenue,
        };
      },
      60,
    ); // 1 min cache
  }

  private async sendEmail(to: string, subject: string, text: string) {
    try {
      await this.mailTransporter.sendMail({
        from:
          this.configService.get<string>('SMTP_FROM') ||
          'no-reply@mrh-academy.com',
        to,
        subject,
        text,
      });
    } catch (error) {
      console.error('Failed to send email:', error);
    }
  }
}
