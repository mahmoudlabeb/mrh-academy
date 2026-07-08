import { Controller, Post, Req, BadRequestException } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';
import { StripeService } from './stripe.service.js';
import { PaymentsService } from '../payments.service.js';
import { TutorProfile } from '../../entities/tutor-profile.entity.js';
import { Public } from '../../auth/decorators/public.decorator.js';
import Stripe from 'stripe';

@Public()
@Controller('webhooks/stripe')
export class StripeWebhookController {
  constructor(
    private readonly stripeService: StripeService,
    private readonly paymentsService: PaymentsService,
    @InjectRepository(TutorProfile)
    private readonly tutorProfileRepository: Repository<TutorProfile>,
  ) {}

  @Post()
  async handleWebhook(@Req() req: RawBodyRequest<Request>) {
    let event: Stripe.Event;

    try {
      event = this.stripeService.constructEvent(req);
    } catch (err) {
      throw new BadRequestException(`Webhook Error: ${(err as Error).message}`);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      
      const paymentId = session.metadata?.paymentId;
      if (paymentId) {
        try {
          await this.paymentsService.approvePayment(paymentId, 'stripe-webhook');
        } catch (e) {
          console.error('Failed to auto-approve payment via webhook', e);
        }
      }
    }

    if (event.type === 'account.updated') {
      const account = event.data.object as Stripe.Account;
      const profile = await this.tutorProfileRepository.findOne({
        where: { stripeAccountId: account.id },
      });
      if (profile) {
        const onboardingComplete = account.charges_enabled && account.payouts_enabled;
        if (onboardingComplete !== profile.stripeOnboardingComplete) {
          await this.tutorProfileRepository.update(profile.userId, {
            stripeOnboardingComplete: onboardingComplete,
          });
        }
      }
    }

    return { received: true };
  }
}
