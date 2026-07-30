import { BadRequestException } from '@nestjs/common';
import { PayPalWebhookController } from './paypal-webhook.controller';

describe('PayPalWebhookController', () => {
  const payPalService = {
    verifyWebhookSignature: jest.fn(),
  };
  const paymentsService = {
    processPayPalWebhookEvent: jest.fn(),
  };
  const controller = new PayPalWebhookController(
    payPalService as never,
    paymentsService as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('rejects unverified webhook payloads before changing financial state', async () => {
    payPalService.verifyWebhookSignature.mockResolvedValueOnce(false);
    const event = {
      id: 'WH-1',
      event_type: 'PAYMENT.CAPTURE.COMPLETED',
      resource: { id: 'capture-1' },
    };

    await expect(controller.handle({}, event)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(paymentsService.processPayPalWebhookEvent).not.toHaveBeenCalled();
  });

  it('routes a verified event to the transactional idempotent processor', async () => {
    payPalService.verifyWebhookSignature.mockResolvedValueOnce(true);
    paymentsService.processPayPalWebhookEvent.mockResolvedValueOnce({
      received: true,
      duplicate: false,
    });
    const event = {
      id: 'WH-2',
      event_type: 'PAYMENT.CAPTURE.COMPLETED',
      resource: { id: 'capture-2' },
    };

    await expect(controller.handle({}, event)).resolves.toEqual({
      received: true,
      duplicate: false,
    });
    expect(paymentsService.processPayPalWebhookEvent).toHaveBeenCalledWith(
      event,
    );
  });
});
