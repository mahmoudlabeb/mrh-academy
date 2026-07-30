import {
  Injectable,
  RawBodyRequest,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { Request } from 'express';

const STRIPE_API_VERSION = '2026-06-24.dahlia';

@Injectable()
export class StripeService implements OnModuleInit {
  private readonly logger = new Logger(StripeService.name);
  private stripe: Stripe;
  private readonly secret?: string;
  private readonly currency: string;

  constructor(private readonly configService: ConfigService) {
    this.secret = this.configService.get<string>('STRIPE_SECRET_KEY');
    this.currency = this.configService.get<string>(
      'application.platformCurrency',
      'usd',
    );
    this.stripe = new Stripe(this.secret || 'sk_test_placeholder', {
      apiVersion: STRIPE_API_VERSION,
    });
  }

  onModuleInit() {
    if (!this.isConfigured()) {
      this.logger.warn(
        'STRIPE_SECRET_KEY is not configured. Stripe payments and payouts will be disabled.',
      );
    }
  }

  isConfigured() {
    return Boolean(this.secret);
  }

  async createCheckoutSession(
    userId: string,
    amount: number,
    paymentId: string,
    currency: 'USD' | 'EGP',
    returnLocale: 'ar' | 'en' = 'ar',
  ) {
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';

    // Both supported currencies use two decimal minor units.
    const amountInCents = Math.round(amount * 100);
    const providerCurrency = currency.toLowerCase();
    const currencySymbol = currency === 'EGP' ? 'EGP ' : '$';

    const session = await this.stripe.checkout.sessions.create(
      {
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: providerCurrency,
              product_data: {
                name: 'Mr.H Academy Balance',
                description: `Add ${currencySymbol}${amount} to your student balance`,
              },
              unit_amount: amountInCents,
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${frontendUrl}/${returnLocale}/learn/wallet?stripe=pending`,
        cancel_url: `${frontendUrl}/${returnLocale}/learn/wallet?stripe=cancelled`,
        client_reference_id: paymentId,
        metadata: {
          userId,
          paymentId,
          currency,
        },
        payment_intent_data: {
          metadata: {
            userId,
            paymentId,
            currency,
          },
        },
      },
      { idempotencyKey: `mrh-wallet-${paymentId}` },
    );

    return session;
  }

  async createCourseCheckoutSession(input: {
    userId: string;
    paymentId: string;
    courseId: string;
    courseTitle: string;
    amount: number;
    email: string;
    referralCode?: string;
    idempotencyKey: string;
    returnLocale: 'ar' | 'en';
  }) {
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';

    return this.stripe.checkout.sessions.create(
      {
        payment_method_types: ['card'],
        customer_email: input.email,
        line_items: [
          {
            price_data: {
              currency: this.currency,
              product_data: {
                name: input.courseTitle,
                description: 'MRH Academy course access',
              },
              unit_amount: Math.round(input.amount * 100),
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${frontendUrl}/${input.returnLocale}/courses/${input.courseId}?payment=pending`,
        cancel_url: `${frontendUrl}/${input.returnLocale}/courses/${input.courseId}?payment=cancelled`,
        client_reference_id: input.paymentId,
        metadata: {
          checkoutType: 'course',
          userId: input.userId,
          paymentId: input.paymentId,
          courseId: input.courseId,
          referralCode: input.referralCode ?? '',
        },
      },
      { idempotencyKey: `mrh-course-${input.idempotencyKey}` },
    );
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
    if (!this.isConfigured()) {
      throw new Error('Stripe is not configured. Cannot create payout.');
    }
    return this.stripe.transfers.create(
      {
        amount: amountCents,
        currency: this.currency,
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
