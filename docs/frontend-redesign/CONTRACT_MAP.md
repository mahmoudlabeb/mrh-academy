# Contract map

Last updated: 2026-07-30

## Canonical payment states

The payment slice uses:

- `pending`: a provider attempt exists but is not verified
- `succeeded`: the provider verified the payment and fulfillment committed
- `failed`: the provider or server definitively failed the attempt
- `cancelled`: the provider checkout was cancelled or expired
- `partially_refunded`: part of the captured amount was reversed
- `refunded`: the captured amount was fully reversed
- `disputed`: a provider dispute or chargeback is open

`approved` and `rejected` are legacy manual-review payment states and are not
valid for new student payment writes.

## Money units

- Student wallet, course, lesson, tutor share, and platform commission values
  are stored in USD.
- Provider payments retain the original `USD` or `EGP` amount and currency.
- `payments.credited_amount_usd` is the immutable wallet value credited from a
  provider payment.
- EGP is unavailable if the server exchange-rate setting is missing.
- Historical commission values come from `course_enrollments` and `lessons`;
  they must never be recomputed for display.

## Existing and target endpoints

| Capability             | Contract                            | Authority                                                                         |
| ---------------------- | ----------------------------------- | --------------------------------------------------------------------------------- |
| Start wallet funding   | `POST /payments/submit`             | Student; server validates enabled provider, amount, currency, and idempotency key |
| Capture PayPal return  | `POST /payments/paypal/:id/capture` | Owning Student; PayPal Orders API response                                        |
| Stripe callback        | `POST /webhooks/stripe`             | Verified Stripe signature and raw body                                            |
| PayPal callback        | `POST /webhooks/paypal`             | Verified PayPal verification API response                                         |
| Student wallet ledger  | `GET /payments/history`             | Owning Student only                                                               |
| Direct course checkout | `POST /payments/course-checkout`    | Verified Student; Stripe webhook fulfills                                         |
| Wallet course purchase | `POST /courses/:id/enroll`          | Verified Student; locked wallet and idempotency key                               |
| Live-lesson purchase   | `POST /lessons/book`                | Student; locked wallet, slot validation, and idempotency key                      |
| Admin ledger list      | `GET /admin/payments`               | Admin or `manage_payments` SubAdmin                                               |
| Admin ledger details   | `GET /admin/payments/:id`           | Admin or `manage_payments` SubAdmin                                               |

Legacy `POST /admin/payments/:id/approve` and
`POST /admin/payments/:id/reject` are removed for student payments.

## Target financial-event record

Each event has a unique business event key plus:

- transaction type, provider/method, amount, currency, status
- student/user and optional tutor
- provider reference and provider status
- related payment, course, enrollment, lesson/booking, or payout
- recorded admin commission and tutor share
- optional wallet balance before and after
- safe audit metadata only; no provider secrets, tokens, raw payloads,
  receipt object credentials, or idempotency keys are returned to clients

Student history filters by the authenticated `user_id`. Admin list/details
use the protected operations contract. No client-provided amount,
commission, relation, provider status, or final status is authoritative.

## Idempotency keys

- Provider attempt: `payment:<payment id>`
- Course purchase: `course_purchase:<enrollment id>`
- Lesson purchase: `lesson_booking:<lesson id>`
- Lesson cancellation: `lesson_refund:<lesson id>`
- Provider refund: provider event/reference plus payment and cumulative amount
- Provider dispute: verified provider event ID
- Tutor payout: `tutor_payout:<payout id>`
- Platform payout: `platform_payout:<payout id>`

The event key has a database unique constraint. It supplements, rather than
replaces, the existing row locks and domain idempotency constraints.
