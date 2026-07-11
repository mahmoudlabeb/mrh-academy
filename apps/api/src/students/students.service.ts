import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CourseStatus, PaymentMethod } from '@mrh/types';
import { StudentProfile } from '../entities/student-profile.entity.js';
import { Payment } from '../entities/payment.entity.js';
import { Lesson } from '../entities/lesson.entity.js';
import { StudentFavorite } from '../entities/student-favorite.entity.js';
import { TutorProfile } from '../entities/tutor-profile.entity.js';
import { Review } from '../entities/review.entity.js';
import { Setting } from '../entities/setting.entity.js';
import { CommissionService } from '../services/commission.service.js';

const PAYMENT_METHOD_CONFIG: Array<{
  type: PaymentMethod;
  label: string;
  settingKey?: string;
  defaultDetails?: string;
}> = [
  { type: PaymentMethod.CARD, label: 'Credit Card' },
  { type: PaymentMethod.PAYPAL, label: 'PayPal' },
  {
    type: PaymentMethod.VODAFONE,
    label: 'Vodafone Cash',
    settingKey: 'payment_vodafone_number',
    defaultDetails: '01000000000',
  },
  {
    type: PaymentMethod.INSTAPAY,
    label: 'Instapay',
    settingKey: 'payment_instapay_handle',
    defaultDetails: '@mrh_academy',
  },
  {
    type: PaymentMethod.BINANCE,
    label: 'Binance',
    settingKey: 'payment_binance_id',
    defaultDetails: 'Configure in admin settings',
  },
  {
    type: PaymentMethod.BANK,
    label: 'Bank Transfer',
    settingKey: 'payment_bank_details',
    defaultDetails: 'Configure in admin settings',
  },
];

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
    private readonly commissionService: CommissionService,
  ) {}

  async getBalance(userId: string) {
    const profile = await this.studentProfileRepository.findOne({
      where: { userId },
    });
    if (!profile) throw new NotFoundException('Student profile not found');
    const creditPrice = await this.commissionService.getCreditPrice();
    return { balance: profile.balance, creditPrice };
  }

  async getPaymentHistory(userId: string) {
    const payments = await this.paymentRepository.find({
      where: { userId: userId },
      order: { createdAt: 'DESC' },
    });
    return payments;
  }

  async getPaymentMethods(_userId: string) {
    const keys = PAYMENT_METHOD_CONFIG.map((m) => m.settingKey).filter(
      Boolean,
    ) as string[];
    const settings =
      keys.length > 0
        ? await this.settingRepository.find({ where: { key: In(keys) } })
        : [];
    const settingsMap = new Map(settings.map((s) => [s.key, s.value]));

    return PAYMENT_METHOD_CONFIG.map((method) => ({
      type: method.type,
      label: method.label,
      enabled: true,
      details: method.settingKey
        ? settingsMap.get(method.settingKey) || method.defaultDetails || ''
        : undefined,
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

    const result = await Promise.all(
      tutors.map(async (t) => {
        const avg = await this.reviewRepository
          .createQueryBuilder('review')
          .where('review.tutorId = :tutorId', { tutorId: t.userId })
          .andWhere('review.status = :status', {
            status: CourseStatus.APPROVED,
          })
          .select('AVG(review.rating)', 'avg')
          .getRawOne<{ avg: string | null }>();
        return {
          userId: t.userId,
          firstName: t.user?.firstName ?? '',
          lastName: t.user?.lastName ?? '',
          specialization: t.specialization,
          hourlyRate: t.hourlyRate,
          averageRating: avg?.avg ? parseFloat(avg.avg) || 0 : 0,
        };
      }),
    );

    return result.sort((a, b) => b.averageRating - a.averageRating);
  }
}