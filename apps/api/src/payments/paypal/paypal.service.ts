import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Payment } from '../entities/payment.entity.js';

type PayPalLink = { href?: string; rel?: string };
type PayPalOrder = {
  id?: string;
  links?: PayPalLink[];
  purchase_units?: Array<{
    payments?: {
      captures?: Array<{
        id?: string;
        status?: string;
        amount?: { currency_code?: string; value?: string };
      }>;
    };
  }>;
};

@Injectable()
export class PayPalService {
  constructor(private readonly configService: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(
      this.configService.get<string>('PAYPAL_CLIENT_ID')?.trim() &&
      this.configService.get<string>('PAYPAL_CLIENT_SECRET')?.trim(),
    );
  }

  private get baseUrl(): string {
    return (
      this.configService.get<string>('PAYPAL_BASE_URL')?.trim() ||
      'https://api-m.sandbox.paypal.com'
    ).replace(/\/$/, '');
  }

  private async accessToken(): Promise<string> {
    const clientId = this.configService.get<string>('PAYPAL_CLIENT_ID')?.trim();
    const clientSecret = this.configService
      .get<string>('PAYPAL_CLIENT_SECRET')
      ?.trim();
    if (!clientId || !clientSecret) {
      throw new BadGatewayException('PayPal payments are not configured');
    }
    const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    const body = (await response.json()) as { access_token?: string };
    if (!response.ok || !body.access_token) {
      throw new BadGatewayException('PayPal authentication failed');
    }
    return body.access_token;
  }

  async createOrder(payment: Payment): Promise<{
    orderId: string;
    approvalUrl: string;
  }> {
    const token = await this.accessToken();
    const frontendUrl = (
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000'
    ).replace(/\/$/, '');
    const response = await fetch(`${this.baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `mrh-create-${payment.id}`,
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: payment.id,
            custom_id: payment.id,
            amount: {
              currency_code: payment.currency,
              value: Number(payment.amount).toFixed(2),
            },
          },
        ],
        payment_source: {
          paypal: {
            experience_context: {
              return_url: `${frontendUrl}/student/wallet?paypalPaymentId=${payment.id}`,
              cancel_url: `${frontendUrl}/student/wallet?paypalCancelled=1`,
              user_action: 'PAY_NOW',
            },
          },
        },
      }),
    });
    const order = (await response.json()) as PayPalOrder;
    const approvalUrl = order.links?.find(
      (link) => link.rel === 'payer-action',
    )?.href;
    if (!response.ok || !order.id || !approvalUrl) {
      throw new BadGatewayException('PayPal checkout is currently unavailable');
    }
    return { orderId: order.id, approvalUrl };
  }

  async captureOrder(payment: Payment): Promise<string> {
    if (!payment.paypalOrderId) {
      throw new BadGatewayException('PayPal order is missing');
    }
    const token = await this.accessToken();
    const response = await fetch(
      `${this.baseUrl}/v2/checkout/orders/${encodeURIComponent(payment.paypalOrderId)}/capture`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'PayPal-Request-Id': `mrh-capture-${payment.id}`,
        },
      },
    );
    const order = (await response.json()) as PayPalOrder;
    const capture = order.purchase_units?.[0]?.payments?.captures?.[0];
    if (
      !response.ok ||
      capture?.status !== 'COMPLETED' ||
      !capture.id ||
      capture.amount?.currency_code !== payment.currency ||
      Number(capture.amount?.value) !== Number(payment.amount)
    ) {
      throw new BadGatewayException('PayPal payment could not be verified');
    }
    return capture.id;
  }
}
