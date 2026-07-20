import {
  Controller,
  Post,
  Req,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';
import { PaymentStatus } from '@mrh/types';
import { StripeService } from './stripe.service.js';
import { PaymentsService } from '../payments.service.js';
import { Payment } from '../entities/payment.entity.js';
import { ProcessedWebhookEvent } from '../entities/processed-webhook-event.entity.js';
import { TutorProfile } from '../../tutors/entities/tutor-profile.entity.js';
import { Public } from '../../auth/decorators/public.decorator.js';
import Stripe from 'stripe';

@Public()
@Controller('webhooks/stripe')
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(
    private readonly stripeService: StripeService,
    private readonly paymentsService: PaymentsService,
    @InjectRepository(TutorProfile)
    private readonly tutorProfileRepository: Repository<TutorProfile>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(ProcessedWebhookEvent)
    private readonly processedWebhookEventRepository: Repository<ProcessedWebhookEvent>,
  ) {}

  @Post()
  async handleWebhook(@Req() req: RawBodyRequest<Request>) {
    let event: Stripe.Event;

    try {
      event = this.stripeService.constructEvent(req);
    } catch (err) {
      throw new BadRequestException(`Webhook Error: ${(err as Error).message}`);
    }

    const alreadyProcessed = await this.processedWebhookEventRepository.findOne(
      {
        where: { eventId: event.id },
      },
    );
    if (alreadyProcessed) {
      return { received: true, skipped: 'duplicate event' };
    }

    try {
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;

        if (session.payment_status !== 'paid') {
          await this.recordProcessed(event);
          return { received: true, skipped: 'payment not completed' };
        }

        const paymentId = session.metadata?.paymentId;
        const userId = session.metadata?.userId;
        if (!paymentId || !userId) {
          await this.recordProcessed(event);
          throw new BadRequestException('Missing payment metadata');
        }

        const payment = await this.paymentRepository.findOne({
          where: { id: paymentId },
        });
        if (!payment) {
          await this.recordProcessed(event);
          throw new BadRequestException('Payment not found');
        }
        if (payment.userId !== userId) {
          await this.recordProcessed(event);
          throw new BadRequestException('Payment user mismatch');
        }
        if (payment.status !== PaymentStatus.PENDING) {
          await this.recordProcessed(event);
          return { received: true, skipped: 'already processed' };
        }

        const expectedCents = Math.round(payment.amount * 100);
        if (
          session.amount_total !== null &&
          session.amount_total !== expectedCents
        ) {
          await this.recordProcessed(event);
          throw new BadRequestException('Payment amount mismatch');
        }

        await this.paymentsService.approvePayment(paymentId, 'stripe-webhook');
      }

      if (event.type === 'account.updated') {
        const account = event.data.object;
        const profile = await this.tutorProfileRepository.findOne({
          where: { stripeAccountId: account.id },
        });
        if (profile) {
          const onboardingComplete =
            account.charges_enabled && account.payouts_enabled;
          if (onboardingComplete !== profile.stripeOnboardingComplete) {
            await this.tutorProfileRepository.update(profile.userId, {
              stripeOnboardingComplete: onboardingComplete,
            });
          }
        }
      }
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      this.logger.error(
        `Webhook processing failed for event ${event.id}:`,
        err,
      );
    }

    await this.recordProcessed(event);
    return { received: true };
  }

  private async recordProcessed(event: Stripe.Event) {
    try {
      await this.processedWebhookEventRepository.insert({
        eventId: event.id,
        eventType: event.type,
      });
    } catch {
      // ignore duplicate key violations
    }
  }
}
