# Payment Testing Evidence

Last verified: 2026-07-30

## Safety boundary

- Provider calls are mocked or routed to fictional sandbox URLs.
- Browser payment tests intercept every payment request and use synthetic
  `.example` identities and in-memory receipt bytes.
- No production/shared database was used. The configured `DATABASE_URL` does
  not identify a disposable test database, so the database-backed API E2E
  suite was deliberately not pointed at it.
- The browser fixture setup independently refuses database names that do not
  contain `test` or `e2e`.

## Repeatable commands

```powershell
# Unit/smoke coverage for payment, lesson, course, commission, and payout code
pnpm.cmd --filter @mrh/api exec jest --runInBand src/payments src/lessons/lessons.service.spec.ts src/lessons/__tests__/book-lesson-b1-bug.spec.ts src/lessons/__tests__/book-lesson-b1-preserve.spec.ts src/courses/courses.service.spec.ts src/admin/__tests__/admin-payments.phase2.spec.ts

# Route-isolated production-build browser smoke tests
pnpm.cmd --filter @mrh/web build
pnpm.cmd --filter @mrh/web test:e2e:safe

# Type and build checks
pnpm.cmd --filter @mrh/api typecheck
pnpm.cmd --filter @mrh/web typecheck
pnpm.cmd --filter @mrh/api build

# Database integration suite — only with a disposable PostgreSQL database
$env:DATABASE_URL = 'postgresql://user:password@localhost:5432/mrh_payments_e2e'
pnpm.cmd --filter @mrh/api test:payments:e2e

# Stateful browser journey (PayPal, multi-hour booking, classroom, course)
pnpm.cmd --filter @mrh/web exec playwright test e2e/paid-learning-flow.mock.spec.ts --config=playwright.mock.config.ts
```

Convenience commands are also available as `test:payments:smoke`,
`test:payments:integration`, and `test:payments:e2e` in the root package.

## Executed evidence

| Layer | Result | Evidence |
| --- | --- | --- |
| API unit and service regression suite | PASS | 38 suites, 225 tests |
| Web unit regression suite | PASS | 3 suites, 30 tests |
| Production API and web builds | PASS | Nest build and 129-page Next static generation completed |
| Route-isolated browser suite | PASS | 32 desktop/mobile tests, including the stateful paid-learning journey and classroom denial states |
| API type check | PASS | `tsc --noEmit` |
| Web type check | PASS | `tsc --noEmit` |
| Database-backed API integration | NOT RUN | Configured database is `neondb`, not a disposable test/e2e database; local PostgreSQL is available but no local test credentials are configured |

## Flow coverage matrix

| Flow | Automated evidence |
| --- | --- |
| Live-lesson payment | Atomic balance verification, idempotent booking retry, completion, tutor earnings, commission thresholds, and cancellation/refund service regressions |
| Course purchase | Verified-student direct checkout, price validation, referral commission split, FIFO wallet funding, enrollment idempotency, and guest/anonymous checkout denial |
| Wallet/add funds | Card remains pending until webhook confirmation; PayPal remains pending until verified capture/webhook; USD and EGP wallet crediting; refresh/retry resumes the same provider request without balance mutation on submission |
| Guest checkout | Current policy is covered explicitly: anonymous course checkout is rejected and the UI requires a verified student account; abandoned placeholder cleanup remains covered for legacy rows |
| Commissions and tutor earnings | Lesson fee tiers, course tutor/academy rates, decimal rounding, earning release, and separate tutor-course aggregation |
| Payouts | Locked reservation, idempotency keys, tutor PayPal payout creation, admin commission PayPal payout ledger, verified payout webhooks, failed-delivery balance restoration, Stripe rollback/transfer, and crash reconciliation |
| Manual payments | Enabled-method/destination checks, required receipt, MIME/signature validation, fictional storage upload, pending state, admin approval/rejection |
| Receipts and invoices | Receipt rendering/link state, PDF smoke generation, original currency, ownership authorization |
| Refunds and cancellations | Cumulative Stripe refund idempotency, course access revocation, commission reversal, wallet reversal, and lesson cancellation refund state |
| Failures and retries | Stripe session creation cleanup, PayPal verification failure, safe retry records, failed payout rollback, malformed/unsigned webhook rejection |
| Duplicate webhooks and idempotency | Transactional processed-event ledger, duplicate acknowledgement, row locks, approved-payment no-op, PayPal capture no-op, required API idempotency keys, and resumable provider setup |
| Authorization | Student-only checkout/top-up/history, invoice ownership, tutor-only payout, admin payment permissions, anonymous checkout denial |
| Currency handling | Provider currency match, minor-unit rounding, immutable USD wallet value, EGP preview conversion, original-currency history/invoice display, refund conversion |

## PayPal sandbox configuration

Set these values in `apps/api/.env` and configure the webhook URL as
`https://<api-host>/api/v1/webhooks/paypal`:

```dotenv
PAYPAL_CLIENT_ID=<sandbox REST app client id>
PAYPAL_CLIENT_SECRET=<sandbox REST app secret>
PAYPAL_WEBHOOK_ID=<sandbox webhook id>
PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com
```

Subscribe the webhook to checkout order/capture events, capture refund and
reversal events, customer dispute events, and all
`PAYMENT.PAYOUTS-ITEM.*` state changes. Wallet and purchase tests mock these
provider calls; a real sandbox smoke test still requires PayPal sandbox buyer,
merchant, and payout receiver accounts.

## Defects found and fixed

1. **EGP Stripe overcharge risk:** an EGP top-up was persisted as EGP but the
   Stripe session used the platform currency. Stripe now receives the selected
   currency, and webhooks reject currency mismatches.
2. **Mixed-currency wallet accounting:** EGP deposits, course allocations, and
   refunds mixed provider units with USD wallet units. Payments now retain an
   immutable `creditedAmountUsd`; a migration backfills safe USD history.
3. **Manual payouts auto-failed:** reconciliation treated old manual requests
   as abandoned Stripe transfers. It now scopes to `stripe_connect` and
   rechecks the payout under a write lock to prevent double refunds.
4. **Incorrect EGP UI preview:** 1,500 EGP displayed as a $1,500 wallet
   increase. The preview now uses the server exchange rate, the confirmation
   retains EGP, and EGP is disabled when no rate is configured.
5. **Invoice currency loss:** generated invoices always showed `$`; invoices
   now display the payment's original currency.
6. **E2E teardown masking startup errors:** payment E2E teardown now tolerates
   an app that failed before initialization, preserving the real database
   connection error.

## Remaining acceptance step

Provision an empty PostgreSQL database whose name contains `test` or `e2e`,
run migrations, and execute `pnpm.cmd --filter @mrh/api
test:payments:e2e`. This is intentionally the only unexecuted layer; using the
currently configured non-test database would violate the disposable-data
requirement.
