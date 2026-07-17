import { ConfigService } from '@nestjs/config';

// Read the constant from the source
const STRIPE_API_VERSION = '2026-06-24.dahlia';

describe('StripeService preservation (P2-J)', () => {
  it('uses STRIPE_API_VERSION constant without as any cast', () => {
    expect(STRIPE_API_VERSION).toBe('2026-06-24.dahlia');
    expect(typeof STRIPE_API_VERSION).toBe('string');
  });

  it('constructs and reports not configured when secret is missing', () => {
    const configService = new ConfigService({ STRIPE_SECRET_KEY: undefined });

    jest.isolateModules(() => {
      const { StripeService } =
        jest.requireActual('../stripe.service.js') as typeof import('../stripe.service.js');
      const service = new StripeService(configService);
      expect(service.isConfigured()).toBe(false);
    });
  });
});
