import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Setting } from '../entities/setting.entity.js';

@Injectable()
export class CommissionService {
  private cachedTutorPromoRate: number | null = null;
  private cachedAcademyBaseRate: number | null = null;

  constructor(
    @InjectRepository(Setting)
    private readonly settingRepository: Repository<Setting>,
  ) {}

  private async getCourseTutorPromoRate(): Promise<number> {
    if (this.cachedTutorPromoRate !== null) return this.cachedTutorPromoRate;
    const setting = await this.settingRepository.findOne({ where: { key: 'course_tutor_promo_rate' } });
    this.cachedTutorPromoRate = setting ? parseFloat(setting.value) : 0.02;
    return this.cachedTutorPromoRate;
  }

  private async getCourseAcademyBaseRate(): Promise<number> {
    if (this.cachedAcademyBaseRate !== null) return this.cachedAcademyBaseRate;
    const setting = await this.settingRepository.findOne({ where: { key: 'course_academy_base_rate' } });
    this.cachedAcademyBaseRate = setting ? parseFloat(setting.value) : 0.53;
    return this.cachedAcademyBaseRate;
  }

  async invalidateCache() {
    this.cachedTutorPromoRate = null;
    this.cachedAcademyBaseRate = null;
  }

  calculateLessonFee(totalHours: number): number {
    if (totalHours <= 0) return 0.30;
    if (totalHours <= 20) return 0.30;
    if (totalHours <= 50) return 0.24;
    if (totalHours <= 200) return 0.20;
    if (totalHours <= 400) return 0.18;
    return 0.12;
  }

  calculateLessonEarnings(price: number, totalHours: number): { platformFee: number; tutorShare: number } {
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

  async calculateCourseEarnings(price: number, soldBy: 'tutor' | 'academy'): Promise<{ platformFee: number; tutorShare: number }> {
    const feePercentage = await this.calculateCourseFee(soldBy);
    const platformFee = Math.round(price * feePercentage * 100) / 100;
    const tutorShare = Math.round((price - platformFee) * 100) / 100;
    return { platformFee, tutorShare };
  }
}
