import { ConfigService } from '@nestjs/config';
import { InvoiceService } from './invoice.service';

describe('InvoiceService', () => {
  it('generates a non-empty PDF receipt for the original payment currency', async () => {
    const service = new InvoiceService({
      get: jest.fn(() => undefined),
    } as unknown as ConfigService);

    const pdf = await service.generateInvoicePdf({
      invoiceId: 'invoice-sandbox-1',
      studentName: 'Sandbox Student',
      tutorName: 'Sandbox Tutor',
      amount: 1_500,
      currency: 'EGP',
      method: 'card',
      status: 'succeeded',
      createdAt: new Date('2026-07-01T00:00:00.000Z'),
    });

    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
    expect(pdf.length).toBeGreaterThan(500);
  });
});
