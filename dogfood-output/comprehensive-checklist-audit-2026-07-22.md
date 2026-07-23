# MRH Academy — Comprehensive Requirements Audit

Date: 2026-07-22

## Verdict

The project is **not ready to be declared complete**. The NestJS/Next.js/PostgreSQL migration is real and many core workflows exist, but the audit found confirmed financial, permissions, design, setup, security, and deployment failures. Several third-party and multi-device requirements have code scaffolding only and cannot be certified.

Legend: ✅ verified; 🟡 partial/code present but not fully proven; ❌ not done or contradicted by evidence; ⚪ requires client/external evidence.

## Raw verification summary

- Live DB: PostgreSQL 17.10 on Neon; 29 application tables; 8 users; all 8 password hashes start with `$argon2`; 0 Google-linked accounts; 0 courses; 0 payments; 0 training articles. The only settings keys are `course_academy_base_rate` and `course_tutor_promo_rate`.
- Live roles: 2 students, 3 tutors, 2 admins, 1 subadmin.
- Live SubAdmin permissions include `manage_payments`, `manage_settings`, and `impersonate_users` in addition to all other permissions.
- Live payment methods: Card and PayPal only.
- Live lessons: one pending ($41.67) and one confirmed ($6.25, platform fee $1.88). The only external meeting host saved is `meet.jit.si`, not Google Meet.
- API unit tests: 19/19 suites, 117/117 tests passed.
- API and web TypeScript checks passed.
- API e2e suite stalled and was terminated; production builds and local readiness also stalled.
- `pnpm audit`: 1 High vulnerability (`sharp` 0.34.5; patched in 0.35.0+), 0 Critical.
- Public ngrok URL timed out. After a very slow startup, the local API health returned 200 with database/Redis up, all six checked public pages returned HTTP 200, and an unsigned Stripe webhook returned HTTP 400. The bundled readiness script itself still failed during its earlier run because services were not ready within its checks.

## 0. Contract decisions

- ⚪ $300 / 30 working days: no primary contract/conversation evidence exists in the repository.
- 🟡 Full Flask/HTML to NestJS/Next.js migration: technical result is verified, but original contractual wording is not.
- ✅ PostgreSQL migration: live PostgreSQL 17.10 confirmed.
- ❌ Preserve current design: cannot be certified without the original ZIP; the admin dashboard is visibly side-nav and the palette tokens differ from the exact requested values.
- ⚪ AI as helper with human review: no auditable review record proves every AI-generated change received human review.

## 1. Infrastructure and migration

- ✅ Backend is NestJS; no active Flask/Python application files or routes were found.
- ✅ Frontend is Next.js; no active legacy HTML pages were found.
- ✅ Database is PostgreSQL with real tables.
- ✅ Current password-bearing accounts are Argon2-hashed; no `123456` current DB hash/default was found.
- ❌ Arabic setup guide is unusable/corrupted and inaccurate: mojibake text, Node 18 instead of Node 24, wrong `.env` location, nonexistent `pnpm run seed`, nonexistent `scripts/backup-db.ps1`, and missing `DELIVERY_REPORT.md`.
- ❌ Windows readiness is not proven: plain `pnpm` fails under PowerShell execution policy, `pnpm.cmd` orchestration hangs, and build/readiness processes did not complete.

## 2. Authentication and accounts

- 🟡 Google OAuth strategy and user creation code exist, but the live DB has 0 Google-linked accounts; a real first-login DB insert was not demonstrated.
- ⚪ Facebook/Apple remain a client decision; UI marks both “Coming soon.”
- ✅ Password hashing uses Argon2id and all 8 live hashes match Argon2 format.
- ✅ Student anti-concurrent-login/session locking exists with Redis and fail-closed guards; unit/e2e source covers invalidating older sessions. Runtime two-device proof is still absent.
- 🟡 Safe account purge exists at `DELETE /users/me` with locked cancellation/refund and soft delete. A second `DELETE /auth/account` path only soft-deletes and revokes sessions, so behavior is inconsistent. Runtime e2e did not complete.

## 3. Dashboards and SubAdmin

- ✅ Student and tutor dashboards use the shared authentication system; historical screenshots show them rendering.
- 🟡 Admin sections are implemented, but current live data is empty for payments/courses/articles and today’s runtime was unreachable.
- ✅ One active SubAdmin account exists.
- 🟡 Messaging and rejection-note endpoints exist.
- ❌ The live SubAdmin can access financial/settings areas through assigned `manage_payments` and `manage_settings` permissions.
- ✅ Final teacher approve/reject endpoints are server-restricted to Admin; SubAdmin has a distinct rejection-note endpoint.
- 🟡 Impersonation endpoint is Admin-only, but the live SubAdmin is incorrectly assigned the `impersonate_users` permission.
- ❌ Admin navigation is a right-side `<aside>` at desktop widths, not a top navbar. Screenshot: `screenshots/admin-dashboard.png`.

## 4. Classroom

- 🟡 Server gateway validates participants and stores classroom/chat state, but actual entry logging was not demonstrated in a live two-party session.
- 🟡 WebRTC offer/answer/ICE, audio, and camera code exists; reliable two-device connection was not tested.
- 🟡 In-room chat persists/broadcasts messages in code; real-time two-party proof is absent.
- 🟡 Whiteboard draw/page sync and Redis/DB snapshot recovery exist; two-party/new-joiner proof is absent.
- ✅ Native classroom is primary and a Google/Jitsi fallback button exists.
- ❌ Google Meet + Calendar is not working in current evidence: the only saved external meeting is Jitsi (`meet.jit.si`) and no live calendar event was proven.
- 🟡 Secure book viewer renders pages to canvas with repeated user watermark and blocks common shortcuts/context menu. This is deterrence, not absolute screenshot prevention.
- 🟡 No download button/raw client URL is exposed by the viewer, but network-level raw-file leakage was not tested.
- ❌ Full registration → booking → classroom → completion journey on two devices was not run.

## 5. Booking and lesson lifecycle

- ✅ Slot collision protection uses transaction locks and overlap queries.
- ✅ Price is hourly rate × duration, rounded to cents.
- ✅ Student balance is deducted on tutor approval/`CONFIRMED`, not at `PENDING` booking.
- ❌ **Critical: pending-cancellation free-money bug remains.** `cancelLesson` permits `PENDING` and `CONFIRMED`, computes `shouldRefund` without checking the original status, then increments the student balance by the full price.
- ❌ Confirmed cancellation refunds the student but does not reverse the tutor balance credited at confirmation, creating money unless handled elsewhere (no such reversal is present in `cancelLesson`).
- 🟡 Teacher reject is a distinct endpoint, but maps a pending request to `CANCELLED`; no amount was deducted, so no refund should occur.
- ✅ Admin teacher application has explicit Approve and Reject actions.
- ✅ Rejection updates status/reason and does not delete uploaded document/video fields.
- ✅ Rejection and SubAdmin moderation-note email code exists; inbox delivery was not verified.

## 6. Payments and commissions

- 🟡 Stripe Checkout/Connect code and configured secrets exist, but the live DB has 0 payments and no real checkout/webhook/dashboard proof.
- ❌ PayPal is fake: submitting PayPal directly calls `approvePayment(..., 'paypal-auto')` without a PayPal gateway/payment capture.
- ❌ Live methods are only Card and PayPal; Instapay and Vodafone Cash are missing. Binance remains unresolved.
- ✅ Approved deposits add net USD 1:1; EGP is divided by the configured rate. Old credit-conversion code remains but is not used in approval.
- ❌ Live `settings` contains no `egp_to_usd_rate`; service silently falls back to 50, contrary to the DB-setting-only requirement.
- 🟡 Five lesson commission tiers are coded correctly: 30%, 24%, 20%, 18%, 12% at <=20, <=50, <=200, <=400, >400 hours. Live settings do not contain configurable tier rows.
- ❌ `platformFee` and tutor earnings are written at lesson confirmation, not at lesson completion as explicitly required.
- ✅ Stripe webhook calls signature verification and unsigned payloads are intended to be rejected.
- 🟡 Webhook event IDs and payment locks provide idempotency layers, but the pre-check/record pattern is not fully atomic against concurrent identical events.
- ✅ Reviewed balance modifications use transactions with pessimistic locks and/or atomic increment/decrement.
- ✅ Login throttling is active: seven valid failed-login requests returned `401,401,401,401,401,429,429`. Register uses the same explicit 5/minute throttle in code but was not spam-tested to avoid creating accounts.

## 7. Course referral

- 🟡 Link generation exists, but format is `?ref=teacherId.signature`, not the exact `?ref=teacherId` requested. The signature is a security improvement but a format deviation.
- ✅ Cookie and LocalStorage persist referral for 30 days.
- ✅ HMAC validation binds the referral to both course and tutor, preventing a different teacher’s code from being accepted.
- 🟡 Tutor UI includes link, copy button, referral/direct sales statistics; no live course/sale data exists to prove counters.

## 8. Teacher applications and training

- ✅ Application captures bio, languages, specialty, hourly rate and optional files.
- ✅ Applications default to Pending and admin views/actions exist.
- ✅ Article entity/API supports title, cover image, content and published status.
- ✅ Admin CRUD and tutor published-only read paths exist in code.
- 🟡 Live DB has 0 articles, so real add/edit/delete/published-view behavior is not proven.

## 9. Course approval

- ✅ Tutor-created courses default to Pending.
- ✅ Admin UI has an Approve button.
- ✅ Public list and student enrollment require Approved status.
- 🟡 Enrollment, lessons, completion/progress code exists, but live DB has 0 courses/enrollments and runtime was not demonstrated.
- 🟡 Admin/SubAdmin course creation writes Approved immediately; whether this is acceptable as explicit admin approval should be confirmed.

## 10. Video protection

- 🟡 Bunny Stream integration and configuration exist, but there are 0 live courses/videos.
- 🟡 HLS `.m3u8` URL generation exists; Bunny encryption setting was not verified in Bunny.
- ✅ Signed playback/embed URLs default to 900 seconds (15 minutes), not 2 hours.
- ⚪ Domain restriction is a Bunny dashboard setting and was not verified.
- ✅ Student session locking exists as an account-sharing control.
- ❌ Admin approval merely flips course status; it does not record/require a video-quality review.

## 11. Email

- 🟡 Booking/approval/cancellation/completion email code exists; actual delivery was not verified.
- 🟡 Teacher application received/approved/rejected/rejection-note email code exists; actual delivery was not verified.
- 🟡 Payment approval email and invoice endpoint exist, but a real receipt email after captured payment was not demonstrated.
- ✅ Password-reset token is stored with expiry and reset link email code exists.
- ✅ Forgot-password is throttled to 3 requests/hour.

## 12. Legal/removal

- ✅ Privacy, Terms, FAQ, and Help pages contain real page content.
- ✅ No Corporate Training reference or route was found in frontend source.

## 13. Design and languages

- ❌ Palette is not exact. `globals.css` uses `#07211b` instead of `#0F3A40`, and `#fcf8f2` instead of both `#FFFFF0` and `#FDFBF7` for core tokens.
- ✅ Student and tutor dashboard primary navigation is top-oriented in historical screenshots/current source.
- ❌ Admin dashboard navigation is side-oriented on desktop.
- ❌ No original ZIP/design reference is present, so side-by-side page review cannot be completed.
- 🟡 RTL/LTR switching exists, but mojibake/corrupted Arabic is present in the Arabic setup guide and some dashboard source strings; page-by-page bilingual verification did not complete.

## 14. Security

- ✅ Current JWT secret is configured, random-looking, 96 characters, and not a placeholder.
- ✅ TypeORM is 0.3.31 (>=0.3.29).
- ❌ Audit is not clean: 1 High vulnerability in `sharp` 0.34.5.
- ⚪ Secret rotation after previous exposure cannot be proven from repository state. Current `.env` values are configured but must still be rotated if pasted/shared.
- ✅ Maintenance guard is global and checks the DB setting; runtime 503 behavior was not rerun.
- ❌ Production HTTPS is not proven; the supplied public ngrok URL timed out.
- 🟡 `.env` files are ignored and show no tracked history, but internal planning Markdown files are tracked and secret scan flags PostgreSQL URLs in three docs.
- 🟡 A daily GitHub Actions PostgreSQL backup workflow exists and validates dumps, but no successful scheduled run/artifact was inspected.

## 15. Optional tools

- ❌ Gemini vocabulary code exists but `GEMINI_API_KEY` is not configured, so it is not operational.
- ✅ `.ics` generation and `text/calendar` download endpoint exist.
- ⚪ Mobile app remains out of scope; responsive browser support is the relevant target.

## 16. Final end-to-end acceptance

- ❌ Full student journey including real payment, classroom, completion and rating was not completed.
- ❌ Full teacher journey including application through real earnings was not completed.
- ❌ Full admin journey including all requested approvals was not completed.
- ❌ Classroom was not tested on different physical devices/browsers.
- 🟡 Historical desktop/mobile screenshots exist, but comprehensive mobile/tablet/desktop acceptance was not rerun.
- 🟡 Dark/light theme mechanism exists; every page with exact palette was not verified, and palette tokens already deviate.

## Client decisions still open

- ⚪ Facebook/Apple login requirement.
- ⚪ Binance payment requirement.
- ⚪ Precise SubAdmin permission wording. Regardless of that wording, current live financial access is broader than the stated checklist.
- ⚪ Signed URL duration. Current implementation is 15 minutes, not the estimated 2 hours.

## Release-blocking fixes

1. Fix pending cancellation so only previously charged confirmed lessons can be refunded; reverse tutor earnings on confirmed cancellation.
2. Remove financial/settings permissions from SubAdmin and remove the meaningless impersonation assignment.
3. Replace fake PayPal auto-credit with real PayPal capture or disable PayPal; add required live Instapay/Vodafone configurations.
4. Move platform-fee/tutor-credit recognition to completion if the checklist is authoritative.
5. Restore exact requested palette and move Admin navigation to the top.
6. Repair the Arabic setup guide and Windows commands; make build/readiness complete from scratch.
7. Upgrade vulnerable `sharp` dependency and rerun audit.
8. Complete real Google OAuth, Google Calendar/Meet, Stripe, Bunny, SMTP, and two-device classroom acceptance with raw evidence.
