# Implementation ledger

## Payment audit ledger and automatic fulfillment

Status: in progress  
Governing request: 2026-07-30 payment-ledger acceptance criteria  
Routes: `/ar/ops/money/payments`, `/en/ops/money/payments`,
`/{locale}/learn/wallet`, `/{locale}/learn/wallet/add`

### Roles and permissions

- Student: start configured provider funding, capture own PayPal order, read
  only own wallet events, purchase own course/lesson
- Tutor: read only own earnings/payout history; no student payment access
- Admin: read all safe payment audit entries and details
- SubAdmin: same only with server-issued `manage_payments`
- Visitor/other roles: no protected financial data

### Canonical states and visible terminology

- Paid / Succeeded — `مدفوعة / ناجحة`
- Pending provider confirmation — `بانتظار تأكيد مزوّد الدفع`
- Failed — `فشلت`
- Refunded — `مستردة`
- Disputed / Chargeback — `متنازع عليها / استرداد قسري`

No student-payment Approve, Reject, waiting-for-admin, or waiting-for-tutor
action is permitted.

### Slice plan

1. Add a durable, unique-key financial event ledger and migrate/backfill
   existing provider payments, course sales, lessons, and payouts.
2. Rename student payment success from `approved` to `succeeded`; remove
   manual student funding and admin approval/rejection contracts.
3. Write/update ledger entries in the same transactions as provider
   confirmation, wallet balance, enrollment, lesson, commission, refund,
   dispute, and payout changes.
4. Replace the legacy operations table with server filters, complete columns,
   error/retry/empty/loading states, and a keyboard-safe details drawer.
5. Return the same owned ledger events to student wallet history.
6. Add provider/idempotency/fulfillment/authorization/API/browser regressions.
7. Run format, lint, typecheck, focused tests, full unit suites, disposable
   database E2E when safe, build, and relevant Playwright journeys.

### Interaction budget

- Filter ledger: one deliberate action
- Open details: one deliberate action
- Close details: one action or Escape, with focus returned
- Retry a failed read: one deliberate action
- Start provider checkout: one explicit confirmation after reviewing method,
  amount, currency, and wallet consequence

### State coverage

- Loading, first-use empty, filtered empty, request error, retry
- Pending provider confirmation, succeeded, failed/cancelled
- partially/full refunded, dispute/chargeback
- unauthorized/forbidden and expired-session API behavior
- direct route, refresh, Back/Forward, Arabic RTL, English LTR, light/dark,
  mobile/desktop, keyboard, reduced motion, forced colours

### Proof gates

- [ ] API/provider/service unit regressions
- [ ] API E2E: PayPal and Stripe top-up, duplicates, failure, course, lesson,
      refund, admin filtering/details, authorization, removed endpoints
- [ ] Web unit/type tests
- [ ] Playwright: records, filters, details drawer, no approval workflow,
      matching student/admin transaction
- [ ] API/web lint and typecheck
- [ ] API/web build
- [ ] Browser matrix evidence
- [ ] Secret scan for delivery/config changes

### Non-goals

- Tutor onboarding approval, course publication approval, and review queues
- Replacing Stripe or PayPal provider SDK/API integrations
- Storing raw provider payloads or secret-bearing evidence
- Automatically approving manual tutor payout methods
