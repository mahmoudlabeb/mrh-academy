import { BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Payment } from '../entities/payment.entity.js';
import { Payout } from '../entities/payout.entity.js';
import { PayPalService } from './paypal.service.js';

describe('PayPalService', () => {
  const values: Record<string, string> = {
    PAYPAL_CLIENT_ID: 'client-id',
    PAYPAL_CLIENT_SECRET: 'client-secret',
    PAYPAL_BASE_URL: 'https://api-m.sandbox.paypal.com/',
    FRONTEND_URL: 'https://academy.example.test/',
    PAYPAL_WEBHOOK_ID: 'webhook-1',
  };
  const payment = {
    id: 'payment-1',
    amount: 25,
    currency: 'USD',
    paypalOrderId: 'order/1',
  } as Payment;

  const createService = (configValues: Record<string, string> = values) =>
    new PayPalService({
      get: jest.fn((key: string) => configValues[key]),
    } as unknown as ConfigService);

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('refuses PayPal requests when credentials are absent', async () => {
    const service = createService({});

    expect(service.isConfigured()).toBe(false);
    await expect(service.createOrder(payment)).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it('creates orders with stable idempotency and payment references', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'access-token' }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'order-1',
            links: [
              {
                rel: 'payer-action',
                href: 'https://paypal.example.test/approve/order-1',
              },
            ],
          }),
          { status: 200 },
        ),
      );

    await expect(createService().createOrder(payment)).resolves.toEqual({
      orderId: 'order-1',
      approvalUrl: 'https://paypal.example.test/approve/order-1',
    });

    const [, orderRequest] = fetchMock.mock.calls[1];
    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://api-m.sandbox.paypal.com/v2/checkout/orders',
    );
    expect(orderRequest).toEqual(
      expect.objectContaining({
        headers: expect.objectContaining({
          'PayPal-Request-Id': 'mrh-create-payment-1',
        }),
      }),
    );
    expect(JSON.parse(String(orderRequest?.body))).toEqual(
      expect.objectContaining({
        purchase_units: [
          expect.objectContaining({
            reference_id: 'payment-1',
            custom_id: 'payment-1',
          }),
        ],
      }),
    );
  });

  it('accepts only completed captures with the expected amount and currency', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'access-token' }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            purchase_units: [
              {
                payments: {
                  captures: [
                    {
                      id: 'capture-1',
                      status: 'COMPLETED',
                      amount: { currency_code: 'USD', value: '24.99' },
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200 },
        ),
      );

    await expect(createService().captureOrder(payment)).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it('verifies webhook signatures through the authoritative PayPal API', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'access-token' }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ verification_status: 'SUCCESS' }), {
          status: 200,
        }),
      );
    const event = { id: 'WH-1', event_type: 'PAYMENT.CAPTURE.COMPLETED' };

    await expect(
      createService().verifyWebhookSignature(
        {
          'paypal-auth-algo': 'SHA256withRSA',
          'paypal-cert-url': 'https://api.paypal.com/cert',
          'paypal-transmission-id': 'transmission-1',
          'paypal-transmission-sig': 'signature',
          'paypal-transmission-time': '2026-07-30T00:00:00Z',
        },
        event,
      ),
    ).resolves.toBe(true);

    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual(
      expect.objectContaining({
        webhook_id: 'webhook-1',
        webhook_event: event,
        transmission_id: 'transmission-1',
      }),
    );
  });

  it('creates an idempotent PayPal payout and records provider identifiers', async () => {
    const payout = {
      id: 'payout-1',
      amount: 75,
    } as Payout;
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'access-token' }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            batch_header: {
              payout_batch_id: 'batch-1',
              batch_status: 'PENDING',
            },
          }),
          { status: 201 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            batch_header: {
              payout_batch_id: 'batch-1',
              batch_status: 'PENDING',
            },
            items: [
              {
                payout_item_id: 'item-1',
                transaction_status: 'PENDING',
                payout_item: { sender_item_id: 'payout-1' },
              },
            ],
          }),
          { status: 200 },
        ),
      );

    await expect(
      createService().createPayout(payout, 'tutor@example.test'),
    ).resolves.toEqual({
      batchId: 'batch-1',
      itemId: 'item-1',
      status: 'PENDING',
    });

    expect(fetchMock.mock.calls[1][1]).toEqual(
      expect.objectContaining({
        headers: expect.objectContaining({
          'PayPal-Request-Id': 'mrh-payout-payout-1',
        }),
      }),
    );
  });
});
