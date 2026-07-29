import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CourseStatus, ReviewStatus } from '@mrh/types';
import { PaymentMethodConfig } from '../payments/entities/payment-method-config.entity.js';
import { StudentProfile } from './entities/student-profile.entity.js';
import { Payment } from '../payments/entities/payment.entity.js';
import { Lesson } from '../lessons/entities/lesson.entity.js';
import { StudentFavorite } from './entities/student-favorite.entity.js';
import { TutorProfile } from '../tutors/entities/tutor-profile.entity.js';
import { Review } from '../reviews/entities/review.entity.js';
import { Setting } from '../admin/entities/setting.entity.js';
import { CommissionService } from '../payments/commission.service.js';

@Injectable()
export class StudentsService {
  constructor(
    @InjectRepository(StudentProfile)
    private readonly studentProfileRepository: Repository<StudentProfile>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Lesson)
    private readonly lessonRepository: Repository<Lesson>,
    @InjectRepository(StudentFavorite)
    private readonly favoriteRepository: Repository<StudentFavorite>,
    @InjectRepository(TutorProfile)
    private readonly tutorProfileRepository: Repository<TutorProfile>,
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
    @InjectRepository(Setting)
    private readonly settingRepository: Repository<Setting>,
    @InjectRepository(PaymentMethodConfig)
    private readonly paymentMethodConfigRepository: Repository<PaymentMethodConfig>,
    private readonly commissionService: CommissionService,
  ) {}

  async getBalance(userId: string) {
    const profile = await this.studentProfileRepository.findOne({
      where: { userId },
    });
    if (!profile) throw new NotFoundException('Student profile not found');
    const creditPrice = await this.commissionService.getCreditPrice();
    let egpRate: number | null = null;
    try {
      egpRate = await this.commissionService.getEgpRate();
    } catch {
      // USD wallet access must not depend on optional EGP deposits.
    }
    return { balance: profile.balance, creditPrice, egpRate };
  }

  async getPaymentHistory(userId: string, page = 1, limit = 50) {
    const payments = await this.paymentRepository.find({
      where: { userId: userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return payments;
  }

  async getPaymentMethods(_userId: string) {
    const configs = await this.paymentMethodConfigRepository.find({
      order: { sortOrder: 'ASC' },
    });
    if (configs.length === 0) {
      // Fallback uses PaymentMethod enum values — must match exactly
      return [
        { type: 'card', label: 'Credit Card', enabled: false, details: null },
        { type: 'paypal', label: 'PayPal', enabled: false, details: null },
        {
          type: 'vodafone',
          label: 'Vodafone Cash',
          enabled: false,
          details: null,
        },
        {
          type: 'instapay',
          label: 'Instapay',
          enabled: false,
          details: null,
        },
        {
          type: 'binance',
          label: 'Binance',
          enabled: false,
          details: null,
        },
        {
          type: 'bank',
          label: 'Bank Transfer',
          enabled: false,
          details: null,
        },
      ];
    }
    return configs.map((c) => ({
      type: c.type,
      label: c.label,
      enabled: c.enabled,
      details: c.details,
    }));
  }

  async getCombinedHistory(userId: string) {
    const payments = await this.paymentRepository.find({
      where: { userId: userId },
      order: { createdAt: 'DESC' },
      take: 50,
    });

    const lessons = await this.lessonRepository.find({
      where: { studentId: userId },
      relations: { tutor: true },
      order: { scheduledTime: 'DESC' },
      take: 50,
    });

    return { payments, lessons };
  }

  async addFavorite(studentId: string, tutorId: string) {
    const tutor = await this.tutorProfileRepository.findOne({
      where: { userId: tutorId, status: CourseStatus.APPROVED },
    });
    if (!tutor) {
      throw new NotFoundException('Tutor not found');
    }

    const existing = await this.favoriteRepository.findOne({
      where: { studentId, tutorId },
    });
    if (existing) {
      throw new ConflictException('Tutor is already in favorites');
    }

    const favorite = this.favoriteRepository.create({ studentId, tutorId });
    await this.favoriteRepository.save(favorite);
    return { success: true, tutorId };
  }

  async removeFavorite(studentId: string, tutorId: string) {
    const result = await this.favoriteRepository.delete({ studentId, tutorId });
    if (result.affected === 0) {
      throw new NotFoundException('Favorite not found');
    }
    return { success: true, tutorId };
  }

  async getFavoriteTutorIds(studentId: string): Promise<string[]> {
    const favorites = await this.favoriteRepository.find({
      where: { studentId },
    });
    return favorites.map((f) => f.tutorId);
  }

  async getFavoriteTutors(studentId: string) {
    const tutorIds = await this.getFavoriteTutorIds(studentId);
    if (tutorIds.length === 0) return [];

    const tutors = await this.tutorProfileRepository.find({
      where: { userId: In(tutorIds), status: CourseStatus.APPROVED },
      relations: { user: true },
    });

    const ratings = await this.reviewRepository
      .createQueryBuilder('review')
      .select('review.tutorId', 'tutorId')
      .addSelect('AVG(review.rating)', 'averageRating')
      .where('review.tutorId IN (:...tutorIds)', { tutorIds })
      .andWhere('review.status = :status', {
        status: ReviewStatus.APPROVED,
      })
      .groupBy('review.tutorId')
      .getRawMany<{ tutorId: string; averageRating: string | null }>();
    const ratingsByTutor = new Map(
      ratings.map((rating) => [
        rating.tutorId,
        Number(rating.averageRating ?? 0),
      ]),
    );
    const result = tutors.map((t) => {
      return {
        userId: t.userId,
        firstName: t.user?.firstName ?? '',
        lastName: t.user?.lastName ?? '',
        specialization: t.specialization,
        hourlyRate: t.hourlyRate,
        averageRating: ratingsByTutor.get(t.userId) ?? 0,
      };
    });

    return result.sort((a, b) => b.averageRating - a.averageRating);
  }
}
