import { BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Payment } from '../entities/payment.entity.js';
import { PayPalService } from './paypal.service.js';

describe('PayPalService', () => {
  const values: Record<string, string> = {
    PAYPAL_CLIENT_ID: 'client-id',
    PAYPAL_CLIENT_SECRET: 'client-secret',
    PAYPAL_BASE_URL: 'https://api-m.sandbox.paypal.com/',
    FRONTEND_URL: 'https://academy.example.test/',
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
});
