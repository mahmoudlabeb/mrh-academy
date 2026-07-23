import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { PaymentMethod, PaymentStatus } from '@mrh/types';
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
        { provide: OBJECT_STORAGE, useValue: objectStorage },
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

  it('creates a direct Stripe course checkout for a guest email', async () => {
    const result = await service.createCourseCheckout({
      courseId: '5e784b46-ae4c-4a9b-9ca5-3d78f19ef4a9',
      email: 'STUDENT@example.com',
      firstName: 'Test',
      lastName: 'Student',
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
    paymentRepository.findOne.mockResolvedValueOnce({
      id: 'payment-1',
      userId: 'user-1',
      amount: 30,
      currency: 'USD',
      method: PaymentMethod.PAYPAL,
      status: PaymentStatus.PENDING,
      paypalOrderId: 'PAYPAL-ORDER-1',
    });

    await service.capturePayPalPayment('payment-1', 'user-1');

    expect(payPalService.captureOrder).toHaveBeenCalled();
    expect(paymentRepository.update).toHaveBeenCalledWith('payment-1', {
      paypalCaptureId: 'PAYPAL-CAPTURE-1',
    });
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
});
