import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { v2 as cloudinary } from 'cloudinary';
import {
  DataSource,
  QueryFailedError,
  Repository,
  type DeepPartial,
} from 'typeorm';
import { PaymentMethod, PaymentStatus } from '@mrh/types';
import { Payment } from '../entities/payment.entity.js';
import { Payout, PayoutStatus } from '../entities/payout.entity.js';
import { StudentProfile } from '../entities/student-profile.entity.js';
import { TutorProfile } from '../entities/tutor-profile.entity.js';
import { User } from '../entities/user.entity.js';
import { PaymentMethodConfig } from '../entities/payment-method-config.entity.js';
import { SubmitPaymentDto } from './dto/submit-payment.dto.js';
import { RequestPayoutDto } from './dto/request-payout.dto.js';
import { StripeService } from './stripe/stripe.service.js';
import { EmailService } from '../services/email.service.js';
import { CommissionService } from '../services/commission.service.js';

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
    private readonly emailService: EmailService,
    private readonly commissionService: CommissionService,
  ) {
    cloudinary.config({
      cloud_name: this.configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get<string>('CLOUDINARY_API_SECRET'),
    });
  }

  private validateReceiptFile(file: Express.Multer.File) {
    if (!RECEIPT_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException('Receipt must be JPEG, PNG, WebP, or PDF');
    }
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

    const receiptRequiredMethods: PaymentMethod[] = [
      PaymentMethod.VODAFONE,
      PaymentMethod.INSTAPAY,
      PaymentMethod.BINANCE,
      PaymentMethod.BANK,
    ];
    if (receiptRequiredMethods.includes(dto.method) && !screenshotFile) {
      throw new BadRequestException(
        'A receipt screenshot is required for this payment method',
      );
    }

    let receiptUrl: string | null = null;
    if (screenshotFile) {
      this.validateReceiptFile(screenshotFile);
      receiptUrl = await this.uploadToCloudinary(
        screenshotFile.buffer,
        screenshotFile.mimetype,
      );
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
      const approved = await this.approvePayment(
        savedPayment.id,
        'paypal-auto',
      );
      return { payment: approved, checkoutUrl: undefined };
    }

    let checkoutUrl = undefined;
    if (dto.method === PaymentMethod.CARD) {
      const session = await this.stripeService.createCheckoutSession(
        userId,
        dto.amount,
        savedPayment.id,
      );
      checkoutUrl = session.url;
    }

    return { payment: savedPayment, checkoutUrl };
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

        // Convert to credits based on currency
        const amountInUsd =
          payment.currency === 'EGP' ? payment.amount / 50 : payment.amount;
        const balanceToAdd =
          await this.commissionService.amountToCredits(amountInUsd);
        await manager.increment(
          StudentProfile,
          { userId: payment.userId },
          'balance',
          balanceToAdd,
        );

        return { payment, balanceToAdd };
      })
      .then(async ({ payment, balanceToAdd }) => {
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
<p>Credits Added: ${balanceToAdd.toFixed(2)}</p>`,
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

  async requestPayout(tutorId: string, dto: RequestPayoutDto) {
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
    return this.payoutRepository.find({
      where: { tutorId },
      order: { createdAt: 'DESC' },
    });
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

  private uploadToCloudinary(
    buffer: Buffer,
    mimetype?: string,
  ): Promise<string> {
    const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
    if (!cloudName) {
      // Fallback for local development when Cloudinary is not configured
      return Promise.resolve(
        'https://dummyimage.com/600x400/000/fff&text=Dummy+Receipt',
      );
    }

    return new Promise((resolve, reject) => {
      const options: any = {
        folder: 'mrh-academy/payments',
        resource_type: 'auto',
      };
      if (mimetype === 'application/pdf') {
        options.format = 'pdf';
      }

      const stream = cloudinary.uploader.upload_stream(
        options,
        (error, result) => {
          if (error || !result) {
            reject(
              error instanceof Error
                ? error
                : new Error('Cloudinary upload failed'),
            );
            return;
          }
          resolve(result.secure_url);
        },
      );
      stream.end(buffer);
    });
  }
}
