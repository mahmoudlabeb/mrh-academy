import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { UserRole } from '@mrh/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RequirePermissions } from '../auth/decorators/permissions.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { PaymentsService } from '../payments/payments.service.js';
import { StripeService } from '../payments/stripe/stripe.service.js';
import { TutorProfile } from '../entities/tutor-profile.entity.js';
import { Payout, PayoutStatus } from '../entities/payout.entity.js';

@Controller('admin/payments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@RequirePermissions('manage_payments')
export class AdminPaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly stripeService: StripeService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(TutorProfile)
    private readonly tutorProfileRepository: Repository<TutorProfile>,
    @InjectRepository(Payout)
    private readonly payoutRepository: Repository<Payout>,
  ) {}

  @Get()
  async getAllPayments() {
    const payments = await this.paymentsService.getAllPayments();
    return payments.map((p) => ({
      id: p.id,
      userName: p.user ? `${p.user.firstName} ${p.user.lastName}` : 'Unknown',
      amount: p.amount,
      currency: p.currency,
      paymentMethod: p.method,
      status: p.status,
      receiptUrl: p.receiptUrl,
      adminNote: p.adminNote,
      rejectionReason: p.rejectionReason,
      createdAt: p.createdAt,
    }));
  }

  @Post(':id/approve')
  async approvePayment(
    @Param('id') id: string,
    @CurrentUser() admin: { id: string },
  ) {
    return this.paymentsService.approvePayment(id, admin.id);
  }

  @Post(':id/reject')
  async rejectPayment(
    @Param('id') id: string,
    @CurrentUser() admin: { id: string },
    @Body() body?: { reason?: string },
  ) {
    return this.paymentsService.rejectPayment(id, admin.id, body?.reason);
  }

  @Post('payout/:tutorId')
  async payoutTutor(@Param('tutorId') tutorId: string) {
    let payoutAmount = 0;
    let stripeAccountId = '';
    let payoutRecord: Payout | undefined;

    await this.dataSource.transaction(async (manager) => {
      const profile = await manager.findOne(TutorProfile, {
        where: { userId: tutorId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!profile) throw new BadRequestException('Tutor profile not found');
      if (!profile.stripeAccountId)
        throw new BadRequestException('Tutor has no Stripe Connect account');
      if (!profile.stripeOnboardingComplete)
        throw new BadRequestException(
          'Tutor has not completed Stripe onboarding',
        );
      if (profile.balance <= 0)
        throw new BadRequestException('Tutor has zero balance');

      payoutAmount = profile.balance;
      stripeAccountId = profile.stripeAccountId;
      await manager.update(TutorProfile, { userId: tutorId }, { balance: 0 });

      payoutRecord = manager.create(Payout, {
        tutorId,
        amount: payoutAmount,
        status: PayoutStatus.PENDING,
      });
      await manager.save(payoutRecord);
    });

    if (!payoutRecord) {
      throw new Error('Payout record was not created');
    }
    const createdPayout = payoutRecord;

    const amountCents = Math.round(payoutAmount * 100);
    const idempotencyKey = `payout-${createdPayout.id}`; // Use the payout record ID as idempotency key for uniqueness

    try {
      const stripeResponse = await this.stripeService.createPayout(
        stripeAccountId,
        amountCents,
        idempotencyKey,
      );

      await this.payoutRepository.update(createdPayout.id, {
        status: PayoutStatus.SUCCESS,
        stripePayoutId: stripeResponse.id, // Assuming stripeService returns the payout object
      });
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'Stripe payout failed';
      // Revert the balance and update payout record to FAILED
      await this.dataSource.transaction(async (manager) => {
        await manager.increment(
          TutorProfile,
          { userId: tutorId },
          'balance',
          payoutAmount,
        );
        await manager.update(
          Payout,
          { id: createdPayout.id },
          {
            status: PayoutStatus.FAILED,
            errorMessage,
          },
        );
      });
      throw err;
    }

    return { message: 'Payout sent successfully', amount: payoutAmount };
  }
}
