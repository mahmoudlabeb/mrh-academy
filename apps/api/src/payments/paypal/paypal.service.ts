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

type PayPalPayoutBatch = {
  batch_header?: {
    payout_batch_id?: string;
    batch_status?: string;
  };
  items?: Array<{
    payout_item_id?: string;
    transaction_status?: string;
    payout_item?: { sender_item_id?: string };
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

  isWebhookConfigured(): boolean {
    return this.isConfigured() && Boolean(this.webhookId);
  }

  private get webhookId(): string {
    return this.configService.get<string>('PAYPAL_WEBHOOK_ID')?.trim() ?? '';
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

  async createOrder(
    payment: Payment,
    returnLocale: 'ar' | 'en' = 'ar',
  ): Promise<{
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
              return_url: `${frontendUrl}/${returnLocale}/learn/wallet?paypalPaymentId=${payment.id}`,
              cancel_url: `${frontendUrl}/${returnLocale}/learn/wallet?paypalCancelled=1`,
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

  async getApprovalUrl(payment: Payment): Promise<string | null> {
    if (!payment.paypalOrderId) return null;
    const token = await this.accessToken();
    const response = await fetch(
      `${this.baseUrl}/v2/checkout/orders/${encodeURIComponent(payment.paypalOrderId)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const order = (await response.json()) as PayPalOrder;
    if (!response.ok) return null;
    return (
      order.links?.find(
        (link) => link.rel === 'payer-action' || link.rel === 'approve',
      )?.href ?? null
    );
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

  async verifyWebhookSignature(
    headers: Record<string, string | string[] | undefined>,
    event: unknown,
  ): Promise<boolean> {
    if (!this.webhookId) {
      throw new BadGatewayException(
        'PayPal webhook verification is not configured',
      );
    }
    const header = (name: string) => {
      const value = headers[name] ?? headers[name.toLowerCase()];
      return Array.isArray(value) ? value[0] : value;
    };
    const token = await this.accessToken();
    const response = await fetch(
      `${this.baseUrl}/v1/notifications/verify-webhook-signature`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          auth_algo: header('paypal-auth-algo'),
          cert_url: header('paypal-cert-url'),
          transmission_id: header('paypal-transmission-id'),
          transmission_sig: header('paypal-transmission-sig'),
          transmission_time: header('paypal-transmission-time'),
          webhook_id: this.webhookId,
          webhook_event: event,
        }),
      },
    );
    const result = (await response.json()) as {
      verification_status?: string;
    };
    return response.ok && result.verification_status === 'SUCCESS';
  }

  async createPayout(
    payout: { id: string; amount: number },
    receiverEmail: string,
  ): Promise<{
    batchId: string;
    itemId: string | null;
    status: string;
  }> {
    const token = await this.accessToken();
    const response = await fetch(`${this.baseUrl}/v1/payments/payouts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `mrh-payout-${payout.id}`,
      },
      body: JSON.stringify({
        sender_batch_header: {
          sender_batch_id: payout.id,
          email_subject: 'You have received an MRH Academy payout',
        },
        items: [
          {
            recipient_type: 'EMAIL',
            receiver: receiverEmail,
            amount: {
              value: Number(payout.amount).toFixed(2),
              currency: 'USD',
            },
            note: 'MRH Academy tutor payout',
            sender_item_id: payout.id,
          },
        ],
      }),
    });
    const created = (await response.json()) as PayPalPayoutBatch;
    const batchId = created.batch_header?.payout_batch_id;
    if (!response.ok || !batchId) {
      throw new BadGatewayException('PayPal payout could not be initiated');
    }

    const detailsResponse = await fetch(
      `${this.baseUrl}/v1/payments/payouts/${encodeURIComponent(batchId)}?fields=items`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const details = detailsResponse.ok
      ? ((await detailsResponse.json()) as PayPalPayoutBatch)
      : created;
    const item = details.items?.find(
      (candidate) => candidate.payout_item?.sender_item_id === payout.id,
    );
    return {
      batchId,
      itemId: item?.payout_item_id ?? null,
      status:
        item?.transaction_status ??
        details.batch_header?.batch_status ??
        created.batch_header?.batch_status ??
        'PENDING',
    };
  }
}
