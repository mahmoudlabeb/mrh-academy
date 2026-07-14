import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { InvoiceService } from './invoice.service';
import { ConfigService } from '@nestjs/config';

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
      ],
    }).compile();

    controller = module.get<PaymentsController>(PaymentsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
