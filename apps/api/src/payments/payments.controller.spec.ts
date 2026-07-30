import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { InvoiceService } from './invoice.service';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import { BadRequestException } from '@nestjs/common';

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

  it('passes the original currency into the generated invoice', async () => {
    const payment = {
      id: 'payment-1',
      userId: 'student-1',
      amount: 1_500,
      currency: 'EGP',
      method: 'card',
      status: 'succeeded',
      createdAt: new Date('2026-07-01T00:00:00.000Z'),
      adminNote: null,
      user: { firstName: 'Test', lastName: 'Student' },
    };
    paymentsService.getPayment.mockResolvedValueOnce(payment);
    invoiceService.generateInvoicePdf.mockResolvedValueOnce(
      Buffer.from('%PDF-test'),
    );
    const response = { end: jest.fn() };

    await controller.downloadInvoice(
      'payment-1',
      { id: 'student-1' },
      response as never,
    );

    expect(invoiceService.generateInvoicePdf).toHaveBeenCalledWith(
      expect.objectContaining({
        invoiceId: 'payment-1',
        amount: 1_500,
        currency: 'EGP',
      }),
    );
    expect(response.end).toHaveBeenCalledWith(Buffer.from('%PDF-test'));
  });

  it('prevents one authenticated user from downloading another user invoice', async () => {
    paymentsService.getPayment.mockResolvedValueOnce({
      id: 'payment-1',
      userId: 'student-2',
    });

    await expect(
      controller.downloadInvoice('payment-1', { id: 'student-1' }, {
        end: jest.fn(),
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(invoiceService.generateInvoicePdf).not.toHaveBeenCalled();
  });
});
