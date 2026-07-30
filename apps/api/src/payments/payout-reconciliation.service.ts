import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, LessThan } from 'typeorm';
import { Payout } from './entities/payout.entity.js';
import { PayoutStatus } from '@mrh/types';
import { TutorProfile } from '../tutors/entities/tutor-profile.entity.js';

@Injectable()
export class PayoutReconciliationService {
  private readonly logger = new Logger(PayoutReconciliationService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async reconcilePendingPayouts() {
    const payoutRepo = this.dataSource.getRepository(Payout);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const stuckPayouts = await payoutRepo.find({
      where: {
        status: PayoutStatus.PENDING,
        method: 'stripe_connect',
        createdAt: LessThan(oneHourAgo),
      },
    });

    if (stuckPayouts.length === 0) return;

    this.logger.log(`Reconciling ${stuckPayouts.length} stuck payout(s)`);

    for (const payout of stuckPayouts) {
      await this.dataSource.transaction(async (manager) => {
        const lockedPayout = await manager.findOne(Payout, {
          where: { id: payout.id },
          lock: { mode: 'pessimistic_write' },
        });
        if (
          !lockedPayout ||
          lockedPayout.status !== PayoutStatus.PENDING ||
          lockedPayout.method !== 'stripe_connect'
        ) {
          return;
        }

        if (lockedPayout.stripePayoutId) {
          await manager.update(
            Payout,
            { id: lockedPayout.id },
            {
              status: PayoutStatus.SUCCESS,
            },
          );
          this.logger.log(
            `Reconciled payout ${payout.id} → SUCCESS (had stripePayoutId)`,
          );
        } else {
          const profile = await manager.findOne(TutorProfile, {
            where: { userId: lockedPayout.tutorId },
            lock: { mode: 'pessimistic_write' },
          });
          if (profile) {
            profile.balance =
              Number(profile.balance) + Number(lockedPayout.amount);
            await manager.save(TutorProfile, profile);
          }
          await manager.update(
            Payout,
            { id: lockedPayout.id },
            {
              status: PayoutStatus.FAILED,
              errorMessage: 'Reconciled: Stripe transfer was never initiated',
            },
          );
          this.logger.log(
            `Reconciled payout ${payout.id} → FAILED (balance reverted)`,
          );
        }
      });
    }
  }
}
