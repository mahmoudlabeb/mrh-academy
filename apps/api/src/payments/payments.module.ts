import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from '../entities/payment.entity.js';
import { Payout } from '../entities/payout.entity.js';
import { ProcessedWebhookEvent } from '../entities/processed-webhook-event.entity.js';
import { PaymentMethodConfig } from '../entities/payment-method-config.entity.js';
import { StudentProfile } from '../entities/student-profile.entity.js';
import { TutorProfile } from '../entities/tutor-profile.entity.js';
import { User } from '../entities/user.entity.js';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';
import { PayoutController } from './payout.controller.js';
import { PaymentMethodsController } from './payment-methods.controller.js';
import { InvoiceService } from './invoice.service.js';
import { StripeService } from './stripe/stripe.service.js';
import { StripeWebhookController } from './stripe/stripe-webhook.controller.js';
import { StripeConnectController } from './stripe/stripe-connect.controller.js';
import { EmailService } from '../services/email.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Payment,
      Payout,
      ProcessedWebhookEvent,
      PaymentMethodConfig,
      StudentProfile,
      TutorProfile,
      User,
    ]),
  ],
  controllers: [
    PaymentsController,
    PayoutController,
    PaymentMethodsController,
    StripeWebhookController,
    StripeConnectController,
  ],
  providers: [PaymentsService, StripeService, InvoiceService, EmailService],
  exports: [PaymentsService, StripeService, InvoiceService],
})
export class PaymentsModule {}
