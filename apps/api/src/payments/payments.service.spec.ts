import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { PaymentMethod, PaymentStatus, PayoutStatus } from '@mrh/types';
import { Payment } from './entities/payment.entity';
import { Payout } from './entities/payout.entity';
import { StudentProfile } from '../students/entities/student-profile.entity';
import { TutorProfile } from '../tutors/entities/tutor-profile.entity';
import { User } from '../users/entities/user.entity';
import { PaymentMethodConfig } from './entities/payment-method-config.entity';
import { EmailService } from '../integrations/email/email.service';
import { CommissionService } from './commission.service';
import { PaymentsService } from './payments.service';
import { StripeService } from './stripe/stripe.service';
import { OBJECT_STORAGE } from '../integrations/storage/object-storage';
import { Notification } from '../messages/entities/notification.entity';
import { CourseFundingAllocation } from './entities/course-funding-allocation.entity';
import { CourseEnrollment } from '../courses/entities/course-enrollment.entity';
import { Course } from '../courses/entities/course.entity';
import { UserRole, CourseStatus } from '@mrh/types';
import { PayPalService } from './paypal/paypal.service';
import { Lesson } from '../lessons/entities/lesson.entity';
import { ProcessedWebhookEvent } from './entities/processed-webhook-event.entity';
import { PlatformPayout } from './entities/platform-payout.entity';

describe('PaymentsService', () => {
  let service: PaymentsService;
  const paymentRepository = {
    create: jest.fn((value) => ({ id: 'payment-1', ...value })),
    save: jest.fn(async (value) => value),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const paymentMethodConfigRepository = {
    findOne: jest.fn(async (opts) => ({
      type: opts?.where?.type ?? 'card',
      enabled: true,
      details: '',
    })),
    find: jest.fn(),
  };
  const payoutRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  };
  const studentProfileRepository = { increment: jest.fn() };
  const tutorProfileRepository = { findOne: jest.fn(), update: jest.fn() };
  const userRepository = {
    findOne: jest.fn(async () => ({
      id: 'user-1',
      email: 'student@example.com',
      role: UserRole.STUDENT,
      isVerified: true,
      isActive: true,
      studentProfile: { userId: 'user-1' },
    })),
  };
  const courseRepository = {
    findOne: jest.fn(async () => ({
      id: 'course-1',
      tutorId: 'tutor-1',
      title: 'Test course',
      price: 100,
      status: CourseStatus.APPROVED,
    })),
  };
  const lessonRepository = {
    find: jest.fn(async () => []),
  };
  const dataSource = {
    getRepository: jest.fn(() => ({ findOne: jest.fn(async () => null) })),
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
        decrement: jest.fn(),
        create: jest.fn(),
      }),
    ),
  };
  const configService = { get: jest.fn(() => undefined) };
  const stripeService = {
    isConfigured: jest.fn(() => true),
    createCheckoutSession: jest.fn(async () => ({
      url: 'https://checkout.stripe.test/session',
    })),
    createCourseCheckoutSession: jest.fn(async () => ({
      id: 'cs_course',
      url: 'https://checkout.stripe.test/course',
    })),
  };
  const payPalService = {
    isConfigured: jest.fn(() => true),
    isWebhookConfigured: jest.fn(() => true),
    createOrder: jest.fn(async () => ({
      orderId: 'PAYPAL-ORDER-1',
      approvalUrl: 'https://www.sandbox.paypal.com/checkoutnow?token=1',
    })),
    captureOrder: jest.fn(async () => 'PAYPAL-CAPTURE-1'),
    getApprovalUrl: jest.fn(
      async () =>
        'https://www.sandbox.paypal.com/checkoutnow?token=PAYPAL-ORDER-1',
    ),
    createPayout: jest.fn(async () => ({
      batchId: 'PAYPAL-BATCH-1',
      itemId: 'PAYPAL-ITEM-1',
      status: 'PENDING',
    })),
  };
  const emailService = { sendEmail: jest.fn(async () => undefined) };
  const commissionService = {
    amountToCredits: jest.fn((amount: number) => amount / 15),
    getCreditPrice: jest.fn(async () => 15),
    getEgpRate: jest.fn(async () => 50),
  };
  const objectStorage = {
    upload: jest.fn(),
    destroy: jest.fn(),
    signedUrl: jest.fn(),
  };
  const notificationRepository = {
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => value),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: getRepositoryToken(Payment), useValue: paymentRepository },
        { provide: getRepositoryToken(Payout), useValue: payoutRepository },
        {
          provide: getRepositoryToken(StudentProfile),
          useValue: studentProfileRepository,
        },
        {
          provide: getRepositoryToken(TutorProfile),
          useValue: tutorProfileRepository,
        },
        { provide: getRepositoryToken(User), useValue: userRepository },
        {
          provide: getRepositoryToken(PaymentMethodConfig),
          useValue: paymentMethodConfigRepository,
        },
        { provide: getDataSourceToken(), useValue: dataSource },
        { provide: ConfigService, useValue: configService },
        { provide: StripeService, useValue: stripeService },
        { provide: PayPalService, useValue: payPalService },
        { provide: EmailService, useValue: emailService },
        { provide: CommissionService, useValue: commissionService },
        {
          provide: getRepositoryToken(Notification),
          useValue: notificationRepository,
        },
        { provide: getRepositoryToken(Course), useValue: courseRepository },
        { provide: getRepositoryToken(Lesson), useValue: lessonRepository },
        { provide: OBJECT_STORAGE, useValue: objectStorage },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('paginates student payment history', async () => {
    paymentRepository.find.mockResolvedValueOnce([]);

    await service.getPaymentHistory('student-1', 3, 20);

    expect(paymentRepository.find).toHaveBeenCalledWith({
      where: { userId: 'student-1' },
      order: { createdAt: 'DESC' },
      skip: 40,
      take: 20,
    });
  });

  it('paginates tutor and admin payout lists', async () => {
    payoutRepository.find.mockResolvedValue([]);

    await service.getTutorPayouts('tutor-1', 2, 25);
    await service.getAllPayouts(4, 10);

    expect(payoutRepository.find).toHaveBeenNthCalledWith(1, {
      where: { tutorId: 'tutor-1' },
      order: { createdAt: 'DESC' },
      skip: 25,
      take: 25,
    });
    expect(payoutRepository.find).toHaveBeenNthCalledWith(2, {
      relations: { tutor: { user: true } },
      order: { createdAt: 'DESC' },
      skip: 30,
      take: 10,
    });
  });

  it('puts PayPal first when verified payout webhooks are configured', () => {
    payPalService.isWebhookConfigured.mockReturnValueOnce(true);

    expect(service.getTutorPayoutOptions()).toEqual([
      { method: 'paypal', detailType: 'email' },
      { method: 'bank_transfer', detailType: 'account_details' },
      { method: 'vodafone_cash', detailType: 'account_details' },
      { method: 'instapay', detailType: 'account_details' },
    ]);
  });

  it('does not expose disabled or unrelated payout providers', () => {
    payPalService.isWebhookConfigured.mockReturnValueOnce(false);

    const options = service.getTutorPayoutOptions();

    expect(options).toEqual([
      { method: 'bank_transfer', detailType: 'account_details' },
      { method: 'vodafone_cash', detailType: 'account_details' },
      { method: 'instapay', detailType: 'account_details' },
    ]);
    expect(options).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: 'paypal' }),
        expect.objectContaining({ method: 'stripe_connect' }),
      ]),
    );
  });

  it('checks for an existing pending payout inside the locked transaction', async () => {
    jest
      .spyOn(service, 'releaseMatureCourseEarnings')
      .mockResolvedValueOnce(undefined);
    const manager = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce({ userId: 'tutor-1', balance: 500 })
        .mockResolvedValueOnce({
          id: 'pending-payout',
          tutorId: 'tutor-1',
          status: PayoutStatus.PENDING,
        }),
      decrement: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    dataSource.transaction.mockImplementationOnce(async (callback) =>
      callback(manager),
    );

    await expect(
      service.requestPayout('tutor-1', {
        amount: 100,
        method: 'bank_transfer',
        accountDetails: 'redacted-test-destination',
      }),
    ).rejects.toThrow('You already have a pending payout request');

    expect(manager.findOne).toHaveBeenNthCalledWith(
      1,
      TutorProfile,
      expect.objectContaining({
        where: { userId: 'tutor-1' },
        lock: { mode: 'pessimistic_write' },
      }),
    );
    expect(manager.findOne).toHaveBeenNthCalledWith(
      2,
      Payout,
      expect.objectContaining({
        where: expect.objectContaining({ tutorId: 'tutor-1' }),
      }),
    );
    expect(manager.decrement).not.toHaveBeenCalled();
  });

  it('resumes a reserved PayPal payout with the same provider request key', async () => {
    jest
      .spyOn(service, 'releaseMatureCourseEarnings')
      .mockResolvedValueOnce(undefined);
    const reserved = {
      id: 'payout-reserved',
      tutorId: 'tutor-1',
      amount: 80,
      method: 'paypal',
      accountDetails: 'tutor@example.test',
      idempotencyKey: '3e676469-d593-4bd8-94d6-c7bc30dfeaa1',
      status: PayoutStatus.PENDING,
    } as Payout;
    payoutRepository.findOne.mockResolvedValueOnce(reserved);
    const decrement = jest.fn();
    const manager = {
      findOne: jest.fn(async () => reserved),
      save: jest.fn(async (_entity, value) => value),
      decrement,
    };
    dataSource.transaction.mockImplementationOnce(async (callback) =>
      callback(manager),
    );

    const result = await service.requestPayout('tutor-1', {
      amount: 80,
      method: 'paypal',
      paypalEmail: 'tutor@example.test',
      idempotencyKey: '3e676469-d593-4bd8-94d6-c7bc30dfeaa1',
    });

    expect(payPalService.createPayout).toHaveBeenCalledWith(
      reserved,
      'tutor@example.test',
    );
    expect(result.status).toBe(PayoutStatus.PROCESSING);
    expect(decrement).not.toHaveBeenCalled();
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
      'USD',
    );
    expect(result.checkoutUrl).toBe('https://checkout.stripe.test/session');
  });

  it('creates a direct Stripe course checkout for a verified student', async () => {
    const result = await service.createCourseCheckout('user-1', {
      courseId: '5e784b46-ae4c-4a9b-9ca5-3d78f19ef4a9',
      idempotencyKey: '8c0cf478-f1ed-47e9-8104-d7bfb9334c54',
    });

    expect(stripeService.createCourseCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        paymentId: 'payment-1',
        amount: 100,
        email: 'student@example.com',
        idempotencyKey: '8c0cf478-f1ed-47e9-8104-d7bfb9334c54',
      }),
    );
    expect(paymentRepository.update).toHaveBeenCalledWith('payment-1', {
      stripeCheckoutSessionId: 'cs_course',
      providerStatus: 'OPEN',
    });
    expect(result.checkoutUrl).toBe('https://checkout.stripe.test/course');
  });

  it('rejects direct course checkout for an unverified account', async () => {
    userRepository.findOne.mockResolvedValueOnce({
      id: 'user-1',
      email: 'student@example.com',
      role: UserRole.STUDENT,
      isVerified: false,
      isActive: true,
      studentProfile: { userId: 'user-1' },
    });

    await expect(
      service.createCourseCheckout('user-1', {
        courseId: '5e784b46-ae4c-4a9b-9ca5-3d78f19ef4a9',
        idempotencyKey: '9a1f1d22-17ed-4ebf-8678-35cad64abc9a',
      }),
    ).rejects.toThrow('Verify and activate your student account');
    expect(stripeService.createCourseCheckoutSession).not.toHaveBeenCalled();
  });

  it('keeps PayPal pending and redirects to a real PayPal approval URL', async () => {
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
    expect(payPalService.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'payment-1', amount: 30 }),
    );
    expect(dataSource.transaction).not.toHaveBeenCalled();
    expect(result.payment.status).toBe(PaymentStatus.PENDING);
    expect(result.payment.paypalOrderId).toBe('PAYPAL-ORDER-1');
    expect(result.checkoutUrl).toContain('sandbox.paypal.com');
  });

  it('returns the same PayPal checkout for a repeated wallet idempotency key', async () => {
    paymentRepository.findOne.mockResolvedValueOnce({
      id: 'payment-1',
      userId: 'user-1',
      amount: 30,
      currency: 'USD',
      method: PaymentMethod.PAYPAL,
      status: PaymentStatus.PENDING,
      idempotencyKey: '9d6680af-72c4-4c2a-a7d4-b542e12ccae3',
      paypalOrderId: 'PAYPAL-ORDER-1',
    });

    await expect(
      service.submitPayment('user-1', {
        amount: 30,
        currency: 'USD',
        method: PaymentMethod.PAYPAL,
        idempotencyKey: '9d6680af-72c4-4c2a-a7d4-b542e12ccae3',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        payment: expect.objectContaining({ id: 'payment-1' }),
        checkoutUrl: expect.stringContaining('sandbox.paypal.com'),
      }),
    );

    expect(paymentRepository.save).not.toHaveBeenCalled();
    expect(payPalService.createOrder).not.toHaveBeenCalled();
  });

  it('resumes a pending card checkout without creating another payment row', async () => {
    paymentRepository.findOne.mockResolvedValueOnce({
      id: 'payment-card-1',
      userId: 'user-1',
      amount: 30,
      currency: 'USD',
      method: PaymentMethod.CARD,
      status: PaymentStatus.PENDING,
      idempotencyKey: 'f39ee14f-b34d-4a70-b0df-da9d1e01da06',
    });

    const result = await service.submitPayment('user-1', {
      method: PaymentMethod.CARD,
      amount: 30,
      currency: 'USD',
      idempotencyKey: 'f39ee14f-b34d-4a70-b0df-da9d1e01da06',
    });

    expect(paymentRepository.create).not.toHaveBeenCalled();
    expect(stripeService.createCheckoutSession).toHaveBeenCalledWith(
      'user-1',
      30,
      'payment-card-1',
      'USD',
    );
    expect(result.checkoutUrl).toBe('https://checkout.stripe.test/session');
  });

  it('credits PayPal only after server-side capture verification', async () => {
    const save = jest.fn(async (_entity, value) => value);
    const increment = jest.fn();
    dataSource.transaction.mockImplementationOnce(async (cb) =>
      cb({
        findOne: jest.fn(async () => ({
          id: 'payment-1',
          userId: 'user-1',
          amount: 30,
          currency: 'USD',
          method: PaymentMethod.PAYPAL,
          status: PaymentStatus.PENDING,
          paypalOrderId: 'PAYPAL-ORDER-1',
        })),
        save,
        increment,
      }),
    );

    await service.capturePayPalPayment('payment-1', 'user-1');

    expect(payPalService.captureOrder).toHaveBeenCalled();
    expect(save).toHaveBeenCalledWith(
      Payment,
      expect.objectContaining({
        paypalCaptureId: 'PAYPAL-CAPTURE-1',
        status: PaymentStatus.APPROVED,
      }),
    );
    expect(increment).toHaveBeenCalledWith(
      StudentProfile,
      { userId: 'user-1' },
      'balance',
      30,
    );
    expect(dataSource.transaction).toHaveBeenCalled();
  });

  it('credits a verified PayPal capture webhook exactly once', async () => {
    let processed = false;
    const payment = {
      id: 'payment-1',
      userId: 'user-1',
      amount: 30,
      currency: 'USD',
      method: PaymentMethod.PAYPAL,
      status: PaymentStatus.PENDING,
      refundedAmount: 0,
    } as Payment;
    const increment = jest.fn();
    const manager = {
      findOne: jest.fn(async (entity) => {
        if (entity === ProcessedWebhookEvent)
          return processed ? { eventId: 'WH-CAPTURE-1' } : null;
        if (entity === Payment) return payment;
        return null;
      }),
      create: jest.fn((_entity, value) => value),
      save: jest.fn(async (entity, value) => {
        if (entity === ProcessedWebhookEvent) processed = true;
        if (entity === Payment) Object.assign(payment, value);
        return value;
      }),
      increment,
    };
    dataSource.transaction.mockImplementation(async (callback) =>
      callback(manager),
    );
    const event = {
      id: 'WH-CAPTURE-1',
      event_type: 'PAYMENT.CAPTURE.COMPLETED',
      resource: {
        id: 'CAPTURE-1',
        amount: { currency_code: 'USD', value: '30.00' },
        supplementary_data: { related_ids: { order_id: 'ORDER-1' } },
      },
    };

    await expect(service.processPayPalWebhookEvent(event)).resolves.toEqual({
      received: true,
      duplicate: false,
    });
    await expect(service.processPayPalWebhookEvent(event)).resolves.toEqual({
      received: true,
      duplicate: true,
    });

    expect(increment).toHaveBeenCalledTimes(1);
    expect(increment).toHaveBeenCalledWith(
      StudentProfile,
      { userId: 'user-1' },
      'balance',
      30,
    );
    expect(payment.status).toBe(PaymentStatus.APPROVED);
    expect(payment.paypalCaptureId).toBe('CAPTURE-1');
  });

  it('restores a failed PayPal payout exactly once after a verified webhook', async () => {
    let processed = false;
    const payout = {
      id: 'payout-1',
      tutorId: 'tutor-1',
      amount: 80,
      method: 'paypal',
      status: PayoutStatus.PROCESSING,
      paypalItemId: 'ITEM-1',
      balanceRestoredAt: null,
    } as Payout;
    const increment = jest.fn();
    const manager = {
      findOne: jest.fn(async (entity) => {
        if (entity === ProcessedWebhookEvent)
          return processed ? { eventId: 'WH-PAYOUT-1' } : null;
        if (entity === Payout) return payout;
        return null;
      }),
      create: jest.fn((_entity, value) => value),
      save: jest.fn(async (entity, value) => {
        if (entity === ProcessedWebhookEvent) processed = true;
        if (entity === Payout) Object.assign(payout, value);
        return value;
      }),
      increment,
    };
    dataSource.transaction.mockImplementation(async (callback) =>
      callback(manager),
    );
    const event = {
      id: 'WH-PAYOUT-1',
      event_type: 'PAYMENT.PAYOUTS-ITEM.FAILED',
      resource: {
        payout_item_id: 'ITEM-1',
        transaction_status: 'FAILED',
        payout_item: { sender_item_id: 'payout-1' },
      },
    };

    await service.processPayPalWebhookEvent(event);
    await service.processPayPalWebhookEvent(event);

    expect(increment).toHaveBeenCalledTimes(1);
    expect(increment).toHaveBeenCalledWith(
      TutorProfile,
      { userId: 'tutor-1' },
      'balance',
      80,
    );
    expect(payout.status).toBe(PayoutStatus.FAILED);
    expect(payout.balanceRestoredAt).toBeInstanceOf(Date);
  });

  it('finalizes an admin commission payout from a verified PayPal webhook', async () => {
    let processed = false;
    const platformPayout = {
      id: 'platform-payout-1',
      requestedBy: 'admin-1',
      amount: 125,
      status: PayoutStatus.PROCESSING,
      paypalItemId: 'PLATFORM-ITEM-1',
      providerStatus: 'PENDING',
    } as PlatformPayout;
    const increment = jest.fn();
    const manager = {
      findOne: jest.fn(async (entity) => {
        if (entity === ProcessedWebhookEvent)
          return processed ? { eventId: 'WH-PLATFORM-PAYOUT-1' } : null;
        if (entity === Payout) return null;
        if (entity === PlatformPayout) return platformPayout;
        return null;
      }),
      create: jest.fn((_entity, value) => value),
      save: jest.fn(async (entity, value) => {
        if (entity === ProcessedWebhookEvent) processed = true;
        if (entity === PlatformPayout) Object.assign(platformPayout, value);
        return value;
      }),
      increment,
    };
    dataSource.transaction.mockImplementation(async (callback) =>
      callback(manager),
    );
    const event = {
      id: 'WH-PLATFORM-PAYOUT-1',
      event_type: 'PAYMENT.PAYOUTS-ITEM.SUCCEEDED',
      resource: {
        payout_item_id: 'PLATFORM-ITEM-1',
        transaction_status: 'SUCCESS',
        payout_item: { sender_item_id: 'platform-payout-1' },
      },
    };

    await service.processPayPalWebhookEvent(event);
    await service.processPayPalWebhookEvent(event);

    expect(platformPayout.status).toBe(PayoutStatus.SUCCESS);
    expect(platformPayout.processedAt).toBeInstanceOf(Date);
    expect(increment).not.toHaveBeenCalled();
    expect(notificationRepository.save).toHaveBeenCalledTimes(1);
  });

  it('credits an approved USD payment to the student wallet one-for-one', async () => {
    const increment = jest.fn();
    dataSource.transaction.mockImplementationOnce(async (cb) =>
      cb({
        findOne: jest.fn(async () => ({
          id: 'payment-1',
          userId: 'user-1',
          amount: 30,
          currency: 'USD',
          method: PaymentMethod.CARD,
          status: PaymentStatus.PENDING,
        })),
        save: jest.fn(async (entity) => entity),
        increment,
      }),
    );

    await service.approvePayment('payment-1', 'admin-1');

    expect(increment).toHaveBeenCalledWith(
      StudentProfile,
      { userId: 'user-1' },
      'balance',
      30,
    );
  });

  it('treats repeated verification of an approved payment as an idempotent no-op', async () => {
    const increment = jest.fn();
    dataSource.transaction.mockImplementationOnce(async (cb) =>
      cb({
        findOne: jest.fn(async () => ({
          id: 'payment-1',
          userId: 'user-1',
          amount: 30,
          currency: 'USD',
          method: PaymentMethod.CARD,
          status: PaymentStatus.APPROVED,
        })),
        save: jest.fn(),
        increment,
      }),
    );

    const result = await service.approvePayment('payment-1', 'stripe-webhook');

    expect(result.status).toBe(PaymentStatus.APPROVED);
    expect(increment).not.toHaveBeenCalled();
    expect(notificationRepository.save).not.toHaveBeenCalled();
    expect(emailService.sendEmail).not.toHaveBeenCalled();
  });

  it('converts an approved EGP payment to USD before crediting the wallet', async () => {
    const increment = jest.fn();
    dataSource.transaction.mockImplementationOnce(async (cb) =>
      cb({
        findOne: jest.fn(async () => ({
          id: 'payment-1',
          userId: 'user-1',
          amount: 1_500,
          currency: 'EGP',
          method: PaymentMethod.BANK,
          status: PaymentStatus.PENDING,
        })),
        save: jest.fn(async (entity) => entity),
        increment,
      }),
    );

    await service.approvePayment('payment-1', 'admin-1');

    expect(increment).toHaveBeenCalledWith(
      StudentProfile,
      { userId: 'user-1' },
      'balance',
      30,
    );
  });

  it('revokes funded course access and reverses commissions on Stripe refund', async () => {
    const increment = jest.fn();
    const decrement = jest.fn();
    const remove = jest.fn();
    const update = jest.fn();
    const allocation = {
      id: 'allocation-1',
      paymentId: 'payment-1',
      enrollmentId: 'enrollment-1',
      amount: 100,
      createdAt: new Date(),
    };
    const enrollment = {
      id: 'enrollment-1',
      studentId: 'user-1',
      courseId: 'course-1',
      platformFee: 53,
      tutorShare: 47,
      tutorShareReleasedAt: new Date(),
      soldBy: 'academy',
      course: { tutorId: 'tutor-1' },
    };

    dataSource.transaction.mockImplementationOnce(async (cb) =>
      cb({
        findOne: jest.fn(async (entity) => {
          if (entity === Payment)
            return {
              id: 'payment-1',
              userId: 'user-1',
              amount: 100,
              status: PaymentStatus.APPROVED,
              refundedAmount: 0,
            };
          if (entity === CourseEnrollment) return enrollment;
          return null;
        }),
        find: jest.fn(async (entity) =>
          entity === CourseFundingAllocation ? [allocation] : [],
        ),
        increment,
        decrement,
        delete: remove,
        update,
        create: jest.fn((_entity, value) => value),
        save: jest.fn(async (_entity, value) => value),
      }),
    );

    const result = await service.refundStripePayment(
      'payment-1',
      100,
      'charge-1',
    );

    expect(result.revokedCourses).toBe(1);
    expect(increment).toHaveBeenCalledWith(
      StudentProfile,
      { userId: 'user-1' },
      'balance',
      100,
    );
    expect(decrement).toHaveBeenCalledWith(
      TutorProfile,
      { userId: 'tutor-1' },
      'balance',
      47,
    );
    expect(decrement).toHaveBeenCalledWith(
      StudentProfile,
      { userId: 'user-1' },
      'balance',
      100,
    );
    expect(remove).toHaveBeenCalledWith(CourseEnrollment, {
      id: 'enrollment-1',
    });
    expect(notificationRepository.save).toHaveBeenCalled();
  });

  it('removes abandoned guest checkout placeholders after the retention window', async () => {
    const cutoffPayment = {
      id: 'stale-payment',
      userId: 'guest-user',
      status: PaymentStatus.PENDING,
      createdAt: new Date(Date.now() - 72 * 60 * 60 * 1000),
    };
    paymentRepository.find.mockResolvedValueOnce([cutoffPayment]);
    const remove = jest.fn();
    const manager = {
      findOne: jest.fn(async () => cutoffPayment),
      createQueryBuilder: jest.fn(() => ({
        addSelect() {
          return this;
        },
        where() {
          return this;
        },
        getOne: jest.fn(async () => ({
          id: 'guest-user',
          role: UserRole.STUDENT,
          isVerified: false,
          passwordHash: null,
        })),
      })),
      count: jest.fn(async (entity) => (entity === Payment ? 1 : 0)),
      delete: remove,
    };
    dataSource.transaction.mockImplementationOnce(async (cb) => cb(manager));

    await expect(service.cleanupAbandonedGuestCheckouts()).resolves.toEqual({
      removed: 1,
    });
    expect(remove).toHaveBeenNthCalledWith(1, Payment, {
      id: 'stale-payment',
    });
    expect(remove).toHaveBeenNthCalledWith(2, StudentProfile, {
      userId: 'guest-user',
    });
    expect(remove).toHaveBeenNthCalledWith(3, User, { id: 'guest-user' });
  });

  it('keeps verified or password-bearing accounts during guest cleanup', async () => {
    paymentRepository.find.mockResolvedValueOnce([
      {
        id: 'stale-payment',
        userId: 'existing-user',
        status: PaymentStatus.PENDING,
        createdAt: new Date(Date.now() - 72 * 60 * 60 * 1000),
      },
    ]);
    const manager = {
      findOne: jest.fn(async () => ({
        id: 'stale-payment',
        userId: 'existing-user',
        status: PaymentStatus.PENDING,
        createdAt: new Date(Date.now() - 72 * 60 * 60 * 1000),
      })),
      createQueryBuilder: jest.fn(() => ({
        addSelect() {
          return this;
        },
        where() {
          return this;
        },
        getOne: jest.fn(async () => ({
          id: 'existing-user',
          role: UserRole.STUDENT,
          isVerified: true,
          passwordHash: 'existing-password',
        })),
      })),
      count: jest.fn(),
      delete: jest.fn(),
    };
    dataSource.transaction.mockImplementationOnce(async (cb) => cb(manager));

    await expect(service.cleanupAbandonedGuestCheckouts()).resolves.toEqual({
      removed: 0,
    });
    expect(manager.delete).not.toHaveBeenCalled();
    expect(manager.count).not.toHaveBeenCalled();
  });

  it('creates an EGP Stripe checkout in EGP instead of charging the same number of USD', async () => {
    await service.submitPayment('user-1', {
      method: PaymentMethod.CARD,
      amount: 1_500,
      currency: 'EGP',
    });

    expect(stripeService.createCheckoutSession).toHaveBeenCalledWith(
      'user-1',
      1_500,
      'payment-1',
      'EGP',
    );
  });

  it('keeps a recoverable pending record when Stripe checkout initiation fails', async () => {
    stripeService.createCheckoutSession.mockRejectedValueOnce(
      new Error('sandbox provider unavailable'),
    );

    await expect(
      service.submitPayment('user-1', {
        method: PaymentMethod.CARD,
        amount: 30,
        currency: 'USD',
      }),
    ).rejects.toThrow('Card payment is currently unavailable');

    expect(paymentRepository.delete).not.toHaveBeenCalled();
    expect(paymentRepository.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: 'payment-1',
        status: PaymentStatus.PENDING,
        providerStatus: 'INITIATION_FAILED',
      }),
    );
    expect(studentProfileRepository.increment).not.toHaveBeenCalled();
  });

  it('validates and stores a manual-payment receipt without crediting the wallet', async () => {
    paymentMethodConfigRepository.findOne.mockResolvedValueOnce({
      type: PaymentMethod.BANK,
      enabled: true,
      details: 'Fictional sandbox bank destination',
    });
    objectStorage.upload.mockResolvedValueOnce({
      secureUrl: 'https://storage.example/test-receipt.png',
    });
    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);

    const result = await service.submitPayment(
      'user-1',
      {
        method: PaymentMethod.BANK,
        amount: 50,
        currency: 'USD',
      },
      {
        buffer: png,
        mimetype: 'image/png',
      } as Express.Multer.File,
    );

    expect(objectStorage.upload).toHaveBeenCalledWith(png, {
      folder: 'mrh-academy/payments',
      resourceType: 'auto',
    });
    expect(result.payment).toEqual(
      expect.objectContaining({
        status: PaymentStatus.PENDING,
        receiptUrl: 'https://storage.example/test-receipt.png',
      }),
    );
    expect(studentProfileRepository.increment).not.toHaveBeenCalled();
  });

  it('rejects a receipt whose bytes do not match its declared content type', async () => {
    paymentMethodConfigRepository.findOne.mockResolvedValueOnce({
      type: PaymentMethod.BANK,
      enabled: true,
      details: 'Fictional sandbox bank destination',
    });

    await expect(
      service.submitPayment(
        'user-1',
        {
          method: PaymentMethod.BANK,
          amount: 50,
          currency: 'USD',
        },
        {
          buffer: Buffer.from('not a png'),
          mimetype: 'image/png',
        } as Express.Multer.File,
      ),
    ).rejects.toThrow('Receipt content does not match its type');

    expect(objectStorage.upload).not.toHaveBeenCalled();
    expect(paymentRepository.save).not.toHaveBeenCalled();
  });

  it('refunds the immutable USD wallet value of an EGP payment', async () => {
    const decrement = jest.fn();
    const update = jest.fn();
    dataSource.transaction.mockImplementationOnce(async (cb) =>
      cb({
        findOne: jest.fn(async () => ({
          id: 'payment-1',
          userId: 'user-1',
          amount: 1_500,
          currency: 'EGP',
          creditedAmountUsd: 30,
          refundedAmount: 0,
          status: PaymentStatus.APPROVED,
        })),
        find: jest.fn(async () => []),
        decrement,
        update,
      }),
    );

    const result = await service.refundStripePayment(
      'payment-1',
      1_500,
      'ch_sandbox_1',
    );

    expect(decrement).toHaveBeenCalledWith(
      StudentProfile,
      { userId: 'user-1' },
      'balance',
      30,
    );
    expect(update).toHaveBeenCalledWith(
      Payment,
      { id: 'payment-1' },
      expect.objectContaining({
        refundedAmount: 1_500,
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        refundDelta: 1_500,
        walletRefundDelta: 30,
      }),
    );
  });
});
