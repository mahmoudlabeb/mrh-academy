# Repository audit

Last updated: 2026-07-30

## Scope and authority

The repository does not contain the expected
`docs/frontend-redesign/FRONTEND_REDESIGN_SPEC.md`. For the payment-ledger
slice, the 2026-07-30 user acceptance criteria are the governing
specification. This audit is intentionally limited to:

- `/ar/ops/money/payments` and its English equivalent
- student wallet funding and history
- Stripe and PayPal confirmation/webhooks
- wallet-funded and Stripe-funded course purchases
- wallet-funded live-lesson bookings
- refunds, disputes, commissions, tutor payouts, and platform payouts

Tutor applications, course publication approval, reviews, and non-financial
operations queues are not part of this slice.

## Repository and runtime

- Package manager: pnpm 11 (`pnpm-lock.yaml`, root `packageManager`)
- Task runner: Turborepo 2.10
- Runtime: Node.js 24 or newer
- Web: Next.js 15.5.19, React 19.1, TanStack Query 5.101
- API: NestJS 11, TypeORM 0.3.31, PostgreSQL
- Shared contracts: `packages/types`
- API tests: Jest unit and PostgreSQL E2E
- Browser tests: Playwright, including isolated mock-provider journeys

The initial worktree contained unrelated deleted files under
`dogfood-output/`. They are not part of this slice and must remain untouched.

## Existing route and authorization boundary

- The operations route is
  `apps/web/src/app/[locale]/ops/money/payments/page.tsx`.
- It renders the legacy `apps/web/src/app/admin/components/PaymentsTab.tsx`.
- The operations shell permits Admin and SubAdmin roles. The API additionally
  requires `manage_payments`; full Admin bypasses assigned-permission checks.
- `GET /api/v1/admin/payments` is protected by JWT, role, session,
  maintenance, and permission guards.
- Student payment history is protected by the Student role and scoped to the
  authenticated user ID.

## Existing money authority

- Wallet balances, course prices, lesson prices, exchange rates, commissions,
  refunds, and final payment states are calculated on the API.
- Stripe wallet and course checkout completion is webhook-authoritative.
- PayPal wallet credit is created only after a server-side capture call or a
  verified PayPal webhook.
- `processed_webhook_events.event_id` is unique. Payment rows, enrollment
  idempotency keys, lesson idempotency keys, and funding-allocation unique
  constraints provide additional duplicate protection.
- Wallet purchases allocate confirmed deposits FIFO so provider refunds can
  identify affected enrollments and lessons.

## Defects and gaps found before editing

1. The operations UI is a legacy manual-review table. It exposes Approve,
   Reject, rejection-reason, and approval-only filters for student payments.
2. The admin endpoint returns only `payments` rows. Wallet-funded course
   purchases, lesson bookings, cancellations, commission allocations,
   disputes, refunds, tutor payouts, and platform payouts are stored
   elsewhere and are absent from the page.
3. There is no unified, immutable financial event table. A student top-up row
   doubles as deposit history, while purchases and reversals use unrelated
   domain tables.
4. Payment status still uses `approved`/`rejected`, conflating verified
   provider success with an admin moderation decision.
5. Manual transfer methods can be enabled for student wallet funding and
   depend on admin approval, conflicting with the governing requirement.
6. Stripe handles checkout success and refunds, but not checkout expiration,
   async failure, payment-intent failure, or dispute lifecycle events.
7. The current admin DTO omits provider reference, payment type, related
   course/lesson, commission, tutor share, provider status, update time, and
   safe audit details.
8. The current table has no real error/retry state and its receipt overlay
   lacks complete dialog focus behavior.
9. The frontend operations shell does not hide the payments entry from a
   SubAdmin lacking `manage_payments`; the API does reject the request.

## Existing test surface

- Payment service/provider unit tests:
  `apps/api/src/payments/**/*.spec.ts`
- Course and lesson financial tests:
  `apps/api/src/courses/courses.service.spec.ts` and
  `apps/api/src/lessons/lessons.service.spec.ts`
- Database-backed flow:
  `apps/api/test/payments.e2e-spec.ts`
- Wallet/provider browser flows:
  `apps/web/e2e/payment-smoke.spec.ts` and
  `apps/web/e2e/paid-learning-flow.mock.spec.ts`

The database-backed suite must only run against a disposable database whose
name contains `test` or `e2e`.
