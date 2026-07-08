import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StudentProfile } from '../entities/student-profile.entity.js';
import { Payment } from '../entities/payment.entity.js';
import { Lesson } from '../entities/lesson.entity.js';

@Injectable()
export class StudentsService {
  constructor(
    @InjectRepository(StudentProfile)
    private readonly studentProfileRepository: Repository<StudentProfile>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Lesson)
    private readonly lessonRepository: Repository<Lesson>,
  ) {}

  async getBalance(userId: string) {
    const profile = await this.studentProfileRepository.findOne({
      where: { userId },
    });
    if (!profile) throw new NotFoundException('Student profile not found');
    return { balance: profile.balance };
  }

  async getPaymentHistory(userId: string) {
    const payments = await this.paymentRepository.find({
      where: { userId: userId },
      order: { createdAt: 'DESC' },
    });
    return payments;
  }

  async getPaymentMethods(userId: string) {
    const profile = await this.studentProfileRepository.findOne({
      where: { userId },
      relations: { user: true },
    });
    if (!profile) throw new NotFoundException('Student profile not found');

    return [
      { type: 'card', label: 'Credit Card', enabled: true },
      { type: 'paypal', label: 'PayPal', enabled: true },
      { type: 'vodafone', label: 'Vodafone Cash', enabled: true },
      { type: 'instapay', label: 'Instapay', enabled: true },
      { type: 'binance', label: 'Binance', enabled: true },
      { type: 'bank', label: 'Bank Transfer', enabled: true },
    ];
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
