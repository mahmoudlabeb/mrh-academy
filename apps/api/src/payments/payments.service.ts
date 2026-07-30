import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Inject } from '@nestjs/common';
import {
  DataSource,
  EntityManager,
  In,
  LessThan,
  QueryFailedError,
  Repository,
  type DeepPartial,
} from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  LessonPaymentStatus,
  LessonStatus,
  PaymentMethod,
  PaymentStatus,
} from '@mrh/types';
import { Payment } from './entities/payment.entity.js';
import { Payout } from './entities/payout.entity.js';
import { PayoutStatus } from '@mrh/types';
import { StudentProfile } from '../students/entities/student-profile.entity.js';
import { TutorProfile } from '../tutors/entities/tutor-profile.entity.js';
import { User } from '../users/entities/user.entity.js';
import { PaymentMethodConfig } from './entities/payment-method-config.entity.js';
import { SubmitPaymentDto } from './dto/submit-payment.dto.js';
import { RequestPayoutDto } from './dto/request-payout.dto.js';
import { RequestPlatformPayoutDto } from './dto/request-platform-payout.dto.js';
import { StripeService } from './stripe/stripe.service.js';
import { EmailService } from '../integrations/email/email.service.js';
import { CommissionService } from './commission.service.js';
import { Notification } from '../messages/entities/notification.entity.js';
import { CourseFundingAllocation } from './entities/course-funding-allocation.entity.js';
import { CourseRefundReversal } from './entities/course-refund-reversal.entity.js';
import { CourseEnrollment } from '../courses/entities/course-enrollment.entity.js';
import { Course } from '../courses/entities/course.entity.js';
import { CreateCourseCheckoutDto } from './dto/create-course-checkout.dto.js';
import { CourseStatus, UserRole } from '@mrh/types';
import { PayPalService } from './paypal/paypal.service.js';
import { createHmac } from 'node:crypto';
import { CourseLessonCompletion } from '../courses/entities/course-lesson-completion.entity.js';
import { Lesson } from '../lessons/entities/lesson.entity.js';
import { ProcessedWebhookEvent } from './entities/processed-webhook-event.entity.js';
import { LessonFundingAllocation } from './entities/lesson-funding-allocation.entity.js';
import { PlatformPayout } from './entities/platform-payout.entity.js';
import type { PayPalWebhookEvent } from './paypal/paypal-webhook.controller.js';
import { Classroom } from '../classroom/entities/classroom.entity.js';
import {
  OBJECT_STORAGE,
  type ObjectStorage,
} from '../integrations/storage/object-storage.js';

const RECEIPT_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(StudentProfile)
    private readonly studentProfileRepository: Repository<StudentProfile>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Payout)
    private readonly payoutRepository: Repository<Payout>,
    @InjectRepository(TutorProfile)
    private readonly tutorProfileRepository: Repository<TutorProfile>,
    @InjectRepository(PaymentMethodConfig)
    private readonly paymentMethodConfigRepository: Repository<PaymentMethodConfig>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly stripeService: StripeService,
    private readonly payPalService: PayPalService,
    private readonly emailService: EmailService,
    private readonly commissionService: CommissionService,
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
    @InjectRepository(Lesson)
    private readonly lessonRepository: Repository<Lesson>,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  async createCourseCheckout(userId: string, dto: CreateCourseCheckoutDto) {
    if (!this.stripeService.isConfigured()) {
      throw new BadRequestException('Stripe payments are not configured');
    }
    const course = await this.courseRepository.findOne({
      where: { id: dto.courseId, status: CourseStatus.APPROVED },
    });
    if (!course) throw new NotFoundException('Course not found');

    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: { studentProfile: true },
    });
    if (!user || user.role !== UserRole.STUDENT) {
      throw new BadRequestException(
        'Course checkout requires a student account',
      );
    }
    if (!user.isVerified || !user.isActive) {
      throw new BadRequestException(
        'Verify and activate your student account before checkout',
      );
    }

    const enrolled = await this.dataSource
      .getRepository(CourseEnrollment)
      .findOne({
        where: { studentId: user.id, courseId: course.id },
      });
    if (enrolled)
      throw new BadRequestException('Already enrolled in this course');

    const existingPayment = await this.paymentRepository.findOne({
      where: { idempotencyKey: dto.idempotencyKey },
    });
    if (
      existingPayment &&
      (existingPayment.userId !== user.id ||
        Number(existingPayment.amount) !== Number(course.price) ||
        existingPayment.adminNote !== `Direct course checkout: ${course.id}`)
    ) {
      throw new BadRequestException(
        'Checkout key is already in use for another purchase',
      );
    }
    if (existingPayment && existingPayment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException('Course checkout is already processed');
    }

    let payment = existingPayment;
    if (!payment) {
      try {
        payment = await this.paymentRepository.save(
          this.paymentRepository.create({
            userId: user.id,
            amount: Number(course.price),
            method: PaymentMethod.CARD,
            currency: 'USD',
            status: PaymentStatus.PENDING,
            adminNote: `Direct course checkout: ${course.id}`,
            idempotencyKey: dto.idempotencyKey,
          }),
        );
      } catch (error) {
        const code =
          (error as { code?: string; driverError?: { code?: string } }).code ??
          (error as { driverError?: { code?: string } }).driverError?.code;
        if (code === '23505') {
          payment = await this.paymentRepository.findOne({
            where: { idempotencyKey: dto.idempotencyKey },
          });
        }
        if (!payment) throw error;
      }
    }
    if (
      payment.userId !== user.id ||
      Number(payment.amount) !== Number(course.price) ||
      payment.adminNote !== `Direct course checkout: ${course.id}`
    ) {
      throw new BadRequestException(
        'Checkout key is already in use for another purchase',
      );
    }

    try {
      const session = await this.stripeService.createCourseCheckoutSession({
        userId: user.id,
        paymentId: payment.id,
        courseId: course.id,
        courseTitle: course.title,
        amount: Number(course.price),
        email: user.email,
        referralCode: dto.referralCode,
        idempotencyKey: dto.idempotencyKey,
      });
      await this.paymentRepository.update(payment.id, {
        stripeCheckoutSessionId: session.id,
        providerStatus: 'OPEN',
      });
      return { checkoutUrl: session.url };
    } catch (error) {
      await this.paymentRepository.update(payment.id, {
        providerStatus: 'INITIATION_FAILED',
      });
      this.logger.error('Direct course checkout creation failed', error);
      throw new BadRequestException('Card checkout is currently unavailable');
    }
  }

  private isValidReferral(course: Course, referralCode?: string) {
    if (!referralCode) return false;
    const secret = this.configService.get<string>('application.referralSecret');
    if (!secret) return false;
    const signature = createHmac('sha256', secret)
      .update(`${course.id}:${course.tutorId}`)
      .digest('hex')
      .slice(0, 16);
    return referralCode === `${course.tutorId}.${signature}`;
  }

  async completeCourseCheckout(input: {
    paymentId: string;
    courseId: string;
    referralCode?: string;
    stripeSessionId: string;
    stripePaymentIntentId?: string;
  }) {
    const result = await this.dataSource.transaction(async (manager) => {
      const payment = await manager.findOne(Payment, {
        where: { id: input.paymentId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!payment) throw new NotFoundException('Payment not found');
      if (
        payment.status !== PaymentStatus.PENDING &&
        payment.status !== PaymentStatus.APPROVED
      ) {
        throw new BadRequestException('Payment cannot be completed');
      }

      const existing = await manager.findOne(CourseEnrollment, {
        where: { studentId: payment.userId, courseId: input.courseId },
      });
      if (existing) {
        return { enrollment: existing, created: false, payment };
      }

      const course = await manager.findOne(Course, {
        where: { id: input.courseId, status: CourseStatus.APPROVED },
        lock: { mode: 'pessimistic_read' },
      });
      if (!course) throw new NotFoundException('Course not found');
      if (Number(payment.amount) !== Number(course.price)) {
        throw new BadRequestException('Course price changed during checkout');
      }
      const soldBy = this.isValidReferral(course, input.referralCode)
        ? 'tutor'
        : 'academy';
      const { platformFee, tutorShare } =
        await this.commissionService.calculateCourseEarnings(
          Number(course.price),
          soldBy,
        );
      const enrollment = await manager.save(
        CourseEnrollment,
        manager.create(CourseEnrollment, {
          studentId: payment.userId,
          courseId: course.id,
          platformFee,
          tutorShare,
          soldBy,
          referralTutorId: soldBy === 'tutor' ? course.tutorId : null,
          tutorShareAvailableAt: new Date(
            Date.now() + 14 * 24 * 60 * 60 * 1000,
          ),
          tutorShareReleasedAt: null,
        }),
      );
      await manager.save(
        CourseFundingAllocation,
        manager.create(CourseFundingAllocation, {
          paymentId: payment.id,
          enrollmentId: enrollment.id,
          amount: Number(course.price),
        }),
      );
      await manager.update(Payment, payment.id, {
        status: PaymentStatus.APPROVED,
        adminNote: 'Approved by stripe-course-checkout',
        stripeCheckoutSessionId: input.stripeSessionId,
        stripePaymentIntentId: input.stripePaymentIntentId ?? null,
        allocatedAmount: Number(course.price),
        creditedAmountUsd: Number(course.price),
      });
      await manager.update(User, payment.userId, { isVerified: true });
      return { enrollment, created: true, payment };
    });

    if (result.created) {
      const purchasedCourse = await this.courseRepository.findOne({
        where: { id: result.enrollment.courseId },
      });
      if (purchasedCourse) {
        await this.notificationRepository.save([
          this.notificationRepository.create({
            userId: result.payment.userId,
            type: 'course_enrolled',
            title: 'Course purchase confirmed',
            body: `${purchasedCourse.title} is now available in your course library.`,
          }),
          this.notificationRepository.create({
            userId: purchasedCourse.tutorId,
            type: 'course_sold',
            title: 'New course enrollment',
            body: `A student purchased ${purchasedCourse.title}.`,
          }),
        ]);
      }
      const user = await this.userRepository.findOne({
        where: { id: result.payment.userId },
      });
      if (user?.email) {
        await this.emailService.sendEmail(
          user.email,
          'دورتك جاهزة | Your MRH Academy course is ready',
          `<div dir="rtl"><p>تم استلام دفعتك وأصبحت دورتك جاهزة الآن.</p><p>يمكنك فتح مكتبة دوراتك والبدء في التعلّم.</p></div>
<hr>
<div dir="ltr"><p>Your payment was received and your course is ready.</p><p>Open your course library to start learning.</p></div>`,
        );
      }
    }
    return result.enrollment;
  }

  private validateReceiptFile(file: Express.Multer.File) {
    if (!RECEIPT_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException('Receipt must be JPEG, PNG, WebP, or PDF');
    }
    const signature = file.buffer.subarray(0, 8);
    const valid =
      (file.mimetype === 'application/pdf' &&
        signature.subarray(0, 4).toString() === '%PDF') ||
      (file.mimetype === 'image/jpeg' &&
        signature.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) ||
      (file.mimetype === 'image/png' &&
        signature.equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
      (file.mimetype === 'image/webp' &&
        signature.subarray(0, 4).toString() === 'RIFF');
    if (!valid)
      throw new BadRequestException('Receipt content does not match its type');
  }

  private assertMatchingPaymentRetry(
    payment: Payment,
    userId: string,
    dto: SubmitPaymentDto,
  ) {
    if (
      payment.userId !== userId ||
      payment.method !== dto.method ||
      payment.currency !== (dto.currency ?? 'USD') ||
      Number(payment.amount) !== Number(dto.amount)
    ) {
      throw new BadRequestException(
        'Payment key is already in use for a different transaction',
      );
    }
  }

  private async existingPaymentResponse(
    payment: Payment,
    userId: string,
    dto: SubmitPaymentDto,
  ) {
    this.assertMatchingPaymentRetry(payment, userId, dto);
    if (payment.status !== PaymentStatus.PENDING) {
      return { payment, checkoutUrl: undefined };
    }
    if (payment.method === PaymentMethod.PAYPAL) {
      let checkoutUrl = await this.payPalService.getApprovalUrl(payment);
      if (!checkoutUrl) {
        const order = await this.payPalService.createOrder(payment);
        payment.paypalOrderId = order.orderId;
        payment.providerStatus = 'CREATED';
        await this.paymentRepository.save(payment);
        checkoutUrl = order.approvalUrl;
      }
      return { payment, checkoutUrl };
    }
    if (payment.method === PaymentMethod.CARD) {
      const session = await this.stripeService.createCheckoutSession(
        userId,
        Number(payment.amount),
        payment.id,
        payment.currency === 'EGP' ? 'EGP' : 'USD',
      );
      payment.stripeCheckoutSessionId = session.id;
      payment.providerStatus = 'OPEN';
      await this.paymentRepository.save(payment);
      return { payment, checkoutUrl: session.url ?? undefined };
    }
    return { payment, checkoutUrl: undefined };
  }

  async submitPayment(
    userId: string,
    dto: SubmitPaymentDto,
    screenshotFile?: Express.Multer.File,
  ) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (dto.idempotencyKey) {
      const existing = await this.paymentRepository.findOne({
        where: { idempotencyKey: dto.idempotencyKey },
      });
      if (existing) {
        return this.existingPaymentResponse(existing, userId, dto);
      }
    }

    const config = await this.paymentMethodConfigRepository.findOne({
      where: { type: dto.method, enabled: true },
    });
    if (!config) {
      throw new BadRequestException(
        `Payment method "${dto.method}" is not available or disabled`,
      );
    }

    const isCardPayment = dto.method === PaymentMethod.CARD;
    if (isCardPayment && !this.stripeService.isConfigured()) {
      throw new BadRequestException('Stripe payments are not configured');
    }
    if (
      dto.method === PaymentMethod.PAYPAL &&
      !this.payPalService.isConfigured()
    ) {
      throw new BadRequestException('PayPal payments are not configured');
    }

    const receiptRequiredMethods: PaymentMethod[] = [
      PaymentMethod.VODAFONE,
      PaymentMethod.INSTAPAY,
      PaymentMethod.BINANCE,
      PaymentMethod.BANK,
    ];
    if (
      receiptRequiredMethods.includes(dto.method) &&
      !config.details?.trim()
    ) {
      throw new BadRequestException(
        `Payment method "${dto.method}" has no transfer destination configured`,
      );
    }
    if (receiptRequiredMethods.includes(dto.method) && !screenshotFile) {
      throw new BadRequestException(
        'A receipt screenshot is required for this payment method',
      );
    }

    let receiptUrl: string | null = null;
    if (screenshotFile) {
      this.validateReceiptFile(screenshotFile);
      receiptUrl = await this.uploadToCloudinary(screenshotFile.buffer);
    }

    const payment = this.paymentRepository.create({
      userId,
      amount: dto.amount,
      method: dto.method,
      currency: dto.currency ?? 'USD',
      status: PaymentStatus.PENDING,
      receiptUrl,
      adminNote: dto.adminNote ?? null,
      idempotencyKey: dto.idempotencyKey ?? null,
    } as unknown as DeepPartial<Payment>);

    let savedPayment: Payment;
    try {
      savedPayment = await this.paymentRepository.save(payment);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error as QueryFailedError & { code?: string }).code === '23505'
      ) {
        const existing = dto.idempotencyKey
          ? await this.paymentRepository.findOne({
              where: { idempotencyKey: dto.idempotencyKey },
            })
          : null;
        if (existing) {
          return this.existingPaymentResponse(existing, userId, dto);
        }
      }
      throw error;
    }

    if (dto.method === PaymentMethod.PAYPAL) {
      try {
        const order = await this.payPalService.createOrder(savedPayment);
        savedPayment.paypalOrderId = order.orderId;
        savedPayment.providerStatus = 'CREATED';
        await this.paymentRepository.save(savedPayment);
        return { payment: savedPayment, checkoutUrl: order.approvalUrl };
      } catch (error) {
        savedPayment.providerStatus = 'INITIATION_FAILED';
        await this.paymentRepository.save(savedPayment);
        this.logger.error('PayPal order creation failed', error);
        throw new BadRequestException(
          'PayPal payment is currently unavailable. Please use another payment method.',
        );
      }
    }

    let checkoutUrl = undefined;
    if (dto.method === PaymentMethod.CARD) {
      try {
        const session = await this.stripeService.createCheckoutSession(
          userId,
          dto.amount,
          savedPayment.id,
          dto.currency ?? 'USD',
        );
        checkoutUrl = session.url;
        savedPayment.stripeCheckoutSessionId = session.id;
        savedPayment.providerStatus = 'OPEN';
        await this.paymentRepository.save(savedPayment);
      } catch (stripeError) {
        savedPayment.providerStatus = 'INITIATION_FAILED';
        await this.paymentRepository.save(savedPayment);
        this.logger.error(
          'Stripe checkout session creation failed',
          stripeError,
        );
        throw new BadRequestException(
          'Card payment is currently unavailable. Please use another payment method.',
        );
      }
    }

    return { payment: savedPayment, checkoutUrl };
  }

  async capturePayPalPayment(paymentId: string, userId: string) {
    const result = await this.dataSource.transaction(async (manager) => {
      // Keep the row locked through provider capture and wallet crediting. A
      // second request then waits and returns the approved row instead of
      // racing PayPal and surfacing an error after a successful charge.
      const payment = await manager.findOne(Payment, {
        where: { id: paymentId, userId, method: PaymentMethod.PAYPAL },
        lock: { mode: 'pessimistic_write' },
      });
      if (!payment) throw new NotFoundException('PayPal payment not found');
      if (payment.status === PaymentStatus.APPROVED) {
        return { payment, balanceToAdd: null };
      }
      if (payment.status !== PaymentStatus.PENDING) {
        throw new BadRequestException('PayPal payment cannot be captured');
      }

      const captureId = await this.payPalService.captureOrder(payment);
      payment.paypalCaptureId = captureId;
      payment.status = PaymentStatus.APPROVED;
      payment.providerStatus = 'COMPLETED';
      payment.adminNote = `Approved by paypal:${captureId}`;
      payment.rejectionReason = null;
      await manager.save(Payment, payment);

      const amountInUsd =
        payment.currency === 'EGP'
          ? payment.amount / (await this.commissionService.getEgpRate())
          : payment.amount;
      const balanceToAdd = Math.round(amountInUsd * 100) / 100;
      payment.creditedAmountUsd = balanceToAdd;
      await manager.save(Payment, payment);
      await manager.increment(
        StudentProfile,
        { userId: payment.userId },
        'balance',
        balanceToAdd,
      );
      return { payment, balanceToAdd };
    });
    if (result.balanceToAdd !== null) {
      await this.notifyPaymentApproved(result.payment, result.balanceToAdd);
    }
    return result.payment;
  }

  async processPayPalWebhookEvent(event: PayPalWebhookEvent) {
    try {
      const result = await this.dataSource.transaction(async (manager) => {
        const existing = await manager.findOne(ProcessedWebhookEvent, {
          where: { eventId: event.id! },
        });
        if (existing) return { duplicate: true, eventType: event.event_type! };

        await manager.save(
          ProcessedWebhookEvent,
          manager.create(ProcessedWebhookEvent, {
            eventId: event.id!,
            eventType: `paypal:${event.event_type!}`,
          }),
        );

        const resource = event.resource!;
        const eventType = event.event_type!;
        if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
          const captureId = this.payPalString(resource, 'id');
          const orderId = this.payPalNestedString(resource, [
            'supplementary_data',
            'related_ids',
            'order_id',
          ]);
          if (!captureId && !orderId) {
            throw new BadRequestException(
              'PayPal capture event has no provider reference',
            );
          }
          const payment = await manager.findOne(Payment, {
            where: [
              ...(captureId ? [{ paypalCaptureId: captureId }] : []),
              ...(orderId ? [{ paypalOrderId: orderId }] : []),
            ],
            lock: { mode: 'pessimistic_write' },
          });
          if (!payment) throw new NotFoundException('PayPal payment not found');
          this.assertPayPalResourceAmount(payment, resource);
          if (payment.status === PaymentStatus.PENDING) {
            const balanceToAdd = await this.walletValueInUsd(payment);
            payment.paypalCaptureId = captureId;
            payment.status = PaymentStatus.APPROVED;
            payment.providerStatus = 'COMPLETED';
            payment.creditedAmountUsd = balanceToAdd;
            payment.adminNote = `Approved by paypal-webhook:${event.id}`;
            await manager.save(Payment, payment);
            await manager.increment(
              StudentProfile,
              { userId: payment.userId },
              'balance',
              balanceToAdd,
            );
            return {
              duplicate: false,
              eventType,
              approved: { payment, balanceToAdd },
            };
          }
          return { duplicate: false, eventType };
        }

        if (
          eventType === 'PAYMENT.CAPTURE.DENIED' ||
          eventType === 'CHECKOUT.ORDER.CANCELLED'
        ) {
          const captureId = this.payPalString(resource, 'id');
          const orderId =
            this.payPalNestedString(resource, [
              'supplementary_data',
              'related_ids',
              'order_id',
            ]) ?? captureId;
          const payment = orderId
            ? await manager.findOne(Payment, {
                where: [
                  { paypalOrderId: orderId },
                  { paypalCaptureId: captureId ?? orderId },
                ],
                lock: { mode: 'pessimistic_write' },
              })
            : null;
          if (payment?.status === PaymentStatus.PENDING) {
            payment.status =
              eventType === 'CHECKOUT.ORDER.CANCELLED'
                ? PaymentStatus.CANCELLED
                : PaymentStatus.FAILED;
            payment.providerStatus = eventType;
            payment.rejectionReason = 'PayPal did not complete the payment';
            await manager.save(Payment, payment);
          }
          return { duplicate: false, eventType };
        }

        if (
          eventType === 'PAYMENT.CAPTURE.REFUNDED' ||
          eventType === 'PAYMENT.CAPTURE.REVERSED'
        ) {
          const captureId = this.payPalNestedString(resource, [
            'supplementary_data',
            'related_ids',
            'capture_id',
          ]);
          const payment = captureId
            ? await manager.findOne(Payment, {
                where: { paypalCaptureId: captureId },
                lock: { mode: 'pessimistic_write' },
              })
            : null;
          if (!payment) throw new NotFoundException('PayPal payment not found');
          const refundDelta = this.payPalAmount(resource);
          const refund = await this.applyProviderRefund(
            manager,
            payment,
            Number(payment.refundedAmount ?? 0) + refundDelta,
            `PayPal ${eventType.toLowerCase()}`,
            event.id,
          );
          return { duplicate: false, eventType, refund };
        }

        if (eventType.startsWith('CUSTOMER.DISPUTE.')) {
          const transactions = Array.isArray(resource.disputed_transactions)
            ? resource.disputed_transactions
            : [];
          const captureId = transactions
            .map((transaction) =>
              this.payPalString(
                transaction as Record<string, unknown>,
                'seller_transaction_id',
              ),
            )
            .find(Boolean);
          const payment = captureId
            ? await manager.findOne(Payment, {
                where: { paypalCaptureId: captureId },
                lock: { mode: 'pessimistic_write' },
              })
            : null;
          if (payment) {
            const outcome = this.payPalNestedString(resource, [
              'dispute_outcome',
              'outcome_code',
            ]);
            const restored =
              eventType === 'CUSTOMER.DISPUTE.RESOLVED' &&
              ['RESOLVED_SELLER_FAVOUR', 'CANCELED_BY_BUYER'].includes(
                outcome ?? '',
              );
            payment.status = restored
              ? Number(payment.refundedAmount ?? 0) > 0
                ? PaymentStatus.PARTIALLY_REFUNDED
                : PaymentStatus.APPROVED
              : PaymentStatus.DISPUTED;
            payment.disputedAt = restored ? null : new Date();
            payment.providerStatus = eventType;
            payment.adminNote = `PayPal dispute event ${event.id}`;
            await manager.save(Payment, payment);
          }
          return { duplicate: false, eventType };
        }

        if (eventType.startsWith('PAYMENT.PAYOUTS-ITEM.')) {
          const itemId = this.payPalString(resource, 'payout_item_id');
          const senderItemId = this.payPalNestedString(resource, [
            'payout_item',
            'sender_item_id',
          ]);
          if (!itemId && !senderItemId) {
            throw new BadRequestException(
              'PayPal payout event has no provider reference',
            );
          }
          const payout = await manager.findOne(Payout, {
            where: [
              ...(itemId ? [{ paypalItemId: itemId }] : []),
              ...(senderItemId ? [{ id: senderItemId }] : []),
            ],
            lock: { mode: 'pessimistic_write' },
          });
          if (!payout) {
            const platformPayout = await manager.findOne(PlatformPayout, {
              where: [
                ...(itemId ? [{ paypalItemId: itemId }] : []),
                ...(senderItemId ? [{ id: senderItemId }] : []),
              ],
              lock: { mode: 'pessimistic_write' },
            });
            if (!platformPayout) {
              throw new NotFoundException('PayPal payout not found');
            }
            platformPayout.paypalItemId = itemId ?? platformPayout.paypalItemId;
            platformPayout.providerStatus =
              this.payPalString(resource, 'transaction_status') ?? eventType;
            const succeeded = eventType === 'PAYMENT.PAYOUTS-ITEM.SUCCEEDED';
            const failed = [
              'PAYMENT.PAYOUTS-ITEM.BLOCKED',
              'PAYMENT.PAYOUTS-ITEM.CANCELED',
              'PAYMENT.PAYOUTS-ITEM.DENIED',
              'PAYMENT.PAYOUTS-ITEM.FAILED',
              'PAYMENT.PAYOUTS-ITEM.REFUNDED',
              'PAYMENT.PAYOUTS-ITEM.RETURNED',
            ].includes(eventType);
            if (succeeded) {
              platformPayout.status = PayoutStatus.SUCCESS;
              platformPayout.processedAt = new Date();
            } else if (failed) {
              platformPayout.status =
                eventType === 'PAYMENT.PAYOUTS-ITEM.REFUNDED'
                  ? PayoutStatus.REFUNDED
                  : eventType === 'PAYMENT.PAYOUTS-ITEM.CANCELED'
                    ? PayoutStatus.CANCELLED
                    : PayoutStatus.FAILED;
              platformPayout.processedAt = new Date();
            }
            await manager.save(PlatformPayout, platformPayout);
            return {
              duplicate: false,
              eventType,
              platformPayout:
                succeeded || failed
                  ? { value: platformPayout, approved: succeeded }
                  : undefined,
            };
          }
          payout.paypalItemId = itemId ?? payout.paypalItemId;
          payout.providerStatus =
            this.payPalString(resource, 'transaction_status') ?? eventType;
          const succeeded = eventType === 'PAYMENT.PAYOUTS-ITEM.SUCCEEDED';
          const failed = [
            'PAYMENT.PAYOUTS-ITEM.BLOCKED',
            'PAYMENT.PAYOUTS-ITEM.CANCELED',
            'PAYMENT.PAYOUTS-ITEM.DENIED',
            'PAYMENT.PAYOUTS-ITEM.FAILED',
            'PAYMENT.PAYOUTS-ITEM.REFUNDED',
            'PAYMENT.PAYOUTS-ITEM.RETURNED',
          ].includes(eventType);
          if (succeeded) {
            payout.status = PayoutStatus.SUCCESS;
            payout.processedAt = new Date();
          } else if (failed) {
            payout.status =
              eventType === 'PAYMENT.PAYOUTS-ITEM.REFUNDED'
                ? PayoutStatus.REFUNDED
                : eventType === 'PAYMENT.PAYOUTS-ITEM.CANCELED'
                  ? PayoutStatus.CANCELLED
                  : PayoutStatus.FAILED;
            payout.processedAt = new Date();
            if (!payout.balanceRestoredAt) {
              await manager.increment(
                TutorProfile,
                { userId: payout.tutorId },
                'balance',
                Number(payout.amount),
              );
              payout.balanceRestoredAt = new Date();
            }
          }
          await manager.save(Payout, payout);
          return {
            duplicate: false,
            eventType,
            payout:
              succeeded || failed
                ? { value: payout, approved: succeeded }
                : undefined,
          };
        }

        return { duplicate: false, eventType };
      });

      if ('approved' in result && result.approved) {
        await this.notifyPaymentApproved(
          result.approved.payment,
          result.approved.balanceToAdd,
        );
      }
      if ('refund' in result && result.refund) {
        await this.notifyPaymentRefunded(result.refund);
      }
      if ('payout' in result && result.payout) {
        await this.notifyPayoutDecision(
          result.payout.value,
          result.payout.approved,
          result.payout.approved
            ? undefined
            : 'PayPal could not deliver the payout',
        );
      }
      if ('platformPayout' in result && result.platformPayout) {
        await this.notifyPlatformPayoutDecision(
          result.platformPayout.value,
          result.platformPayout.approved,
        );
      }
      return { received: true, duplicate: result.duplicate };
    } catch (error) {
      const code =
        (error as { code?: string; driverError?: { code?: string } }).code ??
        (error as { driverError?: { code?: string } }).driverError?.code;
      if (code === '23505') return { received: true, duplicate: true };
      throw error;
    }
  }

  private payPalString(
    value: Record<string, unknown>,
    key: string,
  ): string | null {
    return typeof value[key] === 'string' ? value[key] : null;
  }

  private payPalNestedString(
    value: Record<string, unknown>,
    path: string[],
  ): string | null {
    let current: unknown = value;
    for (const key of path) {
      if (!current || typeof current !== 'object') return null;
      current = (current as Record<string, unknown>)[key];
    }
    return typeof current === 'string' ? current : null;
  }

  private payPalAmount(resource: Record<string, unknown>): number {
    const value = this.payPalNestedString(resource, ['amount', 'value']);
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('PayPal webhook amount is invalid');
    }
    return amount;
  }

  private assertPayPalResourceAmount(
    payment: Payment,
    resource: Record<string, unknown>,
  ) {
    const currency = this.payPalNestedString(resource, [
      'amount',
      'currency_code',
    ]);
    if (
      currency !== payment.currency ||
      this.payPalAmount(resource) !== Number(payment.amount)
    ) {
      throw new BadRequestException('PayPal webhook amount does not match');
    }
  }

  private async walletValueInUsd(payment: Payment): Promise<number> {
    const amountInUsd =
      payment.currency === 'EGP'
        ? Number(payment.amount) / (await this.commissionService.getEgpRate())
        : Number(payment.amount);
    return Math.round(amountInUsd * 100) / 100;
  }

  async getPaymentHistory(userId: string, page = 1, limit = 50) {
    return this.paymentRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async getPayment(id: string) {
    const payment = await this.paymentRepository.findOne({
      where: { id },
      relations: { user: true },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }

  async getAllPayments(page = 1, limit = 50) {
    return this.paymentRepository.find({
      relations: { user: true },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async approvePayment(paymentId: string, adminId: string) {
    return this.dataSource
      .transaction(async (manager) => {
        const payment = await manager.findOne(Payment, {
          where: { id: paymentId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!payment) {
          throw new NotFoundException('Payment not found');
        }

        if (payment.status === PaymentStatus.APPROVED) {
          return { payment, balanceToAdd: 0 };
        }
        if (payment.status !== PaymentStatus.PENDING) {
          throw new BadRequestException('Payment is already processed');
        }

        payment.status = PaymentStatus.APPROVED;
        payment.adminNote = `Approved by ${adminId}`;
        payment.rejectionReason = null;
        await manager.save(Payment, payment);

        // Wallet balances, lesson prices, and course prices are all denominated
        // in USD. A deposit therefore credits its USD value one-for-one.
        // Dividing this value by the default lesson price made a $30 deposit
        // worth only 2 balance units while a $30 course still cost 30 units.
        const amountInUsd =
          payment.currency === 'EGP'
            ? payment.amount / (await this.commissionService.getEgpRate())
            : payment.amount;
        const balanceToAdd = Math.round(amountInUsd * 100) / 100;
        payment.creditedAmountUsd = balanceToAdd;
        await manager.save(Payment, payment);
        await manager.increment(
          StudentProfile,
          { userId: payment.userId },
          'balance',
          balanceToAdd,
        );

        return { payment, balanceToAdd };
      })
      .then(async ({ payment, balanceToAdd }) => {
        if (balanceToAdd > 0) {
          await this.notifyPaymentApproved(payment, balanceToAdd);
        }
        return payment;
      });
  }

  private async notifyPaymentApproved(payment: Payment, balanceToAdd: number) {
    try {
      await this.notificationRepository.save(
        this.notificationRepository.create({
          userId: payment.userId,
          type: 'payment_approved',
          title: 'Payment approved | تمت الموافقة على الدفع',
          body: `$${balanceToAdd.toFixed(2)} was added to your balance. | تمت إضافة $${balanceToAdd.toFixed(2)} إلى رصيدك.`,
        }),
      );
    } catch (error) {
      this.logger.error('Payment approval notification failed', error);
    }
    const user = await this.userRepository.findOne({
      where: { id: payment.userId },
    });
    if (user?.email) {
      this.emailService
        .sendEmail(
          user.email,
          'Payment approved | تمت الموافقة على الدفع — MRH Academy',
          `<div dir="rtl"><p>تمت الموافقة على دفعتك.</p>
<p>المبلغ: $${payment.amount.toFixed(2)}</p>
<p>المبلغ المضاف إلى الرصيد: $${balanceToAdd.toFixed(2)}</p></div>
<hr>
<div dir="ltr"><p>Your payment has been approved.</p>
<p>Amount: $${payment.amount.toFixed(2)}</p>
<p>Balance added: $${balanceToAdd.toFixed(2)}</p></div>`,
        )
        .catch((err) =>
          this.logger.error('Payment approval email failed', err),
        );
    }
  }

  async rejectPayment(paymentId: string, adminId: string, reason?: string) {
    return this.dataSource.transaction(async (manager) => {
      const payment = await manager.findOne(Payment, {
        where: { id: paymentId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!payment) {
        throw new NotFoundException('Payment not found');
      }

      if (payment.status !== PaymentStatus.PENDING) {
        throw new BadRequestException('Payment is already processed');
      }

      payment.status = PaymentStatus.REJECTED;
      payment.adminNote = reason
        ? `Rejected: ${reason}`
        : `Rejected by admin ${adminId}`;
      payment.rejectionReason = reason ?? null;
      await manager.save(Payment, payment);

      return payment;
    });
  }

  async refundStripePayment(
    paymentId: string,
    cumulativeRefundAmount: number,
    stripeChargeId?: string,
  ) {
    const result = await this.dataSource.transaction(async (manager) => {
      const payment = await manager.findOne(Payment, {
        where: { id: paymentId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!payment) throw new NotFoundException('Payment not found');
      return this.applyProviderRefund(
        manager,
        payment,
        cumulativeRefundAmount,
        `Stripe refund${stripeChargeId ? ` (${stripeChargeId})` : ''}`,
        stripeChargeId,
      );
    });
    await this.notifyPaymentRefunded(result);
    return result;
  }

  private async applyProviderRefund(
    manager: EntityManager,
    payment: Payment,
    cumulativeRefundAmount: number,
    auditLabel: string,
    providerReference?: string,
  ) {
    if (
      ![
        PaymentStatus.APPROVED,
        PaymentStatus.PARTIALLY_REFUNDED,
        PaymentStatus.DISPUTED,
        PaymentStatus.REFUNDED,
      ].includes(payment.status)
    ) {
      throw new BadRequestException('Only captured payments can be refunded');
    }

    const refundTotal = Math.min(
      Number(payment.amount),
      Math.max(0, Math.round(cumulativeRefundAmount * 100) / 100),
    );
    const refundDelta =
      Math.round((refundTotal - Number(payment.refundedAmount ?? 0)) * 100) /
      100;
    if (refundDelta <= 0) {
      return {
        payment,
        refundDelta: 0,
        walletRefundDelta: 0,
        revokedCourses: 0,
        cancelledLessons: 0,
        affectedTutorIds: [] as string[],
      };
    }

    const creditedAmountUsd =
      payment.creditedAmountUsd ??
      (payment.currency === 'EGP'
        ? Number(payment.amount) / (await this.commissionService.getEgpRate())
        : Number(payment.amount));
    const walletAt = (providerAmount: number) =>
      Number(payment.amount) > 0
        ? Math.round(
            (providerAmount / Number(payment.amount)) *
              Number(creditedAmountUsd) *
              100,
          ) / 100
        : 0;
    const walletRefundDelta =
      Math.round(
        (walletAt(refundTotal) -
          walletAt(Number(payment.refundedAmount ?? 0))) *
          100,
      ) / 100;
    let amountStillToRelease = walletRefundDelta;
    let revokedCourses = 0;
    let cancelledLessons = 0;
    const affectedTutorIds = new Set<string>();

    const courseAllocations = await manager.find(CourseFundingAllocation, {
      where: { paymentId: payment.id },
      order: { createdAt: 'ASC' },
      lock: { mode: 'pessimistic_write' },
    });
    for (const allocation of courseAllocations) {
      if (amountStillToRelease <= 0) break;
      const enrollment = await manager.findOne(CourseEnrollment, {
        where: { id: allocation.enrollmentId },
        relations: { course: true },
        lock: { mode: 'pessimistic_write' },
      });
      if (!enrollment) continue;
      const enrollmentAllocations = await manager.find(
        CourseFundingAllocation,
        {
          where: { enrollmentId: enrollment.id },
          lock: { mode: 'pessimistic_write' },
        },
      );
      const paidAmount =
        Number(enrollment.platformFee ?? 0) +
        Number(enrollment.tutorShare ?? 0);
      affectedTutorIds.add(enrollment.course.tutorId);
      if (enrollment.tutorShare > 0 && enrollment.tutorShareReleasedAt) {
        await manager.decrement(
          TutorProfile,
          { userId: enrollment.course.tutorId },
          'balance',
          Number(enrollment.tutorShare),
        );
      }
      if (paidAmount > 0) {
        await manager.increment(
          StudentProfile,
          { userId: enrollment.studentId },
          'balance',
          paidAmount,
        );
      }
      await manager.save(
        CourseRefundReversal,
        manager.create(CourseRefundReversal, {
          paymentId: payment.id,
          originalEnrollmentId: enrollment.id,
          studentId: enrollment.studentId,
          courseId: enrollment.courseId,
          tutorId: enrollment.course.tutorId,
          soldBy: enrollment.soldBy,
          paidAmount,
          platformFee: Number(enrollment.platformFee ?? 0),
          tutorShare: Number(enrollment.tutorShare ?? 0),
          stripeChargeId: providerReference ?? null,
        }),
      );
      for (const linked of enrollmentAllocations) {
        await manager.decrement(
          Payment,
          { id: linked.paymentId },
          'allocatedAmount',
          Number(linked.amount),
        );
      }
      await manager.delete(CourseLessonCompletion, {
        enrollmentId: enrollment.id,
      });
      await manager.delete(CourseFundingAllocation, {
        enrollmentId: enrollment.id,
      });
      await manager.delete(CourseEnrollment, { id: enrollment.id });
      amountStillToRelease =
        Math.round((amountStillToRelease - Number(allocation.amount)) * 100) /
        100;
      revokedCourses += 1;
    }

    const lessonAllocations = await manager.find(LessonFundingAllocation, {
      where: { paymentId: payment.id },
      order: { createdAt: 'ASC' },
      lock: { mode: 'pessimistic_write' },
    });
    for (const allocation of lessonAllocations) {
      if (amountStillToRelease <= 0) break;
      const lesson = await manager.findOne(Lesson, {
        where: { id: allocation.lessonId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!lesson || lesson.paymentStatus === LessonPaymentStatus.REFUNDED) {
        continue;
      }
      affectedTutorIds.add(lesson.tutorId);
      const linkedAllocations = await manager.find(LessonFundingAllocation, {
        where: { lessonId: lesson.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (lesson.tutorShareReleasedAt && Number(lesson.tutorShare ?? 0) > 0) {
        await manager.decrement(
          TutorProfile,
          { userId: lesson.tutorId },
          'balance',
          Number(lesson.tutorShare),
        );
      }
      await manager.increment(
        StudentProfile,
        { userId: lesson.studentId },
        'balance',
        Number(lesson.price),
      );
      lesson.status = LessonStatus.CANCELLED;
      lesson.paymentStatus = LessonPaymentStatus.REFUNDED;
      await manager.save(Lesson, lesson);
      await manager.update(
        Classroom,
        { lessonId: lesson.id },
        { isActive: false },
      );
      for (const linked of linkedAllocations) {
        await manager.decrement(
          Payment,
          { id: linked.paymentId },
          'allocatedAmount',
          Number(linked.amount),
        );
      }
      await manager.delete(LessonFundingAllocation, { lessonId: lesson.id });
      amountStillToRelease =
        Math.round((amountStillToRelease - Number(allocation.amount)) * 100) /
        100;
      cancelledLessons += 1;
    }

    await manager.decrement(
      StudentProfile,
      { userId: payment.userId },
      'balance',
      walletRefundDelta,
    );
    payment.refundedAmount = refundTotal;
    payment.refundedAt =
      refundTotal >= Number(payment.amount) ? new Date() : null;
    payment.status =
      refundTotal >= Number(payment.amount)
        ? PaymentStatus.REFUNDED
        : PaymentStatus.PARTIALLY_REFUNDED;
    payment.providerStatus = payment.status;
    payment.adminNote = `${auditLabel} ${refundTotal.toFixed(2)}`;
    await manager.update(
      Payment,
      { id: payment.id },
      {
        refundedAmount: payment.refundedAmount,
        refundedAt: payment.refundedAt,
        status: payment.status,
        providerStatus: payment.providerStatus,
        adminNote: payment.adminNote,
      },
    );

    return {
      payment,
      refundDelta,
      walletRefundDelta,
      revokedCourses,
      cancelledLessons,
      affectedTutorIds: [...affectedTutorIds],
    };
  }

  private async notifyPaymentRefunded(result: {
    payment: Payment;
    refundDelta: number;
    walletRefundDelta: number;
    revokedCourses: number;
    cancelledLessons: number;
    affectedTutorIds: string[];
  }) {
    if (result.refundDelta <= 0) return;
    await this.notificationRepository.save(
      this.notificationRepository.create({
        userId: result.payment.userId,
        type: 'payment_refunded',
        title: 'Payment refunded',
        body: `${result.payment.currency} ${result.refundDelta.toFixed(2)} was refunded (${result.walletRefundDelta.toFixed(2)} USD wallet value). ${result.revokedCourses} course enrollment(s) and ${result.cancelledLessons} lesson booking(s) were adjusted.`,
      }),
    );
    if (result.affectedTutorIds.length > 0) {
      await this.notificationRepository.save(
        result.affectedTutorIds.map((userId) =>
          this.notificationRepository.create({
            userId,
            type: 'sale_refunded',
            title: 'Student payment refunded',
            body: 'A related purchase was reversed and your earnings were adjusted where applicable.',
          }),
        ),
      );
    }
  }

  async requestPayout(tutorId: string, dto: RequestPayoutDto) {
    await this.releaseMatureCourseEarnings(tutorId);
    let resumablePayout: Payout | null = null;
    if (dto.idempotencyKey) {
      const existing = await this.payoutRepository.findOne({
        where: { idempotencyKey: dto.idempotencyKey },
      });
      if (existing) {
        if (
          existing.tutorId !== tutorId ||
          Number(existing.amount) !== Number(dto.amount) ||
          existing.method !== dto.method
        ) {
          throw new BadRequestException(
            'Payout key is already in use for another request',
          );
        }
        if (
          existing.method !== 'paypal' ||
          existing.status !== PayoutStatus.PENDING
        ) {
          return existing;
        }
        // A crash can occur after reserving the balance but before PayPal
        // acknowledges the batch. Resume with the same provider request ID.
        resumablePayout = existing;
      }
    }
    if (dto.method === 'paypal' && !this.payPalService.isWebhookConfigured()) {
      throw new BadRequestException(
        'PayPal payouts require configured API credentials and webhook verification',
      );
    }
    const receiver =
      dto.method === 'paypal' ? dto.paypalEmail?.trim() : dto.accountDetails;
    if (!receiver) {
      throw new BadRequestException('Payout account details are required');
    }

    const payout =
      resumablePayout ??
      (await this.dataSource.transaction(async (manager) => {
        const tutorProfile = await manager.findOne(TutorProfile, {
          where: { userId: tutorId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!tutorProfile)
          throw new NotFoundException('Tutor profile not found');

        // The tutor row lock serializes payout requests for the same account.
        // Check for an existing pending request only after acquiring it so two
        // concurrent requests cannot both reserve the same available balance.
        const existingPending = await manager.findOne(Payout, {
          where: {
            tutorId,
            status: In([PayoutStatus.PENDING, PayoutStatus.PROCESSING]),
          },
        });
        if (existingPending) {
          throw new BadRequestException(
            'You already have a pending payout request. Please wait for it to be processed.',
          );
        }

        if (tutorProfile.balance < dto.amount) {
          throw new BadRequestException(
            `Insufficient balance. Available: $${tutorProfile.balance.toFixed(2)}`,
          );
        }
        await manager.decrement(
          TutorProfile,
          { userId: tutorId },
          'balance',
          dto.amount,
        );
        const created = manager.create(Payout, {
          tutorId,
          amount: dto.amount,
          method: dto.method,
          accountDetails: receiver,
          idempotencyKey: dto.idempotencyKey ?? null,
          status: PayoutStatus.PENDING,
        });
        return manager.save(Payout, created);
      }));

    if (dto.method !== 'paypal') {
      await this.notifyPayoutSubmitted(payout);
      return payout;
    }

    try {
      const provider = await this.payPalService.createPayout(payout, receiver);
      const processing = await this.dataSource.transaction(async (manager) => {
        const locked = await manager.findOne(Payout, {
          where: { id: payout.id },
          lock: { mode: 'pessimistic_write' },
        });
        if (!locked) throw new NotFoundException('Payout not found');
        locked.paypalBatchId = provider.batchId;
        locked.paypalItemId = provider.itemId;
        locked.providerStatus = provider.status;
        locked.status = PayoutStatus.PROCESSING;
        return manager.save(Payout, locked);
      });
      await this.notifyPayoutSubmitted(processing);
      return processing;
    } catch (error) {
      const failed = await this.dataSource.transaction(async (manager) => {
        const locked = await manager.findOne(Payout, {
          where: { id: payout.id },
          lock: { mode: 'pessimistic_write' },
        });
        if (!locked) throw new NotFoundException('Payout not found');
        if (!locked.balanceRestoredAt) {
          await manager.increment(
            TutorProfile,
            { userId: tutorId },
            'balance',
            Number(locked.amount),
          );
          locked.balanceRestoredAt = new Date();
        }
        locked.status = PayoutStatus.FAILED;
        locked.processedAt = new Date();
        locked.errorMessage =
          error instanceof Error ? error.message : 'PayPal payout failed';
        return manager.save(Payout, locked);
      });
      await this.notifyPayoutDecision(
        failed,
        false,
        'PayPal could not initiate the payout',
      );
      throw new BadRequestException('PayPal payout could not be initiated');
    }
  }

  async requestPlatformPayout(adminId: string, dto: RequestPlatformPayoutDto) {
    if (!this.payPalService.isWebhookConfigured()) {
      throw new BadRequestException(
        'PayPal payouts require configured API credentials and webhook verification',
      );
    }
    const repository = this.dataSource.getRepository(PlatformPayout);
    const existing = await repository.findOne({
      where: { idempotencyKey: dto.idempotencyKey },
    });
    if (existing) {
      if (
        existing.requestedBy !== adminId ||
        Number(existing.amount) !== Number(dto.amount) ||
        existing.receiverEmail !== dto.paypalEmail.trim()
      ) {
        throw new BadRequestException(
          'Payout key is already in use for another request',
        );
      }
      if (existing.status !== PayoutStatus.PENDING) return existing;
    }

    const payout =
      existing ??
      (await this.dataSource.transaction(async (manager) => {
        await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
          'mrh-platform-payout',
        ]);
        const keyed = await manager.findOne(PlatformPayout, {
          where: { idempotencyKey: dto.idempotencyKey },
        });
        if (keyed) return keyed;
        const [ledger] = (await manager.query(`
        SELECT
          COALESCE((
            SELECT SUM("platform_fee")
            FROM "lessons"
            WHERE "status" = 'completed'
          ), 0)
          + COALESCE((
            SELECT SUM("platform_fee")
            FROM "course_enrollments"
          ), 0)
          - COALESCE((
            SELECT SUM("amount")
            FROM "platform_payouts"
            WHERE "status" IN ('pending', 'processing', 'success')
          ), 0) AS "available"
        `)) as Array<{ available: string | number }>;
        const available = Number(ledger?.available ?? 0);
        if (dto.amount > available) {
          throw new BadRequestException(
            `Insufficient platform commission balance. Available: $${available.toFixed(2)}`,
          );
        }
        return manager.save(
          PlatformPayout,
          manager.create(PlatformPayout, {
            requestedBy: adminId,
            amount: dto.amount,
            receiverEmail: dto.paypalEmail.trim(),
            idempotencyKey: dto.idempotencyKey,
            status: PayoutStatus.PENDING,
          }),
        );
      }));
    if (payout.status !== PayoutStatus.PENDING) return payout;

    try {
      const provider = await this.payPalService.createPayout(
        payout,
        payout.receiverEmail,
      );
      const processing = await this.dataSource.transaction(async (manager) => {
        const locked = await manager.findOne(PlatformPayout, {
          where: { id: payout.id },
          lock: { mode: 'pessimistic_write' },
        });
        if (!locked) throw new NotFoundException('Platform payout not found');
        if (locked.status !== PayoutStatus.PENDING) return locked;
        locked.paypalBatchId = provider.batchId;
        locked.paypalItemId = provider.itemId;
        locked.providerStatus = provider.status;
        locked.status = PayoutStatus.PROCESSING;
        return manager.save(PlatformPayout, locked);
      });
      await this.notifyPlatformPayoutDecision(processing);
      return processing;
    } catch (error) {
      const failed = await this.dataSource.transaction(async (manager) => {
        const locked = await manager.findOne(PlatformPayout, {
          where: { id: payout.id },
          lock: { mode: 'pessimistic_write' },
        });
        if (!locked) throw new NotFoundException('Platform payout not found');
        if (locked.status === PayoutStatus.PENDING) {
          locked.status = PayoutStatus.FAILED;
          locked.processedAt = new Date();
          locked.errorMessage =
            error instanceof Error ? error.message : 'PayPal payout failed';
          await manager.save(PlatformPayout, locked);
        }
        return locked;
      });
      await this.notifyPlatformPayoutDecision(failed, false);
      throw new BadRequestException('PayPal payout could not be initiated');
    }
  }

  async getPlatformPayouts(page = 1, limit = 50) {
    const repository = this.dataSource.getRepository(PlatformPayout);
    const [items, total] = await repository.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    const rows = await this.dataSource.query(`
      SELECT
        COALESCE((SELECT SUM("platform_fee") FROM "lessons" WHERE "status" = 'completed'), 0)
        + COALESCE((SELECT SUM("platform_fee") FROM "course_enrollments"), 0)
        - COALESCE((
          SELECT SUM("amount") FROM "platform_payouts"
          WHERE "status" IN ('pending', 'processing', 'success')
        ), 0) AS "available"
    `);
    return {
      items,
      total,
      page,
      limit,
      availableBalance: Number(rows[0]?.available ?? 0),
    };
  }

  private async notifyPlatformPayoutDecision(
    payout: PlatformPayout,
    approved?: boolean,
  ) {
    const state =
      approved === undefined
        ? 'processing'
        : approved
          ? 'completed'
          : payout.status;
    await this.notificationRepository.save(
      this.notificationRepository.create({
        userId: payout.requestedBy,
        type: 'platform_payout_update',
        title: 'Platform payout updated',
        body: `The $${Number(payout.amount).toFixed(2)} PayPal platform payout is ${state}.`,
      }),
    );
  }

  private async notifyPayoutSubmitted(payout: Payout) {
    await this.notificationRepository.save(
      this.notificationRepository.create({
        userId: payout.tutorId,
        type: 'payout_processing',
        title: 'Payout request received',
        body: `Your $${Number(payout.amount).toFixed(2)} ${payout.method} payout is ${payout.status}.`,
      }),
    );
  }

  async getTutorPayouts(tutorId: string, page = 1, limit = 50) {
    const payouts = await this.payoutRepository.find({
      where: { tutorId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return payouts.map((p) => ({
      ...p,
      status: p.status,
    }));
  }

  async getTutorTransactions(tutorId: string, page = 1, limit = 50) {
    await this.releaseMatureCourseEarnings(tutorId);
    const sourceLimit = Math.min(page * limit, 1_000);
    const [lessons, courseSales, payouts] = await Promise.all([
      this.lessonRepository.find({
        where: { tutorId, status: LessonStatus.COMPLETED },
        relations: { student: true },
        order: { updatedAt: 'DESC' },
        take: sourceLimit,
      }),
      this.dataSource
        .getRepository(CourseEnrollment)
        .createQueryBuilder('enrollment')
        .innerJoinAndSelect('enrollment.course', 'course')
        .leftJoinAndSelect('enrollment.student', 'student')
        .where('course.tutorId = :tutorId', { tutorId })
        .orderBy('enrollment.createdAt', 'DESC')
        .take(sourceLimit)
        .getMany(),
      this.payoutRepository.find({
        where: { tutorId },
        order: { createdAt: 'DESC' },
        take: sourceLimit,
      }),
    ]);

    const transactions = [
      ...lessons.map((lesson) => ({
        id: `lesson:${lesson.id}`,
        type: 'lesson_earning',
        amount: Math.max(
          0,
          Number(lesson.price) - Number(lesson.platformFee ?? 0),
        ),
        status: 'completed',
        description:
          `Lesson with ${lesson.student?.firstName ?? 'student'} ${lesson.student?.lastName ?? ''}`.trim(),
        createdAt: lesson.updatedAt,
      })),
      ...courseSales.map((enrollment) => ({
        id: `course:${enrollment.id}`,
        type: 'course_earning',
        amount: Number(enrollment.tutorShare ?? 0),
        status: enrollment.tutorShareReleasedAt ? 'completed' : 'pending',
        description: `Course sale: ${enrollment.course?.title ?? 'Course'}`,
        createdAt: enrollment.createdAt,
      })),
      ...payouts.map((payout) => ({
        id: `payout:${payout.id}`,
        type: 'payout',
        amount: -Number(payout.amount),
        status: payout.status,
        description: `Payout via ${payout.method}`,
        createdAt: payout.createdAt,
      })),
    ];

    return transactions
      .filter((transaction) => transaction.amount !== 0)
      .sort(
        (left, right) =>
          new Date(right.createdAt).getTime() -
          new Date(left.createdAt).getTime(),
      )
      .slice((page - 1) * limit, page * limit);
  }

  @Cron(CronExpression.EVERY_HOUR)
  async releaseMatureCourseEarnings(tutorId?: string) {
    await this.dataSource.transaction((manager) =>
      manager.query(
        `
          WITH matured AS (
            UPDATE course_enrollments AS enrollment
            SET tutor_share_released_at = NOW()
            FROM courses AS course
            WHERE course.id = enrollment.course_id
              AND enrollment.tutor_share_released_at IS NULL
              AND enrollment.tutor_share_available_at <= NOW()
              AND enrollment.tutor_share > 0
              AND ($1::uuid IS NULL OR course.tutor_id = $1::uuid)
            RETURNING course.tutor_id AS tutor_id, enrollment.tutor_share
          ),
          totals AS (
            SELECT tutor_id, SUM(tutor_share) AS amount
            FROM matured
            GROUP BY tutor_id
          )
          UPDATE tutor_profiles AS profile
          SET balance = profile.balance + totals.amount,
              updated_at = NOW()
          FROM totals
          WHERE profile.user_id = totals.tutor_id
        `,
        [tutorId ?? null],
      ),
    );
  }

  /**
   * Guest checkout creates a placeholder student so Stripe can carry a stable
   * user id in its metadata. If the checkout is abandoned, that placeholder
   * must not live forever or block the email from being registered later.
   *
   * Only accounts that still have no password, are unverified, have no
   * enrollment, and have no other payment are eligible for removal.
   */
  @Cron(CronExpression.EVERY_6_HOURS)
  async cleanupAbandonedGuestCheckouts() {
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const stalePayments = await this.paymentRepository.find({
      where: {
        status: PaymentStatus.PENDING,
        createdAt: LessThan(cutoff),
      },
      select: {
        id: true,
        userId: true,
        createdAt: true,
        status: true,
      },
      take: 500,
    });

    let removed = 0;
    for (const stalePayment of stalePayments) {
      const deleted = await this.dataSource.transaction(async (manager) => {
        const payment = await manager.findOne(Payment, {
          where: { id: stalePayment.id },
          lock: { mode: 'pessimistic_write' },
        });
        if (
          !payment ||
          payment.status !== PaymentStatus.PENDING ||
          payment.createdAt >= cutoff
        ) {
          return false;
        }

        const user = await manager
          .createQueryBuilder(User, 'user')
          .addSelect('user.passwordHash')
          .where('user.id = :userId', { userId: payment.userId })
          .getOne();
        if (
          !user ||
          user.role !== UserRole.STUDENT ||
          user.isVerified ||
          user.passwordHash
        ) {
          return false;
        }

        const [paymentCount, enrollmentCount] = await Promise.all([
          manager.count(Payment, { where: { userId: user.id } }),
          manager.count(CourseEnrollment, {
            where: { studentId: user.id },
          }),
        ]);
        if (paymentCount !== 1 || enrollmentCount !== 0) {
          return false;
        }

        await manager.delete(Payment, { id: payment.id });
        await manager.delete(StudentProfile, { userId: user.id });
        await manager.delete(User, { id: user.id });
        return true;
      });
      if (deleted) removed += 1;
    }

    if (removed > 0) {
      this.logger.log(`Removed ${removed} abandoned guest checkout account(s)`);
    }
    return { removed };
  }

  /** Admin: all payout requests with tutor user info */
  async getAllPayouts(page = 1, limit = 50) {
    const payouts = await this.payoutRepository.find({
      relations: { tutor: { user: true } },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return payouts.map((p) => ({
      id: p.id,
      tutorId: p.tutorId,
      tutorName: p.tutor?.user
        ? `${p.tutor.user.firstName} ${p.tutor.user.lastName}`
        : p.tutorId,
      amount: Number(p.amount),
      method: p.method,
      accountDetails: p.accountDetails,
      status: p.status,
      adminNote: p.adminNote,
      errorMessage: p.errorMessage,
      createdAt: p.createdAt,
    }));
  }

  async approvePayout(payoutId: string, adminId: string) {
    const result = await this.dataSource.transaction(async (manager) => {
      const payout = await manager.findOne(Payout, {
        where: { id: payoutId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!payout) throw new NotFoundException('Payout not found');
      if (payout.status === PayoutStatus.SUCCESS) {
        return { payout, changed: false };
      }
      if (payout.method === 'paypal') {
        throw new BadRequestException(
          'PayPal payouts are finalized by verified provider webhooks',
        );
      }
      if (payout.status !== PayoutStatus.PENDING) {
        throw new BadRequestException('Payout is already processed');
      }
      payout.status = PayoutStatus.SUCCESS;
      payout.adminNote = `Approved by admin ${adminId}`;
      payout.processedAt = new Date();
      return { payout: await manager.save(Payout, payout), changed: true };
    });
    if (result.changed) await this.notifyPayoutDecision(result.payout, true);
    return result.payout;
  }

  async rejectPayout(payoutId: string, adminId: string, reason: string) {
    const result = await this.dataSource.transaction(async (manager) => {
      const payout = await manager.findOne(Payout, {
        where: { id: payoutId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!payout) throw new NotFoundException('Payout not found');
      if (payout.status === PayoutStatus.FAILED) {
        return { payout, changed: false };
      }
      if (payout.method === 'paypal') {
        throw new BadRequestException(
          'PayPal payouts are finalized by verified provider webhooks',
        );
      }
      if (payout.status !== PayoutStatus.PENDING) {
        throw new BadRequestException('Payout already processed');
      }
      if (!payout.balanceRestoredAt) {
        await manager.increment(
          TutorProfile,
          { userId: payout.tutorId },
          'balance',
          payout.amount,
        );
        payout.balanceRestoredAt = new Date();
      }
      payout.status = PayoutStatus.FAILED;
      payout.adminNote = reason;
      payout.processedAt = new Date();
      return { payout: await manager.save(Payout, payout), changed: true };
    });
    if (result.changed) {
      await this.notifyPayoutDecision(result.payout, false, reason);
    }
    return result.payout;
  }

  private async notifyPayoutDecision(
    payout: Payout,
    approved: boolean,
    reason?: string,
  ) {
    const titleEn = approved ? 'Payout approved' : 'Payout rejected';
    const titleAr = approved ? 'تمت الموافقة على السحب' : 'تم رفض السحب';
    const bodyEn = approved
      ? `Your $${Number(payout.amount).toFixed(2)} payout was approved.`
      : `Your payout was rejected${reason ? `: ${reason}` : '.'}`;
    const bodyAr = approved
      ? `تمت الموافقة على طلب السحب بقيمة $${Number(payout.amount).toFixed(2)}.`
      : `تم رفض طلب السحب${reason ? `: ${reason}` : '.'}`;
    await this.notificationRepository.save(
      this.notificationRepository.create({
        userId: payout.tutorId,
        type: approved ? 'payout_approved' : 'payout_rejected',
        title: `${titleAr} | ${titleEn}`,
        body: `${bodyAr} | ${bodyEn}`,
      }),
    );
    const tutor = await this.userRepository.findOne({
      where: { id: payout.tutorId },
      select: { id: true, email: true },
    });
    if (tutor?.email) {
      await this.emailService.sendEmail(
        tutor.email,
        `${titleAr} | ${titleEn} — MRH Academy`,
        `<div dir="rtl"><p>${bodyAr}</p></div><hr><div dir="ltr"><p>${bodyEn}</p></div>`,
      );
    }
  }

  private uploadToCloudinary(buffer: Buffer): Promise<string> {
    return this.storage
      .upload(buffer, {
        folder: 'mrh-academy/payments',
        resourceType: 'auto',
      })
      .then((result) => result.secureUrl);
  }
}
