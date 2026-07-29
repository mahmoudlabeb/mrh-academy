import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { InvoiceService } from './invoice.service';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';

describe('PaymentsController', () => {
  let controller: PaymentsController;
  const paymentsService = {
    submitPayment: jest.fn(),
    getPaymentHistory: jest.fn(),
    getPayment: jest.fn(),
  };
  const invoiceService = {
    generateInvoicePdf: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        { provide: PaymentsService, useValue: paymentsService },
        { provide: InvoiceService, useValue: invoiceService },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        {
          provide: RedisService,
          useValue: { consumeRateLimit: jest.fn().mockResolvedValue(true) },
        },
      ],
    }).compile();

    controller = module.get<PaymentsController>(PaymentsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('bounds payment history pagination parameters', async () => {
    paymentsService.getPaymentHistory.mockResolvedValueOnce([]);

    await controller.getPaymentHistory({ id: 'student-1' }, '2.8', '1000');

    expect(paymentsService.getPaymentHistory).toHaveBeenCalledWith(
      'student-1',
      2,
      100,
    );
  });
});
