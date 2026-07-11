import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { v2 as cloudinary } from 'cloudinary';
import { DataSource, QueryFailedError, Repository, type DeepPartial } from 'typeorm';
import { PaymentMethod, PaymentStatus } from '@mrh/types';
import { Payment } from '../entities/payment.entity.js';
import { StudentProfile } from '../entities/student-profile.entity.js';
import { User } from '../entities/user.entity.js';
import { SubmitPaymentDto } from './dto/submit-payment.dto.js';
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
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(StudentProfile)
    private readonly studentProfileRepository: Repository<StudentProfile>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
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
      throw new BadRequestException(
        'Receipt must be JPEG, PNG, WebP, or PDF',
      );
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
      receiptUrl = await this.uploadToCloudinary(screenshotFile.buffer);
    }

    const payment = this.paymentRepository.create({
      userId,
      amount: dto.amount,
      method: dto.method,
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
        await manager.save(Payment, payment);

        const balanceToAdd = await this.commissionService.amountToCredits(
          payment.amount,
        );
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
            .catch(() => {});
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
      payment.adminNote = reason ?? `Rejected by admin ${adminId}`;
      await manager.save(Payment, payment);

      return payment;
    });
  }

  private uploadToCloudinary(buffer: Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'mrh-academy/payments',
          resource_type: 'auto',
        },
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
