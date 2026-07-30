# Risk register

Last updated: 2026-07-30

| Risk                                                | Mitigation                                                                                                                | Proof                                           |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Duplicate provider delivery double-credits a wallet | Unique provider event IDs, locked payment row, terminal-state no-op, unique ledger event key                              | Provider unit tests and API E2E duplicate cases |
| Success redirect is mistaken for payment proof      | Redirect only initiates a server PayPal capture; Stripe waits for a verified webhook                                      | Controller/provider tests                       |
| A ledger write succeeds while fulfillment fails     | Ledger writes use the same database transaction/manager as balance, enrollment, booking, commission, and reversal changes | Service transaction tests                       |
| Historical `approved` rows disappear                | Migration maps payment `approved` to `succeeded` and `rejected` to `failed`, then backfills ledger entries                | Migration validation and admin list test        |
| Manual student methods reintroduce approval         | API accepts only configured Stripe card and PayPal providers; migration disables manual student funding methods           | Submit-payment tests and browser method test    |
| Provider failure stays misleadingly pending         | Stripe expiration/failure and PayPal denial/cancellation update both payment and ledger terminal state                    | Webhook tests                                   |
| Refund produces negative wallet state               | Existing funding allocation reversal remains authoritative and idempotent; ledger records the resulting delta             | Refund service tests                            |
| Dispute outcome incorrectly restores money          | An open dispute is recorded without client fulfillment; provider refund/reversal remains the balance-adjusting authority  | Webhook dispute tests                           |
| Commission is recomputed in admin UI                | Persisted course/lesson commission and tutor share are copied into the ledger transactionally                             | Course/lesson regression tests                  |
| Student/tutor reads another user’s audit data       | Student history is always scoped by authenticated ID; admin endpoints retain role and permission guards                   | API authorization E2E                           |
| Details UI leaks provider secrets                   | DTO allowlists safe fields and sanitized metadata; raw webhook payloads and credentials are never stored in the ledger    | DTO/controller tests and adversarial search     |
| RTL drawer/table becomes unusable                   | Logical CSS, bidi isolation, focus containment, Escape/return focus, horizontal table region, mobile validation           | Playwright Arabic/English desktop/mobile tests  |
| Real sandbox credentials are unavailable            | Provider services are mocked only in tests; production variables and webhook subscriptions are documented                 | Payment testing guide and config validator      |
