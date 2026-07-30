# Payment verification and test evidence

Last updated: 2026-07-30

## Trust boundary

Student wallet funding supports Stripe/card and PayPal. A browser redirect,
query parameter, or client request never marks a payment successful. Stripe
success is accepted only after signature-verified webhook processing; PayPal
success is accepted only after server-side capture retrieval or a
signature-verified webhook.

Every provider event has a unique event key. Payment fulfillment and its
financial ledger entry are committed with the associated wallet, enrollment,
booking, commission, or reversal changes. Provider retries and browser
refreshes therefore do not credit or fulfill twice.

The unified `financial_ledger_entries` table is the admin audit source and the
owned student wallet-history source. It stores safe normalized fields and
selected metadata, not API credentials, signatures, access tokens, card data,
or raw provider payloads.

## Production provider configuration

Configure these values in `apps/api/.env`:

```dotenv
FRONTEND_URL=https://academy.example

STRIPE_SECRET_KEY=<Stripe secret key>
STRIPE_PUBLISHABLE_KEY=<Stripe publishable key>
STRIPE_WEBHOOK_SECRET=<Stripe endpoint signing secret>

PAYPAL_CLIENT_ID=<PayPal REST application client id>
PAYPAL_CLIENT_SECRET=<PayPal REST application secret>
PAYPAL_WEBHOOK_ID=<PayPal webhook id>
PAYPAL_BASE_URL=https://api-m.paypal.com
```

Use `https://api-m.sandbox.paypal.com` and sandbox credentials outside
production. Configure these HTTPS endpoints in the provider dashboards:

- Stripe: `POST /api/v1/webhooks/stripe`
- PayPal: `POST /api/v1/webhooks/paypal`

Stripe subscriptions must include checkout completion/failure, payment-intent
failure, refunds, and dispute lifecycle events used by the controller. PayPal
subscriptions must include order/capture completion and denial, capture
refund/reversal, dispute events, and `PAYMENT.PAYOUTS-ITEM.*` events.

## Automated test mode

Provider-facing API E2E tests replace only the Stripe/PayPal network adapters
with deterministic sandbox doubles. Requests still pass through the real
controllers, authentication, database transactions, row locks, processed-event
idempotency, wallet/enrollment/booking mutations, and ledger queries. Browser
tests intercept the same public contracts with fictional `.example` identities.

No production credentials or production data are required. Never point the
database-backed suite at a shared or production database.

## Repeatable commands

```bash
# Unit, lint, types, and builds
pnpm --filter @mrh/api test
pnpm --filter @mrh/api lint
pnpm --filter @mrh/api typecheck
pnpm --filter @mrh/api build
pnpm --filter @mrh/web test:run
pnpm --filter @mrh/web lint
pnpm --filter @mrh/web typecheck
pnpm --filter @mrh/web build

# Payment API integration tests: requires an empty disposable PostgreSQL DB
DATABASE_URL=postgresql://user:password@localhost:5432/mrh_payments_e2e \
  pnpm --filter @mrh/api test:payments:e2e

# Provider-confirmed wallet and admin-ledger browser journeys
pnpm --filter @mrh/web exec playwright test \
  e2e/payment-smoke.spec.ts \
  e2e/paid-learning-flow.mock.spec.ts \
  e2e/admin-payment-ledger.mock.spec.ts \
  --config=playwright.mock.config.ts
```

## Regression coverage

| Area             | Covered behavior                                                                                                            |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Wallet funding   | Stripe and PayPal confirmation credits once and creates matching student/admin ledger records                               |
| Provider retry   | Duplicate Stripe and PayPal events acknowledge without a second balance or ledger mutation                                  |
| Failure          | Failed or cancelled provider payments do not credit the wallet and remain auditable                                         |
| Course purchase  | Enrollment, tutor share, admin commission, allocation, and ledger entry commit together                                     |
| Lesson booking   | Confirmed booking, tutor share, admin commission, wallet debit, and ledger entry commit together                            |
| Reversal         | Refund, cancellation, dispute, chargeback, and payout reversal adjust domain balances/states and append audit events        |
| Authorization    | Admin or permitted subadmin can list/filter/view; students see only owned history; tutors cannot read other users' payments |
| Removed workflow | Student-payment approval/rejection endpoints return 404 and no approval action or label is rendered                         |
| Browser UX       | Arabic RTL records, filters, responsive table, loading/empty/error/retry states, and keyboard-safe details drawer           |

## Local verification limitation

At the last verification pass, the repository's configured PostgreSQL endpoint
at `localhost:55432` was not listening. Docker was installed but its daemon
could not be started without host privileges, and no standalone PostgreSQL
server was available. The database-backed API E2E suite and migration execution
must therefore be rerun after provisioning the disposable database above. This
is an environment limitation, not authorization to use a shared database.
