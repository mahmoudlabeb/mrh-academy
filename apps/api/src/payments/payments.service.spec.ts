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
    createOrder: jest.fn(async () => ({
      orderId: 'PAYPAL-ORDER-1',
      approvalUrl: 'https://www.sandbox.paypal.com/checkoutnow?token=1',
    })),
    captureOrder: jest.fn(async () => 'PAYPAL-CAPTURE-1'),
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
    expect(manager.findOne).toHaveBeenNthCalledWith(2, Payout, {
      where: { tutorId: 'tutor-1', status: PayoutStatus.PENDING },
    });
    expect(manager.decrement).not.toHaveBeenCalled();
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

  it('creates a direct Stripe course checkout for a verified student', async () => {
    const result = await service.createCourseCheckout('user-1', {
      courseId: '5e784b46-ae4c-4a9b-9ca5-3d78f19ef4a9',
    });

    expect(stripeService.createCourseCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        paymentId: 'payment-1',
        amount: 100,
        email: 'student@example.com',
      }),
    );
    expect(paymentRepository.update).toHaveBeenCalledWith('payment-1', {
      stripeCheckoutSessionId: 'cs_course',
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
});
