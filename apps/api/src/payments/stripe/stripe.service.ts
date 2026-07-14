import { Injectable, RawBodyRequest } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { Request } from 'express';
import { PLATFORM_CURRENCY } from '../../common/currency.util.js';

const STRIPE_API_VERSION = '2026-06-24.dahlia';

@Injectable()
export class StripeService {
  private stripe: Stripe;
  private readonly secret?: string;

  constructor(private readonly configService: ConfigService) {
    this.secret = this.configService.get<string>('STRIPE_SECRET_KEY');
    this.stripe = new Stripe(this.secret || 'sk_test_placeholder', {
      apiVersion: STRIPE_API_VERSION,
    });
  }

  isConfigured() {
    return Boolean(this.secret);
  }

  async createCheckoutSession(
    userId: string,
    amount: number,
    paymentId: string,
  ) {
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';

    // Convert USD to cents
    const amountInCents = Math.round(amount * 100);

    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: PLATFORM_CURRENCY,
            product_data: {
              name: 'Mr.H Academy Balance',
              description: `Add $${amount} to your student balance`,
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${frontendUrl}/student?payment_success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/student?payment_cancelled=true`,
      client_reference_id: paymentId,
      metadata: {
        userId,
        paymentId,
      },
    });

    return session;
  }

  // ─── Stripe Connect ──────────────────────────────────────────────────

  async createConnectedAccount(tutorEmail: string): Promise<Stripe.Account> {
    return this.stripe.accounts.create({
      type: 'express',
      email: tutorEmail,
      capabilities: {
        transfers: { requested: true },
      },
      business_type: 'individual',
    });
  }

  async generateOnboardingLink(accountId: string): Promise<string> {
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const link = await this.stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${frontendUrl}/tutor?connect_refresh=true`,
      return_url: `${frontendUrl}/tutor?connect_success=true`,
      type: 'account_onboarding',
    });
    return link.url;
  }

  async retrieveAccount(accountId: string): Promise<Stripe.Account> {
    return this.stripe.accounts.retrieve(accountId);
  }

  async createPayout(
    accountId: string,
    amountCents: number,
    idempotencyKey?: string,
  ): Promise<Stripe.Transfer> {
    return this.stripe.transfers.create(
      {
        amount: amountCents,
        currency: PLATFORM_CURRENCY,
        destination: accountId,
      },
      idempotencyKey ? { idempotencyKey } : undefined,
    );
  }

  constructEvent(req: RawBodyRequest<Request>) {
    const signature = req.headers['stripe-signature'];
    const webhookSecret = this.configService.get<string>(
      'STRIPE_WEBHOOK_SECRET',
    );

    if (!signature || !webhookSecret) {
      throw new Error('Missing stripe signature or webhook secret');
    }

    if (!req.rawBody) {
      throw new Error('Missing raw body');
    }

    return this.stripe.webhooks.constructEvent(
      req.rawBody,
      signature,
      webhookSecret,
    );
  }
}
