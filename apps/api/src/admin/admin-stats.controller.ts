import { Controller, Get, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '@mrh/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { TutorsService } from '../tutors/tutors.service.js';
import { Lesson } from '../lessons/entities/lesson.entity.js';
import { User } from '../users/entities/user.entity.js';
import { Payment } from '../payments/entities/payment.entity.js';
import { Payout } from '../payments/entities/payout.entity.js';
import { Course } from '../courses/entities/course.entity.js';

@Controller('admin')
export class AdminStatsController {
  constructor(
    private readonly tutorsService: TutorsService,
    @InjectRepository(Lesson)
    private readonly lessonRepository: Repository<Lesson>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Payout)
    private readonly payoutRepository: Repository<Payout>,
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
  ) {}

  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  getStats() {
    return this.tutorsService.getAdminStats();
  }

  @Get('stats/dashboard')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  getDashboardStats() {
    return this.tutorsService.getAdminStats();
  }

  @Get('activity/recent')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getRecentActivity() {
    const [lessons, users, payments, payouts, courses] = await Promise.all([
      this.lessonRepository.find({
        relations: { tutor: true, student: true },
        order: { updatedAt: 'DESC' },
        take: 10,
      }),
      this.userRepository.find({
        order: { createdAt: 'DESC' },
        take: 10,
      }),
      this.paymentRepository.find({
        relations: { user: true },
        order: { updatedAt: 'DESC' },
        take: 10,
      }),
      this.payoutRepository.find({
        order: { updatedAt: 'DESC' },
        take: 10,
      }),
      this.courseRepository.find({
        relations: { tutor: true },
        order: { updatedAt: 'DESC' },
        take: 10,
      }),
    ]);

    return [
      ...lessons.map((lesson) => ({
        id: `lesson:${lesson.id}`,
        type: 'lesson',
        description: `${lesson.status} lesson: ${lesson.tutor?.firstName ?? 'Tutor'} with ${lesson.student?.firstName ?? 'Student'}`,
        user: lesson.tutor?.firstName ?? 'System',
        createdAt: lesson.updatedAt,
      })),
      ...users.map((user) => ({
        id: `user:${user.id}`,
        type: 'user',
        description: `${user.role} account created`,
        user: `${user.firstName} ${user.lastName}`.trim(),
        createdAt: user.createdAt,
      })),
      ...payments.map((payment) => ({
        id: `payment:${payment.id}`,
        type: 'payment',
        description: `${payment.status} ${payment.method} payment of ${payment.currency} ${Number(payment.amount).toFixed(2)}`,
        user: payment.user
          ? `${payment.user.firstName} ${payment.user.lastName}`.trim()
          : 'Student',
        createdAt: payment.updatedAt,
      })),
      ...payouts.map((payout) => ({
        id: `payout:${payout.id}`,
        type: 'payout',
        description: `${payout.status} payout of $${Number(payout.amount).toFixed(2)}`,
        user: 'Tutor',
        createdAt: payout.updatedAt,
      })),
      ...courses.map((course) => ({
        id: `course:${course.id}`,
        type: 'course',
        description: `${course.status} course: ${course.title}`,
        user: course.tutor
          ? `${course.tutor.firstName} ${course.tutor.lastName}`.trim()
          : 'Tutor',
        createdAt: course.updatedAt,
      })),
    ]
      .sort(
        (left, right) =>
          new Date(right.createdAt).getTime() -
          new Date(left.createdAt).getTime(),
      )
      .slice(0, 20);
  }
}
