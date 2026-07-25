# Client Credentials and Final Acceptance

The application is prepared so credentials remain outside the source ZIP. Add
them in the client-owned Vercel/Render/server environment, then run
`node scripts/validate-client-config.mjs`.

## Required production values

| Service      | Required values                                                                                                           | Client-side dashboard action                                                               |
| ------------ | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Core         | `FRONTEND_URL`, `DATABASE_URL`, `JWT_SECRET`, `REDIS_URL`, `ADMIN_EMAILS`, `SUBADMIN_DEFAULT_PASSWORD`, `REFERRAL_SECRET` | Use HTTPS URLs, a production PostgreSQL database, and unique 64+ character secrets.        |
| Web          | `NEXT_PUBLIC_SITE_URL`, `API_UPSTREAM_URL`, `NEXT_PUBLIC_WS_URL`                                                          | Set the final website/API origins.                                                         |
| Google login | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`                                                         | Register `https://API-DOMAIN/api/v1/auth/google/callback`.                                 |
| Google Meet  | `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`, `GOOGLE_CALENDAR_IMPERSONATE_EMAIL`                 | Enable Calendar API and Workspace domain-wide delegation.                                  |
| Facebook     | `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `FACEBOOK_CALLBACK_URL`                                                         | Register `https://API-DOMAIN/api/v1/auth/facebook/callback` and request email permission.  |
| Apple        | `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`, `APPLE_CALLBACK_URL`                             | Create a Services ID and register `https://API-DOMAIN/api/v1/auth/apple/callback`.         |
| Cloudinary   | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`                                                    | Restrict credentials and configure the production media account.                           |
| Bunny        | `BUNNY_API_KEY`, `BUNNY_LIBRARY_ID`, `BUNNY_CDN_HOSTNAME`, `BUNNY_TOKEN_AUTH_KEY`                                         | Enable token authentication/domain restrictions and upload course videos.                  |
| Gemini       | `GEMINI_API_KEY`                                                                                                          | Enable billing/quota for the chosen project.                                               |
| Metered TURN | `METERED_API_KEY`, `METERED_APP_NAME`                                                                                     | Allow the final application origins.                                                       |
| Stripe       | `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`                                                    | Register the Stripe webhook, activate Connect, and finish business verification.           |
| PayPal       | `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_BASE_URL`                                                             | Use sandbox first; switch base URL to `https://api-m.paypal.com` only for live acceptance. |
| SMTP         | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`                                            | Configure SPF/DKIM/DMARC where supported and approve the sender.                           |

For an Apple `.p8` key or Google private key, store line breaks as `\n` when the
hosting provider requires a one-line value.

## Manual payment destinations

In **Admin → Payments**, enter final instructions/destination details and enable:

- Vodafone Cash
- Instapay
- Binance
- Bank transfer

These are receipt-based payment methods. The student submits proof and an
authorized administrator approves or rejects it. No exchange trading key or
automatic cryptocurrency custody is required.

## Final external acceptance actions

- Run database migrations and confirm `/api/v1/health` reports database/Redis up.
- Confirm `/api/v1/health/integrations` reports every intended provider configured.
- Complete one login with Google, Facebook, and Apple.
- Create one real Google Calendar event/Meet link.
- Run one Stripe and PayPal sandbox payment plus refund; repeat with a minimal live amount only when authorized.
- Send verification/reset/lesson emails to a real client inbox.
- Play an enrolled Bunny course video on the final domain and confirm another domain is blocked.
- Run Gemini vocabulary once.
- Run a 15-minute student/tutor classroom call using two physical devices on separate networks.
- Create and approve a tutor, course, course video, training article, and representative student enrolment.
- Verify backup creation and perform one restore drill.
- Rotate any credential previously shared outside the client password manager.

When all checks pass, the client or authorized product owner should sign the
acceptance record below.

**Client representative:** ____________________

**Production domain:** ____________________

**Acceptance date:** ____________________

**Signature:** ____________________
