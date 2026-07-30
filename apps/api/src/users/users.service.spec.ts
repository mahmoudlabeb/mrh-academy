import {
  FinancialLedgerStatus,
  LessonPaymentStatus,
  LessonStatus,
  UserRole,
} from '@mrh/types';
import { Classroom } from '../classroom/entities/classroom.entity.js';
import { Lesson } from '../lessons/entities/lesson.entity.js';
import { LessonFundingAllocation } from '../payments/entities/lesson-funding-allocation.entity.js';
import { Payment } from '../payments/entities/payment.entity.js';
import { FinancialLedgerService } from '../payments/financial-ledger.service.js';
import { StudentProfile } from '../students/entities/student-profile.entity.js';
import { User } from './entities/user.entity.js';
import { UsersService } from './users.service.js';

describe('UsersService payment audit behavior', () => {
  it('refunds a confirmed lesson and records the balance movement during account deletion', async () => {
    const user = {
      id: 'student-1',
      role: UserRole.STUDENT,
      deletedAt: null,
    };
    const lesson = {
      id: 'lesson-1',
      studentId: 'student-1',
      tutorId: 'tutor-1',
      price: 50,
      platformFee: 15,
      tutorShare: 35,
      tutorShareReleasedAt: null,
      status: LessonStatus.CONFIRMED,
      paymentStatus: LessonPaymentStatus.PAID,
    };
    const studentProfile = { userId: 'student-1', balance: 20 };
    const manager = {
      findOne: jest.fn(async (entity: unknown) => {
        if (entity === User) return user;
        if (entity === StudentProfile) return studentProfile;
        return null;
      }),
      find: jest.fn(async (entity: unknown) => {
        if (entity === Lesson) return [lesson];
        if (entity === LessonFundingAllocation) {
          return [
            {
              id: 'allocation-1',
              lessonId: lesson.id,
              paymentId: 'payment-1',
              amount: 50,
            },
          ];
        }
        return [];
      }),
      decrement: jest.fn(),
      increment: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
      save: jest.fn(async (_entity: unknown, value: unknown) => value),
    };
    const dataSource = {
      transaction: jest.fn(async (callback) => callback(manager)),
    };
    const redisService = { del: jest.fn() };
    const financialLedgerService = {
      update: jest.fn(),
      record: jest.fn(),
    };
    const service = new UsersService(
      {} as never,
      dataSource as never,
      {} as never,
      redisService as never,
      {} as never,
      {} as never,
      financialLedgerService as unknown as FinancialLedgerService,
    );

    await service.deleteMe(user.id);

    expect(manager.decrement).toHaveBeenCalledWith(
      Payment,
      { id: 'payment-1' },
      'allocatedAmount',
      50,
    );
    expect(manager.increment).toHaveBeenCalledWith(
      StudentProfile,
      { userId: user.id },
      'balance',
      lesson.price,
    );
    expect(lesson.status).toBe(LessonStatus.CANCELLED);
    expect(lesson.paymentStatus).toBe(LessonPaymentStatus.REFUNDED);
    expect(manager.update).toHaveBeenCalledWith(
      Classroom,
      { lessonId: lesson.id },
      { isActive: false },
    );
    expect(financialLedgerService.update).toHaveBeenCalledWith(
      manager,
      `lesson_booking:${lesson.id}`,
      { status: FinancialLedgerStatus.REFUNDED },
    );
    expect(financialLedgerService.record).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({
        eventKey: `lesson_refund:${lesson.id}`,
        balanceBefore: 20,
        balanceAfter: 70,
        metadata: { reason: 'account_deletion' },
      }),
    );
  });
});
