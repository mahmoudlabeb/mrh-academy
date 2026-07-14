import { AdminPaymentsController } from '../admin-payments.controller.js';
import { PayoutStatus } from '../../entities/payout.entity.js';

describe('AdminPaymentsController phase 2 regression', () => {
  it('marks payout failed with a safe error message when Stripe throws a non-Error', async () => {
    const firstManager = {
      findOne: jest.fn().mockResolvedValue({
        userId: 'tutor-1',
        stripeAccountId: 'acct_123',
        stripeOnboardingComplete: true,
        balance: 42,
      }),
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
    const controller = new AdminPaymentsController(
      {} as ConstructorParameters<typeof AdminPaymentsController>[0],
      stripeService as ConstructorParameters<typeof AdminPaymentsController>[1],
      dataSource as ConstructorParameters<typeof AdminPaymentsController>[2],
      {} as ConstructorParameters<typeof AdminPaymentsController>[3],
      { update: jest.fn() } as ConstructorParameters<
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
});
