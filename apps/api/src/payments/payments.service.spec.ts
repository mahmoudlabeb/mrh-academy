import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { PaymentMethod, PaymentStatus } from '@mrh/types';
import { Payment } from '../entities/payment.entity';
import { StudentProfile } from '../entities/student-profile.entity';
import { User } from '../entities/user.entity';
import { EmailService } from '../services/email.service';
import { CommissionService } from '../services/commission.service';
import { PaymentsService } from './payments.service';
import { StripeService } from './stripe/stripe.service';

describe('PaymentsService', () => {
  let service: PaymentsService;
  const paymentRepository = {
    create: jest.fn((value) => ({ id: 'payment-1', ...value })),
    save: jest.fn(async (value) => value),
    find: jest.fn(),
  };
  const studentProfileRepository = { increment: jest.fn() };
  const userRepository = {
    findOne: jest.fn(async () => ({
      id: 'user-1',
      email: 'student@example.com',
    })),
  };
  const dataSource = {
    transaction: jest.fn(async (cb) =>
      cb({
        findOne: jest.fn(async () => ({
          id: 'payment-1',
          userId: 'user-1',
          amount: 30,
          method: PaymentMethod.PAYPAL,
          status: PaymentStatus.PENDING,
        })),
        save: jest.fn(async (entity) => entity),
        increment: jest.fn(),
      }),
    ),
  };
  const configService = { get: jest.fn(() => undefined) };
  const stripeService = {
    isConfigured: jest.fn(() => true),
    createCheckoutSession: jest.fn(async () => ({
      url: 'https://checkout.stripe.test/session',
    })),
  };
  const emailService = { sendEmail: jest.fn(async () => undefined) };
  const commissionService = {
    amountToCredits: jest.fn((amount: number) => amount / 15),
    getCreditPrice: jest.fn(async () => 15),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: getRepositoryToken(Payment), useValue: paymentRepository },
        {
          provide: getRepositoryToken(StudentProfile),
          useValue: studentProfileRepository,
        },
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: getDataSourceToken(), useValue: dataSource },
        { provide: ConfigService, useValue: configService },
        { provide: StripeService, useValue: stripeService },
        { provide: EmailService, useValue: emailService },
        { provide: CommissionService, useValue: commissionService },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('keeps card payments pending until Stripe confirms them', async () => {
    const result = await service.submitPayment('user-1', {
      method: PaymentMethod.CARD,
      amount: 30,
    });

    expect(paymentRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        amount: 30,
        method: PaymentMethod.CARD,
        status: PaymentStatus.PENDING,
      }),
    );
    expect(studentProfileRepository.increment).not.toHaveBeenCalled();
    expect(stripeService.createCheckoutSession).toHaveBeenCalledWith(
      'user-1',
      30,
      'payment-1',
    );
    expect(result.checkoutUrl).toBe('https://checkout.stripe.test/session');
  });

  it('auto-approves PayPal payments per original spec', async () => {
    const result = await service.submitPayment('user-1', {
      method: PaymentMethod.PAYPAL,
      amount: 30,
    });

    expect(paymentRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        method: PaymentMethod.PAYPAL,
        status: PaymentStatus.PENDING,
      }),
    );
    expect(dataSource.transaction).toHaveBeenCalled();
    expect(result.payment.status).toBe(PaymentStatus.APPROVED);
  });
});
