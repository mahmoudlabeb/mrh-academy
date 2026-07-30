import { BadRequestException } from '@nestjs/common';
import { PaymentMethod, PaymentStatus } from '@mrh/types';
import { StripeWebhookController } from './stripe-webhook.controller';

describe('StripeWebhookController', () => {
  const stripeService = { constructEvent: jest.fn() };
  const paymentsService = {
    approvePayment: jest.fn(),
    completeCourseCheckout: jest.fn(),
    refundStripePayment: jest.fn(),
  };
  const tutorProfileRepository = {
    findOne: jest.fn(),
    update: jest.fn(),
  };
  const paymentRepository = {
    findOne: jest.fn(),
    update: jest.fn(),
  };
  const processedWebhookEventRepository = {
    findOne: jest.fn(),
    insert: jest.fn(),
  };

  let controller: StripeWebhookController;

  beforeEach(() => {
    jest.clearAllMocks();
    processedWebhookEventRepository.findOne.mockResolvedValue(null);
    processedWebhookEventRepository.insert.mockResolvedValue({});
    controller = new StripeWebhookController(
      stripeService as never,
      paymentsService as never,
      tutorProfileRepository as never,
      paymentRepository as never,
      processedWebhookEventRepository as never,
    );
  });

  function checkoutEvent(overrides: Record<string, unknown> = {}) {
    return {
      id: 'evt_checkout_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_1',
          payment_status: 'paid',
          amount_total: 150_000,
          currency: 'egp',
          payment_intent: 'pi_test_1',
          metadata: {
            userId: 'student-1',
            paymentId: 'payment-1',
          },
          ...overrides,
        },
      },
    };
  }

  it('rejects unsigned or malformed events before any business processing', async () => {
    stripeService.constructEvent.mockImplementation(() => {
      throw new Error('Missing stripe signature or webhook secret');
    });

    await expect(controller.handleWebhook({} as never)).rejects.toThrow(
      BadRequestException,
    );
    expect(processedWebhookEventRepository.findOne).not.toHaveBeenCalled();
    expect(paymentsService.approvePayment).not.toHaveBeenCalled();
  });

  it('acknowledges duplicate events without crediting the wallet twice', async () => {
    stripeService.constructEvent.mockReturnValue(checkoutEvent());
    processedWebhookEventRepository.findOne.mockResolvedValue({
      eventId: 'evt_checkout_1',
    });

    await expect(controller.handleWebhook({} as never)).resolves.toEqual({
      received: true,
      skipped: 'duplicate event',
    });
    expect(paymentsService.approvePayment).not.toHaveBeenCalled();
  });

  it('credits a paid top-up only when amount, currency, and owner match', async () => {
    stripeService.constructEvent.mockReturnValue(checkoutEvent());
    paymentRepository.findOne.mockResolvedValue({
      id: 'payment-1',
      userId: 'student-1',
      amount: 1_500,
      currency: 'EGP',
      method: PaymentMethod.CARD,
      status: PaymentStatus.PENDING,
    });

    await expect(controller.handleWebhook({} as never)).resolves.toEqual({
      received: true,
    });
    expect(paymentRepository.update).toHaveBeenCalledWith('payment-1', {
      stripeCheckoutSessionId: 'cs_test_1',
      stripePaymentIntentId: 'pi_test_1',
    });
    expect(paymentsService.approvePayment).toHaveBeenCalledWith(
      'payment-1',
      'stripe-webhook',
    );
    expect(processedWebhookEventRepository.insert).toHaveBeenCalledWith({
      eventId: 'evt_checkout_1',
      eventType: 'checkout.session.completed',
    });
  });

  it('acknowledges but does not credit a mismatched provider currency', async () => {
    stripeService.constructEvent.mockReturnValue(
      checkoutEvent({ currency: 'usd' }),
    );
    paymentRepository.findOne.mockResolvedValue({
      id: 'payment-1',
      userId: 'student-1',
      amount: 1_500,
      currency: 'EGP',
      status: PaymentStatus.PENDING,
    });

    await expect(controller.handleWebhook({} as never)).resolves.toEqual({
      received: true,
      skipped: 'invalid event data',
    });
    expect(paymentsService.approvePayment).not.toHaveBeenCalled();
    expect(processedWebhookEventRepository.insert).toHaveBeenCalled();
  });

  it('routes cumulative Stripe refunds to the idempotent refund service', async () => {
    stripeService.constructEvent.mockReturnValue({
      id: 'evt_refund_1',
      type: 'charge.refunded',
      data: {
        object: {
          id: 'ch_test_1',
          payment_intent: 'pi_test_1',
          amount_refunded: 2_500,
        },
      },
    });
    paymentRepository.findOne.mockResolvedValue({ id: 'payment-1' });

    await controller.handleWebhook({} as never);

    expect(paymentsService.refundStripePayment).toHaveBeenCalledWith(
      'payment-1',
      25,
      'ch_test_1',
    );
  });
});
