import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from '../entities/payment.entity.js';
import { StudentProfile } from '../entities/student-profile.entity.js';
import { TutorProfile } from '../entities/tutor-profile.entity.js';
import { User } from '../entities/user.entity.js';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';
import { StripeService } from './stripe/stripe.service.js';
import { StripeWebhookController } from './stripe/stripe-webhook.controller.js';
import { StripeConnectController } from './stripe/stripe-connect.controller.js';
import { EmailService } from '../services/email.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, StudentProfile, TutorProfile, User]),
  ],
  controllers: [
    PaymentsController,
    StripeWebhookController,
    StripeConnectController,
  ],
  providers: [PaymentsService, StripeService, EmailService],
  exports: [PaymentsService, StripeService],
})
export class PaymentsModule {}
