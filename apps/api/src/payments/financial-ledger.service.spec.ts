import { FinancialLedgerStatus, FinancialTransactionType } from '@mrh/types';
import { FinancialLedgerEntry } from './entities/financial-ledger-entry.entity';
import { FinancialLedgerService } from './financial-ledger.service';

describe('FinancialLedgerService', () => {
  const query = {
    leftJoinAndSelect: jest.fn(),
    orderBy: jest.fn(),
    addOrderBy: jest.fn(),
    skip: jest.fn(),
    take: jest.fn(),
    andWhere: jest.fn(),
    getManyAndCount: jest.fn(),
  };
  const repository = {
    createQueryBuilder: jest.fn(() => query),
    findOne: jest.fn(),
    find: jest.fn(),
  };
  const service = new FinancialLedgerService(repository as never);

  beforeEach(() => {
    jest.clearAllMocks();
    for (const method of [
      'leftJoinAndSelect',
      'orderBy',
      'addOrderBy',
      'skip',
      'take',
      'andWhere',
    ] as const) {
      query[method].mockReturnValue(query);
    }
    query.getManyAndCount.mockResolvedValue([[], 0]);
  });

  it('does not create a second row for the same provider event key', async () => {
    const existing = {
      id: 'ledger-1',
      eventKey: 'payment:payment-1',
    } as FinancialLedgerEntry;
    const scopedRepository = {
      findOne: jest.fn().mockResolvedValue(existing),
      create: jest.fn(),
      save: jest.fn(),
    };
    const manager = {
      getRepository: jest.fn().mockReturnValue(scopedRepository),
    };

    await expect(
      service.record(manager as never, {
        eventKey: 'payment:payment-1',
        transactionType: FinancialTransactionType.WALLET_TOP_UP,
        status: FinancialLedgerStatus.SUCCEEDED,
        provider: 'stripe',
        method: 'card',
        amount: 25,
        currency: 'USD',
      }),
    ).resolves.toBe(existing);

    expect(scopedRepository.findOne).toHaveBeenCalledWith({
      where: { eventKey: 'payment:payment-1' },
      lock: { mode: 'pessimistic_write' },
    });
    expect(scopedRepository.create).not.toHaveBeenCalled();
    expect(scopedRepository.save).not.toHaveBeenCalled();
  });

  it('maps admin failed filters to failed and cancelled provider outcomes', async () => {
    await service.list({
      page: 2,
      limit: 25,
      status: 'failed',
      method: 'stripe',
      search: 'student@example.test',
    });

    expect(query.skip).toHaveBeenCalledWith(25);
    expect(query.take).toHaveBeenCalledWith(25);
    expect(query.andWhere).toHaveBeenCalledWith(
      'entry.status IN (:...statuses)',
      {
        statuses: [
          FinancialLedgerStatus.FAILED,
          FinancialLedgerStatus.CANCELLED,
        ],
      },
    );
    expect(query.andWhere).toHaveBeenCalledWith(
      '(entry.method = :method OR entry.provider = :method)',
      { method: 'stripe' },
    );
    expect(query.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('user.email ILIKE :search'),
      { search: '%student@example.test%' },
    );
  });

  it('scopes wallet history to the authenticated student id', async () => {
    repository.find.mockResolvedValue([]);

    await service.getStudentHistory('student-1', 3, 10);

    expect(repository.find).toHaveBeenCalledWith({
      where: { userId: 'student-1' },
      relations: { course: true, lesson: true },
      order: { occurredAt: 'DESC', createdAt: 'DESC' },
      skip: 20,
      take: 10,
    });
  });
});
