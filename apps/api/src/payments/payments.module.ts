import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from './entities/payment.entity.js';
import { Payout } from './entities/payout.entity.js';
import { ProcessedWebhookEvent } from './entities/processed-webhook-event.entity.js';
import { PaymentMethodConfig } from './entities/payment-method-config.entity.js';
import { StudentProfile } from '../students/entities/student-profile.entity.js';
import { TutorProfile } from '../tutors/entities/tutor-profile.entity.js';
import { User } from '../users/entities/user.entity.js';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';
import { PayoutController } from './payout.controller.js';
import { PaymentMethodsController } from './payment-methods.controller.js';
import { InvoiceService } from './invoice.service.js';
import { StripeService } from './stripe/stripe.service.js';
import { StripeWebhookController } from './stripe/stripe-webhook.controller.js';
import { StripeConnectController } from './stripe/stripe-connect.controller.js';
import { EmailService } from '../integrations/email/email.service.js';
import { CommissionService } from './commission.service.js';
import { PayoutReconciliationService } from './payout-reconciliation.service.js';
import { StorageModule } from '../integrations/storage/storage.module.js';
import { Setting } from '../admin/entities/setting.entity.js';
import { Notification } from '../messages/entities/notification.entity.js';
import { CourseFundingAllocation } from './entities/course-funding-allocation.entity.js';
import { CourseRefundReversal } from './entities/course-refund-reversal.entity.js';
import { CourseEnrollment } from '../courses/entities/course-enrollment.entity.js';
import { CourseLessonCompletion } from '../courses/entities/course-lesson-completion.entity.js';
import { Course } from '../courses/entities/course.entity.js';
import { PayPalService } from './paypal/paypal.service.js';

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
      Setting,
      Notification,
      CourseFundingAllocation,
      CourseRefundReversal,
      CourseEnrollment,
      CourseLessonCompletion,
      Course,
    ]),
    StorageModule,
  ],
  controllers: [
    PaymentsController,
    PayoutController,
    PaymentMethodsController,
    StripeWebhookController,
    StripeConnectController,
  ],
  providers: [
    PaymentsService,
    StripeService,
    PayPalService,
    InvoiceService,
    EmailService,
    CommissionService,
    PayoutReconciliationService,
  ],
  exports: [PaymentsService, StripeService, InvoiceService, CommissionService],
})
export class PaymentsModule {}
