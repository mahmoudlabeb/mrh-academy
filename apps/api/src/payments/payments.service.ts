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
  QueryFailedError,
  Repository,
  type DeepPartial,
} from 'typeorm';
import { PaymentMethod, PaymentStatus } from '@mrh/types';
import { Payment } from './entities/payment.entity.js';
import { Payout } from './entities/payout.entity.js';
import { PayoutStatus } from '@mrh/types';
import { StudentProfile } from '../students/entities/student-profile.entity.js';
import { TutorProfile } from '../tutors/entities/tutor-profile.entity.js';
import { User } from '../users/entities/user.entity.js';
import { PaymentMethodConfig } from './entities/payment-method-config.entity.js';
import { SubmitPaymentDto } from './dto/submit-payment.dto.js';
import { RequestPayoutDto } from './dto/request-payout.dto.js';
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
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  async createCourseCheckout(dto: CreateCourseCheckoutDto) {
    if (!this.stripeService.isConfigured()) {
      throw new BadRequestException('Stripe payments are not configured');
    }
    const course = await this.courseRepository.findOne({
      where: { id: dto.courseId, status: CourseStatus.APPROVED },
    });
    if (!course) throw new NotFoundException('Course not found');

    const email = dto.email.trim().toLowerCase();
    let createdUser = false;
    let user = await this.userRepository.findOne({ where: { email } });
    if (user && user.role !== UserRole.STUDENT) {
      throw new BadRequestException(
        'Course checkout requires a student account',
      );
    }

    if (!user) {
      user = await this.dataSource.transaction(async (manager) => {
        const saved = await manager.save(
          User,
          manager.create(User, {
            email,
            firstName: dto.firstName.trim(),
            lastName: dto.lastName.trim(),
            role: UserRole.STUDENT,
            passwordHash: null,
            isVerified: false,
          }),
        );
        await manager.save(
          StudentProfile,
          manager.create(StudentProfile, { userId: saved.id, balance: 0 }),
        );
        return saved;
      });
      createdUser = true;
    }

    const enrolled = await this.dataSource
      .getRepository(CourseEnrollment)
      .findOne({
        where: { studentId: user.id, courseId: course.id },
      });
    if (enrolled)
      throw new BadRequestException('Already enrolled in this course');

    const payment = await this.paymentRepository.save(
      this.paymentRepository.create({
        userId: user.id,
        amount: Number(course.price),
        method: PaymentMethod.CARD,
        currency: 'USD',
        status: PaymentStatus.PENDING,
        adminNote: `Direct course checkout: ${course.id}`,
      }),
    );

    try {
      const session = await this.stripeService.createCourseCheckoutSession({
        userId: user.id,
        paymentId: payment.id,
        courseId: course.id,
        courseTitle: course.title,
        amount: Number(course.price),
        email,
        referralCode: dto.referralCode,
      });
      await this.paymentRepository.update(payment.id, {
        stripeCheckoutSessionId: session.id,
      });
      return { checkoutUrl: session.url };
    } catch (error) {
      await this.paymentRepository.delete(payment.id);
      if (createdUser) {
        await this.dataSource.transaction(async (manager) => {
          await manager.delete(StudentProfile, { userId: user.id });
          await manager.delete(User, { id: user.id });
        });
      }
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
    const payment = await this.paymentRepository.findOne({
      where: { id: input.paymentId },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    await this.paymentRepository.update(payment.id, {
      stripeCheckoutSessionId: input.stripeSessionId,
      stripePaymentIntentId: input.stripePaymentIntentId ?? null,
    });
    if (payment.status === PaymentStatus.PENDING) {
      await this.approvePayment(payment.id, 'stripe-course-checkout');
    } else if (payment.status !== PaymentStatus.APPROVED) {
      throw new BadRequestException('Payment cannot be completed');
    }

    const result = await this.dataSource.transaction(async (manager) => {
      const existing = await manager.findOne(CourseEnrollment, {
        where: { studentId: payment.userId, courseId: input.courseId },
      });
      if (existing) return { enrollment: existing, created: false };

      const course = await manager.findOne(Course, {
        where: { id: input.courseId, status: CourseStatus.APPROVED },
        lock: { mode: 'pessimistic_read' },
      });
      if (!course) throw new NotFoundException('Course not found');
      if (Number(payment.amount) !== Number(course.price)) {
        throw new BadRequestException('Course price changed during checkout');
      }
      const student = await manager.findOne(StudentProfile, {
        where: { userId: payment.userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!student || Number(student.balance) < Number(course.price)) {
        throw new BadRequestException('Course payment balance is unavailable');
      }

      const soldBy = this.isValidReferral(course, input.referralCode)
        ? 'tutor'
        : 'academy';
      const { platformFee, tutorShare } =
        await this.commissionService.calculateCourseEarnings(
          Number(course.price),
          soldBy,
        );
      await manager.decrement(
        StudentProfile,
        { userId: payment.userId },
        'balance',
        Number(course.price),
      );
      await manager.increment(
        TutorProfile,
        { userId: course.tutorId },
        'balance',
        tutorShare,
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
        allocatedAmount: Number(course.price),
      });
      await manager.update(User, payment.userId, { isVerified: true });
      return { enrollment, created: true };
    });

    if (result.created) {
      const user = await this.userRepository.findOne({
        where: { id: payment.userId },
      });
      if (user?.email) {
        await this.emailService.sendEmail(
          user.email,
          'Your MRH Academy course is ready',
          '<p>Your payment was received and your course is ready.</p><p>If this is a new account, use “Forgot password” to create your password before signing in.</p>',
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
        throw new BadRequestException(
          'This payment has already been submitted',
        );
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
        throw new BadRequestException(
          'This payment has already been submitted',
        );
      }
      throw error;
    }

    if (dto.method === PaymentMethod.PAYPAL) {
      try {
        const order = await this.payPalService.createOrder(savedPayment);
        savedPayment.paypalOrderId = order.orderId;
        await this.paymentRepository.save(savedPayment);
        return { payment: savedPayment, checkoutUrl: order.approvalUrl };
      } catch (error) {
        await this.paymentRepository.delete(savedPayment.id);
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
        );
        checkoutUrl = session.url;
      } catch (stripeError) {
        // Roll back the saved payment record and surface a clean error
        await this.paymentRepository.delete(savedPayment.id);
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
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId, userId, method: PaymentMethod.PAYPAL },
    });
    if (!payment) throw new NotFoundException('PayPal payment not found');
    if (payment.status === PaymentStatus.APPROVED) return payment;
    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException('PayPal payment cannot be captured');
    }

    const captureId = await this.payPalService.captureOrder(payment);
    await this.paymentRepository.update(payment.id, {
      paypalCaptureId: captureId,
    });
    return this.approvePayment(payment.id, `paypal:${captureId}`);
  }

  async getPaymentHistory(userId: string) {
    return this.paymentRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
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

  async getAllPayments() {
    return this.paymentRepository.find({
      relations: { user: true },
      order: { createdAt: 'DESC' },
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
        const egpRate = await this.commissionService.getEgpRate();
        const amountInUsd =
          payment.currency === 'EGP'
            ? payment.amount / egpRate
            : payment.amount;
        const balanceToAdd = Math.round(amountInUsd * 100) / 100;
        await manager.increment(
          StudentProfile,
          { userId: payment.userId },
          'balance',
          balanceToAdd,
        );

        return { payment, balanceToAdd };
      })
      .then(async ({ payment, balanceToAdd }) => {
        try {
          await this.notificationRepository.save(
            this.notificationRepository.create({
              userId: payment.userId,
              type: 'payment_approved',
              title: 'Payment approved',
              body: `Your payment was approved and $${balanceToAdd.toFixed(2)} was added to your balance.`,
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
              'Payment Approved — MRH Academy',
              `<p>Your payment has been approved.</p>
<p>Amount: $${payment.amount.toFixed(2)}</p>
<p>Method: ${payment.method}</p>
<p>Balance Added: $${balanceToAdd.toFixed(2)}</p>`,
            )
            .catch((err) =>
              this.logger.error('Payment approval email failed', err),
            );
        }
        return payment;
      });
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
      if (payment.status !== PaymentStatus.APPROVED) {
        throw new BadRequestException('Only approved payments can be refunded');
      }

      const refundTotal = Math.min(
        Number(payment.amount),
        Math.max(0, Math.round(cumulativeRefundAmount * 100) / 100),
      );
      const refundDelta =
        Math.round((refundTotal - Number(payment.refundedAmount ?? 0)) * 100) /
        100;
      if (refundDelta <= 0) {
        return { payment, refundDelta: 0, revokedCourses: 0 };
      }

      const allocations = await manager.find(CourseFundingAllocation, {
        where: { paymentId },
        order: { createdAt: 'ASC' },
        lock: { mode: 'pessimistic_write' },
      });
      let amountStillToRelease = refundDelta;
      let revokedCourses = 0;

      for (const allocation of allocations) {
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

        if (enrollment.tutorShare > 0) {
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
            paymentId,
            originalEnrollmentId: enrollment.id,
            studentId: enrollment.studentId,
            courseId: enrollment.courseId,
            tutorId: enrollment.course.tutorId,
            soldBy: enrollment.soldBy,
            paidAmount,
            platformFee: Number(enrollment.platformFee ?? 0),
            tutorShare: Number(enrollment.tutorShare ?? 0),
            stripeChargeId: stripeChargeId ?? null,
          }),
        );

        for (const linkedAllocation of enrollmentAllocations) {
          await manager.decrement(
            Payment,
            { id: linkedAllocation.paymentId },
            'allocatedAmount',
            Number(linkedAllocation.amount),
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

      // Remove the refunded deposit after restoring the value of every
      // revoked course. Any portion spent elsewhere becomes student debt
      // rather than silently charging an unrelated tutor.
      await manager.decrement(
        StudentProfile,
        { userId: payment.userId },
        'balance',
        refundDelta,
      );
      await manager.update(
        Payment,
        { id: payment.id },
        {
          refundedAmount: refundTotal,
          refundedAt: refundTotal >= Number(payment.amount) ? new Date() : null,
          adminNote: `Stripe refund ${refundTotal.toFixed(2)}${stripeChargeId ? ` (${stripeChargeId})` : ''}`,
        },
      );

      return { payment, refundDelta, revokedCourses };
    });

    if (result.refundDelta > 0) {
      await this.notificationRepository.save(
        this.notificationRepository.create({
          userId: result.payment.userId,
          type: 'payment_refunded',
          title: 'Payment refunded',
          body: `$${result.refundDelta.toFixed(2)} was refunded. Access to ${result.revokedCourses} affected course(s) was revoked.`,
        }),
      );
    }
    return result;
  }

  async requestPayout(tutorId: string, dto: RequestPayoutDto) {
    const existingPending = await this.payoutRepository.findOne({
      where: { tutorId, status: PayoutStatus.PENDING },
    });
    if (existingPending) {
      throw new BadRequestException(
        'You already have a pending payout request. Please wait for it to be processed.',
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const tutorProfile = await manager.findOne(TutorProfile, {
        where: { userId: tutorId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!tutorProfile) throw new NotFoundException('Tutor profile not found');
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
      const payout = manager.create(Payout, {
        tutorId,
        amount: dto.amount,
        method: dto.method,
        accountDetails: dto.accountDetails,
        status: PayoutStatus.PENDING,
      });
      return manager.save(Payout, payout);
    });
  }

  async getTutorPayouts(tutorId: string) {
    const payouts = await this.payoutRepository.find({
      where: { tutorId },
      order: { createdAt: 'DESC' },
    });
    return payouts.map((p) => ({
      ...p,
      status: p.status,
    }));
  }

  /** Admin: all payout requests with tutor user info */
  async getAllPayouts() {
    const payouts = await this.payoutRepository.find({
      relations: { tutor: { user: true } as never },
      order: { createdAt: 'DESC' },
    });
    return payouts.map((p) => ({
      id: p.id,
      tutorId: p.tutorId,
      tutorName: (
        p.tutor as unknown as {
          user?: { firstName?: string; lastName?: string };
        }
      )?.user
        ? `${(p.tutor as unknown as { user: { firstName: string; lastName: string } }).user.firstName} ${(p.tutor as unknown as { user: { firstName: string; lastName: string } }).user.lastName}`
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
    return this.dataSource.transaction(async (manager) => {
      const payout = await manager.findOne(Payout, {
        where: { id: payoutId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!payout) throw new NotFoundException('Payout not found');
      if (payout.status !== PayoutStatus.PENDING) {
        throw new BadRequestException('Payout is already processed');
      }
      payout.status = PayoutStatus.SUCCESS;
      payout.adminNote = `Approved by admin ${adminId}`;
      return manager.save(Payout, payout);
    });
  }

  async rejectPayout(payoutId: string, adminId: string, reason: string) {
    return this.dataSource.transaction(async (manager) => {
      const payout = await manager.findOne(Payout, {
        where: { id: payoutId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!payout) throw new NotFoundException('Payout not found');
      if (payout.status !== PayoutStatus.PENDING) {
        throw new BadRequestException('Payout already processed');
      }
      await manager.increment(
        TutorProfile,
        { userId: payout.tutorId },
        'balance',
        payout.amount,
      );
      payout.status = PayoutStatus.FAILED;
      payout.adminNote = reason;
      return manager.save(Payout, payout);
    });
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
