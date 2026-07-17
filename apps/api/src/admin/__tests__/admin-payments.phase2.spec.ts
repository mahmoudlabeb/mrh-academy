import { AdminPaymentsController } from '../admin-payments.controller.js';
import { PayoutStatus } from '@mrh/types';

describe('AdminPaymentsController phase 2 regression', () => {
  it('marks payout failed with a safe error message when Stripe throws a non-Error', async () => {
    const firstManager = {
      findOne: jest.fn().mockResolvedValue({
        userId: 'tutor-1',
        stripeAccountId: 'acct_123',
        stripeOnboardingComplete: true,
        balance: 42,
      }),
      decrement: jest.fn(),
      update: jest.fn(),
      create: jest.fn().mockReturnValue({
        id: 'payout-1',
        tutorId: 'tutor-1',
        amount: 42,
        status: PayoutStatus.PENDING,
      }),
      save: jest.fn(),
    };
    const failureManager = {
      increment: jest.fn(),
      update: jest.fn(),
    };
    const dataSource = {
      transaction: jest
        .fn()
        .mockImplementationOnce((callback) => callback(firstManager))
        .mockImplementationOnce((callback) => callback(failureManager)),
    };
    const stripeService = {
      createPayout: jest.fn().mockRejectedValue('stripe unavailable'),
    };
    const payoutRepo = { update: jest.fn() };
    const controller = new AdminPaymentsController(
      {} as unknown as ConstructorParameters<typeof AdminPaymentsController>[0],
      stripeService as unknown as ConstructorParameters<
        typeof AdminPaymentsController
      >[1],
      dataSource as unknown as ConstructorParameters<
        typeof AdminPaymentsController
      >[2],
      {} as unknown as ConstructorParameters<typeof AdminPaymentsController>[3],
      payoutRepo as unknown as ConstructorParameters<
        typeof AdminPaymentsController
      >[4],
    );

    await expect(controller.payoutTutor('tutor-1')).rejects.toBe(
      'stripe unavailable',
    );

    expect(stripeService.createPayout).toHaveBeenCalledWith(
      'acct_123',
      4200,
      'payout-payout-1',
    );
    expect(failureManager.increment).toHaveBeenCalledWith(
      expect.any(Function),
      { userId: 'tutor-1' },
      'balance',
      42,
    );
    expect(failureManager.update).toHaveBeenCalledWith(
      expect.any(Function),
      { id: 'payout-1' },
      {
        status: PayoutStatus.FAILED,
        errorMessage: 'Stripe payout failed',
      },
    );
  });

  it('marks payout SUCCESS and returns { message, amount } when Stripe succeeds (P2-I preservation)', async () => {
    const firstManager = {
      findOne: jest.fn().mockResolvedValue({
        userId: 'tutor-1',
        stripeAccountId: 'acct_123',
        stripeOnboardingComplete: true,
        balance: 100,
      }),
      decrement: jest.fn(),
      update: jest.fn(),
      create: jest.fn().mockReturnValue({
        id: 'payout-1',
        tutorId: 'tutor-1',
        amount: 100,
        status: PayoutStatus.PENDING,
      }),
      save: jest.fn(),
    };
    const dataSource = {
      transaction: jest
        .fn()
        .mockImplementation((callback) => callback(firstManager)),
    };
    const stripeService = {
      createPayout: jest.fn().mockResolvedValue({ id: 'po_stripe_1' }),
    };
    const payoutRepo = { update: jest.fn().mockResolvedValue({}) };
    const controller = new AdminPaymentsController(
      {} as unknown as ConstructorParameters<typeof AdminPaymentsController>[0],
      stripeService as unknown as ConstructorParameters<
        typeof AdminPaymentsController
      >[1],
      dataSource as unknown as ConstructorParameters<
        typeof AdminPaymentsController
      >[2],
      {} as unknown as ConstructorParameters<typeof AdminPaymentsController>[3],
      payoutRepo as unknown as ConstructorParameters<
        typeof AdminPaymentsController
      >[4],
    );

    const result = await controller.payoutTutor('tutor-1');

    expect(result).toEqual({ message: 'Payout sent successfully', amount: 100 });
    expect(payoutRepo.update).toHaveBeenCalledWith('payout-1', {
      status: PayoutStatus.SUCCESS,
      stripePayoutId: 'po_stripe_1',
    });
  });
});
