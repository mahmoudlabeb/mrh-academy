import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Setting } from '../entities/setting.entity.js';

const CACHE_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class CommissionService {
  private cachedTutorPromoRate: number | null = null;
  private cachedAcademyBaseRate: number | null = null;
  private cachedCreditPrice: number | null = null;
  private cachedEgpRate: number | null = null;
  private cacheExpiresAt = 0;

  constructor(
    @InjectRepository(Setting)
    private readonly settingRepository: Repository<Setting>,
  ) {}

  private isCacheValid(): boolean {
    return Date.now() < this.cacheExpiresAt;
  }

  private touchCache() {
    this.cacheExpiresAt = Date.now() + CACHE_TTL_MS;
  }

  private async getCourseTutorPromoRate(): Promise<number> {
    if (this.cachedTutorPromoRate !== null && this.isCacheValid()) {
      return this.cachedTutorPromoRate;
    }
    const setting = await this.settingRepository.findOne({
      where: { key: 'course_tutor_promo_rate' },
    });
    this.cachedTutorPromoRate = setting ? parseFloat(setting.value) : 0.05;
    this.touchCache();
    return this.cachedTutorPromoRate;
  }

  private async getCourseAcademyBaseRate(): Promise<number> {
    if (this.cachedAcademyBaseRate !== null && this.isCacheValid()) {
      return this.cachedAcademyBaseRate;
    }
    const setting = await this.settingRepository.findOne({
      where: { key: 'course_academy_base_rate' },
    });
    this.cachedAcademyBaseRate = setting ? parseFloat(setting.value) : 0.54;
    this.touchCache();
    return this.cachedAcademyBaseRate;
  }

  async getCreditPrice(): Promise<number> {
    if (this.cachedCreditPrice !== null && this.isCacheValid()) {
      return this.cachedCreditPrice;
    }
    const setting = await this.settingRepository.findOne({
      where: { key: 'default_lesson_price' },
    });
    const parsed = setting ? parseFloat(setting.value) : 15;
    this.cachedCreditPrice =
      Number.isFinite(parsed) && parsed > 0 ? parsed : 15;
    this.touchCache();
    return this.cachedCreditPrice;
  }

  async amountToCredits(amount: number): Promise<number> {
    const price = await this.getCreditPrice();
    return Math.round((amount / price) * 100) / 100;
  }

  invalidateCache() {
    this.cachedTutorPromoRate = null;
    this.cachedAcademyBaseRate = null;
    this.cachedCreditPrice = null;
    this.cachedEgpRate = null;
    this.cacheExpiresAt = 0;
  }

  async getEgpRate(): Promise<number> {
    if (this.cachedEgpRate !== null && this.isCacheValid()) {
      return this.cachedEgpRate;
    }
    const setting = await this.settingRepository.findOne({
      where: { key: 'egp_to_usd_rate' },
    });
    const parsed = setting ? parseFloat(setting.value) : 50;
    this.cachedEgpRate = Number.isFinite(parsed) && parsed > 0 ? parsed : 50;
    this.touchCache();
    return this.cachedEgpRate;
  }

  calculateLessonFee(totalHours: number): number {
    if (totalHours <= 20) return 0.3;
    if (totalHours <= 50) return 0.24;
    if (totalHours <= 200) return 0.2;
    if (totalHours <= 400) return 0.18;
    return 0.12;
  }

  calculateLessonEarnings(
    price: number,
    totalHours: number,
  ): { platformFee: number; tutorShare: number } {
    const feePercentage = this.calculateLessonFee(totalHours);
    const platformFee = Math.round(price * feePercentage * 100) / 100;
    const tutorShare = Math.round((price - platformFee) * 100) / 100;
    return { platformFee, tutorShare };
  }

  async calculateCourseFee(soldBy: 'tutor' | 'academy'): Promise<number> {
    if (soldBy === 'tutor') {
      return this.getCourseTutorPromoRate();
    }
    return this.getCourseAcademyBaseRate();
  }

  async calculateCourseEarnings(
    price: number,
    soldBy: 'tutor' | 'academy',
  ): Promise<{ platformFee: number; tutorShare: number }> {
    const feePercentage = await this.calculateCourseFee(soldBy);
    const platformFee = Math.round(price * feePercentage * 100) / 100;
    const tutorShare = Math.round((price - platformFee) * 100) / 100;
    return { platformFee, tutorShare };
  }
}
