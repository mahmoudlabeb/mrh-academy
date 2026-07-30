import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentMethodConfig } from '../payments/entities/payment-method-config.entity.js';
import { StudentProfile } from './entities/student-profile.entity.js';
import { Payment } from '../payments/entities/payment.entity.js';
import { Lesson } from '../lessons/entities/lesson.entity.js';
import { Setting } from '../admin/entities/setting.entity.js';
import { CommissionService } from '../payments/commission.service.js';
import { FinancialLedgerService } from '../payments/financial-ledger.service.js';

@Injectable()
export class StudentsService {
  constructor(
    @InjectRepository(StudentProfile)
    private readonly studentProfileRepository: Repository<StudentProfile>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Lesson)
    private readonly lessonRepository: Repository<Lesson>,
    @InjectRepository(Setting)
    private readonly settingRepository: Repository<Setting>,
    @InjectRepository(PaymentMethodConfig)
    private readonly paymentMethodConfigRepository: Repository<PaymentMethodConfig>,
    private readonly commissionService: CommissionService,
    private readonly financialLedgerService: FinancialLedgerService,
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
    return this.financialLedgerService.getStudentHistory(userId, page, limit);
  }

  async getPaymentMethods(_userId: string) {
    const configs = await this.paymentMethodConfigRepository.find({
      where: [{ type: 'card' }, { type: 'paypal' }],
      order: { sortOrder: 'ASC' },
    });
    if (configs.length === 0) {
      // Fallback uses PaymentMethod enum values — must match exactly
      return [
        { type: 'card', label: 'Credit Card', enabled: false, details: null },
        { type: 'paypal', label: 'PayPal', enabled: false, details: null },
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
}
