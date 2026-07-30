import { ConfigService } from '@nestjs/config';
import { StripeService } from './stripe.service';

describe('StripeService payment requests', () => {
  function createService() {
    const config = {
      get: jest.fn((key: string, fallback?: string) => {
        if (key === 'STRIPE_SECRET_KEY') return 'sk_test_fictional';
        if (key === 'FRONTEND_URL') return 'https://academy.example';
        if (key === 'application.platformCurrency') return 'usd';
        return fallback;
      }),
    } as unknown as ConfigService;
    const service = new StripeService(config);
    const create = jest.fn().mockResolvedValue({
      id: 'cs_sandbox_1',
      url: 'https://checkout.stripe.test/cs_sandbox_1',
    });
    (
      service as unknown as {
        stripe: { checkout: { sessions: { create: typeof create } } };
      }
    ).stripe = { checkout: { sessions: { create } } };
    return { service, create };
  }

  it('uses the selected EGP currency and stable payment metadata', async () => {
    const { service, create } = createService();

    await service.createCheckoutSession('student-1', 1_500, 'payment-1', 'EGP');

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [
          expect.objectContaining({
            price_data: expect.objectContaining({
              currency: 'egp',
              unit_amount: 150_000,
            }),
          }),
        ],
        client_reference_id: 'payment-1',
        metadata: {
          userId: 'student-1',
          paymentId: 'payment-1',
          currency: 'EGP',
        },
      }),
    );
  });

  it('rounds USD amounts to provider minor units', async () => {
    const { service, create } = createService();

    await service.createCheckoutSession(
      'student-1',
      10.235,
      'payment-1',
      'USD',
    );

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [
          expect.objectContaining({
            price_data: expect.objectContaining({
              currency: 'usd',
              unit_amount: 1_024,
            }),
          }),
        ],
      }),
    );
  });
});
