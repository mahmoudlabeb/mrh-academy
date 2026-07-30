import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  EntityManager,
  Repository,
  type DeepPartial,
  type FindOptionsWhere,
} from 'typeorm';
import { FinancialLedgerStatus, FinancialTransactionType } from '@mrh/types';
import {
  FinancialLedgerEntry,
  type SafeFinancialMetadata,
} from './entities/financial-ledger-entry.entity.js';

export type FinancialLedgerWrite = {
  eventKey: string;
  transactionType: FinancialTransactionType;
  status: FinancialLedgerStatus;
  provider: string;
  method: string;
  amount: number;
  currency: string;
  userId?: string | null;
  tutorId?: string | null;
  paymentId?: string | null;
  courseId?: string | null;
  enrollmentId?: string | null;
  lessonId?: string | null;
  payoutId?: string | null;
  providerReferenceId?: string | null;
  providerStatus?: string | null;
  adminCommission?: number;
  tutorShare?: number;
  balanceBefore?: number | null;
  balanceAfter?: number | null;
  metadata?: SafeFinancialMetadata;
  occurredAt?: Date;
};

export type FinancialLedgerPatch = Partial<
  Omit<FinancialLedgerWrite, 'eventKey' | 'transactionType'>
>;

export type FinancialLedgerFilter =
  'all' | 'succeeded' | 'pending' | 'failed' | 'refunded' | 'disputed';

@Injectable()
export class FinancialLedgerService {
  constructor(
    @InjectRepository(FinancialLedgerEntry)
    private readonly ledgerRepository: Repository<FinancialLedgerEntry>,
  ) {}

  async record(
    manager: EntityManager,
    input: FinancialLedgerWrite,
  ): Promise<FinancialLedgerEntry> {
    const repository = manager.getRepository(FinancialLedgerEntry);
    const existing = await repository.findOne({
      where: { eventKey: input.eventKey },
      lock: { mode: 'pessimistic_write' },
    });
    if (existing) return existing;
    return repository.save(
      repository.create({
        ...input,
        userId: input.userId ?? null,
        tutorId: input.tutorId ?? null,
        paymentId: input.paymentId ?? null,
        courseId: input.courseId ?? null,
        enrollmentId: input.enrollmentId ?? null,
        lessonId: input.lessonId ?? null,
        payoutId: input.payoutId ?? null,
        providerReferenceId: input.providerReferenceId ?? null,
        providerStatus: input.providerStatus ?? null,
        adminCommission: input.adminCommission ?? 0,
        tutorShare: input.tutorShare ?? 0,
        balanceBefore: input.balanceBefore ?? null,
        balanceAfter: input.balanceAfter ?? null,
        metadata: input.metadata ?? {},
        occurredAt: input.occurredAt ?? new Date(),
      }),
    );
  }

  async update(
    manager: EntityManager,
    eventKey: string,
    patch: FinancialLedgerPatch,
  ): Promise<void> {
    const defined = Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined),
    ) as DeepPartial<FinancialLedgerEntry>;
    if (Object.keys(defined).length === 0) return;
    await manager.update(FinancialLedgerEntry, { eventKey }, defined);
  }

  async recordOrUpdate(
    manager: EntityManager,
    input: FinancialLedgerWrite,
  ): Promise<FinancialLedgerEntry> {
    const existing = await manager.findOne(FinancialLedgerEntry, {
      where: { eventKey: input.eventKey },
      lock: { mode: 'pessimistic_write' },
    });
    if (!existing) return this.record(manager, input);
    Object.assign(
      existing,
      Object.fromEntries(
        Object.entries(input).filter(([, value]) => value !== undefined),
      ),
    );
    return manager.save(FinancialLedgerEntry, existing);
  }

  async list(input: {
    page: number;
    limit: number;
    status?: FinancialLedgerFilter;
    type?: FinancialTransactionType;
    method?: string;
    search?: string;
  }) {
    const query = this.ledgerRepository
      .createQueryBuilder('entry')
      .leftJoinAndSelect('entry.user', 'user')
      .leftJoinAndSelect('entry.tutor', 'tutor')
      .leftJoinAndSelect('entry.course', 'course')
      .leftJoinAndSelect('entry.lesson', 'lesson')
      .orderBy('entry.occurredAt', 'DESC')
      .addOrderBy('entry.createdAt', 'DESC')
      .skip((input.page - 1) * input.limit)
      .take(input.limit);

    const statuses = this.statusesForFilter(input.status ?? 'all');
    if (statuses) {
      query.andWhere('entry.status IN (:...statuses)', { statuses });
    }
    if (input.type) {
      query.andWhere('entry.transactionType = :type', { type: input.type });
    }
    if (input.method?.trim()) {
      query.andWhere('(entry.method = :method OR entry.provider = :method)', {
        method: input.method.trim(),
      });
    }
    if (input.search?.trim()) {
      query.andWhere(
        `(
          user.firstName ILIKE :search
          OR user.lastName ILIKE :search
          OR user.email ILIKE :search
          OR tutor.firstName ILIKE :search
          OR tutor.lastName ILIKE :search
          OR course.title ILIKE :search
          OR entry.providerReferenceId ILIKE :search
          OR entry.eventKey ILIKE :search
        )`,
        { search: `%${input.search.trim()}%` },
      );
    }

    const [items, total] = await query.getManyAndCount();
    return {
      items: items.map((entry) => this.present(entry)),
      total,
      page: input.page,
      limit: input.limit,
    };
  }

  async getDetails(id: string) {
    const entry = await this.ledgerRepository.findOne({
      where: { id },
      relations: {
        user: true,
        tutor: true,
        course: true,
        lesson: true,
      },
    });
    if (!entry) throw new NotFoundException('Financial ledger entry not found');
    return this.present(entry, true);
  }

  async getStudentHistory(userId: string, page: number, limit: number) {
    const where: FindOptionsWhere<FinancialLedgerEntry> = { userId };
    const entries = await this.ledgerRepository.find({
      where,
      relations: { course: true, lesson: true },
      order: { occurredAt: 'DESC', createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return entries.map((entry) => this.present(entry));
  }

  private statusesForFilter(
    filter: FinancialLedgerFilter,
  ): FinancialLedgerStatus[] | null {
    switch (filter) {
      case 'all':
        return null;
      case 'succeeded':
        return [FinancialLedgerStatus.SUCCEEDED];
      case 'pending':
        return [FinancialLedgerStatus.PENDING];
      case 'failed':
        return [FinancialLedgerStatus.FAILED, FinancialLedgerStatus.CANCELLED];
      case 'refunded':
        return [
          FinancialLedgerStatus.REFUNDED,
          FinancialLedgerStatus.PARTIALLY_REFUNDED,
          FinancialLedgerStatus.REVERSED,
        ];
      case 'disputed':
        return [FinancialLedgerStatus.DISPUTED];
    }
  }

  private present(entry: FinancialLedgerEntry, includeAudit = false) {
    const providerReferenceId = entry.providerReferenceId || null;
    return {
      id: entry.id,
      eventKey: entry.eventKey,
      transactionType: entry.transactionType,
      status: entry.status,
      provider: entry.provider,
      method: entry.method,
      amount: Number(entry.amount),
      currency: entry.currency,
      user: entry.user
        ? {
            id: entry.user.id,
            name: `${entry.user.firstName} ${entry.user.lastName}`.trim(),
            email: entry.user.email,
          }
        : null,
      tutor: entry.tutor
        ? {
            id: entry.tutor.id,
            name: `${entry.tutor.firstName} ${entry.tutor.lastName}`.trim(),
          }
        : null,
      providerReferenceId,
      providerStatus: entry.providerStatus,
      paymentId: entry.paymentId,
      course: entry.course
        ? { id: entry.course.id, title: entry.course.title }
        : null,
      enrollmentId: entry.enrollmentId,
      lesson: entry.lesson
        ? {
            id: entry.lesson.id,
            scheduledTime: entry.lesson.scheduledTime,
            durationMinutes: entry.lesson.durationMinutes,
          }
        : null,
      payoutId: entry.payoutId,
      adminCommission: Number(entry.adminCommission ?? 0),
      tutorShare: Number(entry.tutorShare ?? 0),
      balanceBefore:
        entry.balanceBefore === null ? null : Number(entry.balanceBefore),
      balanceAfter:
        entry.balanceAfter === null ? null : Number(entry.balanceAfter),
      occurredAt: entry.occurredAt,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      ...(includeAudit ? { audit: entry.metadata ?? {} } : {}),
    };
  }
}
