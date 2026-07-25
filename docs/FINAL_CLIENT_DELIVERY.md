# MRH Academy — Final Client Delivery Status

**Prepared:** 25 July 2026

**Delivery state:** source-code complete and credential-ready

**Final acceptance:** requires the client actions listed below

## Completed for delivery

- Student, tutor, administrator, and SubAdmin application flows.
- Booking, scheduling, balance charging, cancellation/refund rules, commissions,
  tutor earnings, classroom, chat, whiteboard, video/audio, courses, enrolment,
  course approval, tutor applications, messaging, reviews, reports, legal pages,
  training articles, notifications, bilingual layouts, themes, and responsive UI.
- Stripe card payments, Stripe Connect, signed webhooks, refunds, PayPal Orders
  create/capture verification, and manual payment proof/approval.
- Manual Vodafone, Instapay, Binance, and bank-transfer methods use the same
  normalized identifiers throughout the API, database migration, and web UI.
- Google, Facebook, and Apple login implementations. Each provider is safely
  unavailable until its credentials and callback URL are supplied.
- Google Calendar/Meet, Bunny video, Cloudinary, Gemini, Metered TURN, SMTP,
  Stripe, and PayPal are configuration-gated and visible in the integrations
  health endpoint.
- Corporate Training public page, navigation/footer link, sitemap entry,
  Arabic/English copy, RTL/LTR, light/dark theme, and responsive layouts.
- Production `.env.example` templates for both applications.
- Client configuration validator and secret-safe ZIP packaging command.
- Database migration `AddSocialLoginIdentities1784505609000` adds Facebook/Apple
  identities and normalizes old manual-payment configuration values.

## Verification completed

| Check | Result |
| --- | --- |
| Repository lint | Passed |
| TypeScript checks | Passed |
| API unit tests | 21 suites passed; 126 tests passed |
| Production build | Passed; API compiled and 36 web routes generated |
| Corporate Training design evaluation | Passed at desktop, tablet, and mobile sizes |
| Secret scan | Passed; no detected credentials included in source files |
| Whitespace/diff check | Passed |

The API end-to-end suite was also started. It connected to the configured Neon
database and stopped because that external database has not yet received the new
social-identity migration. The database was intentionally not changed while
building the client ZIP. After the client selects the production/test database,
run the migration command below and rerun the end-to-end suite.

## Client-only actions

1. Copy `apps/api/.env.example` to `apps/api/.env` and
   `apps/web/.env.example` to `apps/web/.env.local`.
2. Add client-owned credentials and final URLs using
   `docs/CLIENT_CREDENTIALS_AND_ACCEPTANCE.md`.
3. Validate without printing secret values:

   ```powershell
   node scripts/validate-client-config.mjs
   ```

4. Apply the migration to the explicitly selected database:

   ```powershell
   pnpm --filter @mrh/api migration:run
   ```

5. Run final database-backed checks:

   ```powershell
   pnpm --filter @mrh/api test:e2e
   ```

6. Complete provider dashboard callbacks/webhooks, one controlled
   payment/refund, real-inbox email delivery, Bunny domain restriction, and the
   two-device classroom test.
7. Sign the acceptance section in
   `docs/CLIENT_CREDENTIALS_AND_ACCEPTANCE.md`.

No developer should claim to have completed those external approvals without
the client credentials, provider accounts, selected database, physical devices,
and authorized live transaction.
