import { PayoutStatus } from '@mrh/types';
import { Payout } from './entities/payout.entity';
import { TutorProfile } from '../tutors/entities/tutor-profile.entity';
import { PayoutReconciliationService } from './payout-reconciliation.service';

describe('PayoutReconciliationService', () => {
  const payoutRepository = { find: jest.fn() };
  const dataSource = {
    getRepository: jest.fn(() => payoutRepository),
    transaction: jest.fn(),
  };
  let service: PayoutReconciliationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PayoutReconciliationService(dataSource as never);
  });

  it('queries only stuck Stripe Connect payouts, leaving manual requests pending', async () => {
    payoutRepository.find.mockResolvedValue([]);

    await service.reconcilePendingPayouts();

    expect(payoutRepository.find).toHaveBeenCalledWith({
      where: {
        status: PayoutStatus.PENDING,
        method: 'stripe_connect',
        createdAt: expect.anything(),
      },
    });
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('rechecks status under lock so concurrent reconcilers cannot refund twice', async () => {
    const stale = {
      id: 'payout-1',
      tutorId: 'tutor-1',
      amount: 100,
      method: 'stripe_connect',
      status: PayoutStatus.PENDING,
    };
    payoutRepository.find.mockResolvedValue([stale]);
    const manager = {
      findOne: jest.fn().mockResolvedValue({
        ...stale,
        status: PayoutStatus.FAILED,
      }),
      save: jest.fn(),
      update: jest.fn(),
    };
    dataSource.transaction.mockImplementation(async (callback) =>
      callback(manager),
    );

    await service.reconcilePendingPayouts();

    expect(manager.findOne).toHaveBeenCalledWith(Payout, {
      where: { id: 'payout-1' },
      lock: { mode: 'pessimistic_write' },
    });
    expect(manager.findOne).not.toHaveBeenCalledWith(
      TutorProfile,
      expect.anything(),
    );
    expect(manager.save).not.toHaveBeenCalled();
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('returns reserved balance once when an abandoned Stripe transfer failed', async () => {
    const stale = {
      id: 'payout-1',
      tutorId: 'tutor-1',
      amount: 100,
      method: 'stripe_connect',
      status: PayoutStatus.PENDING,
      stripePayoutId: null,
    };
    payoutRepository.find.mockResolvedValue([stale]);
    const profile = { userId: 'tutor-1', balance: 25 };
    const manager = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(stale)
        .mockResolvedValueOnce(profile),
      save: jest.fn(),
      update: jest.fn(),
    };
    dataSource.transaction.mockImplementation(async (callback) =>
      callback(manager),
    );

    await service.reconcilePendingPayouts();

    expect(profile.balance).toBe(125);
    expect(manager.save).toHaveBeenCalledWith(TutorProfile, profile);
    expect(manager.update).toHaveBeenCalledWith(
      Payout,
      { id: 'payout-1' },
      {
        status: PayoutStatus.FAILED,
        errorMessage: 'Reconciled: Stripe transfer was never initiated',
      },
    );
  });
});
