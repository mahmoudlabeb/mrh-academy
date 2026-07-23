# MRH Academy — Final Client Readiness Report

Date: 2026-07-22 (Africa/Cairo)

## Release verdict

The application is running and ready for client testing at:

`https://veneering-strenuous-underdog.ngrok-free.dev`

The software defects discovered in the repository audit were fixed and the automated quality gates pass. The project must **not** be represented as 100% contractually accepted yet: the client decisions and third-party/physical-device acceptance tests listed under **Open acceptance items** require people, credentials, vendor dashboards, real payment accounts, or the missing original design ZIP.

## Runtime and database evidence

- Public HTTPS health response: `status=ok`, `database=up`, `redis=up`.
- Client-test runtime database: local PostgreSQL 16.14, database `mrh_academy_db`, `127.0.0.1:5433`.
- Cloud source of truth used for synchronization: Neon PostgreSQL 17.10.
- Synchronization direction: Neon → isolated local database.
- Final synchronization: 30 tables; `mismatches: []`; every row count and table checksum matched.
- Final machine-readable proof: `dogfood-output/database-sync-proof.json`.
- Final backup: `backups/neon-before-local-sync-2026-07-22T14-51-04.824Z.json.gz`.
- Local pre-sync backup: `backups/local-before-neon-sync.dump`.
- The unrelated Windows PostgreSQL service on port 5432 was not changed.
- Final key counts: users 8, lessons 2, classrooms 2, migrations 10, settings 12, payment methods 4.

## Raw browser evidence

- Public desktop home: `dogfood-output/public-ngrok-final/home-desktop.png`
- Public mobile menu: `dogfood-output/public-ngrok-final/home-mobile-menu.png`
- Public admin top navigation: `dogfood-output/public-ngrok-final/admin-top-navigation.png`
- Delayed homepage diagnostic (30 seconds): `dogfood-output/public-delay/homepage-after-30s.png`; no error boundary, page error, or failed static asset after the Next.js process was restarted against the current build.
- Independent design evaluation: PASS — top navigation and exact palette satisfy the brief; no blocking visual issue.
- Browser smoke result: `/`, `/courses`, `/faq`, `/help`, `/privacy`, `/terms`, `/login`, and `/register` all returned HTTP 200 through ngrok.
- Authenticated admin result: redirected to `/admin`; zero `<aside>` elements; header width 1440 at viewport width 1440; exactly one current navigation item.
- Theme result: dark → light toggle passed.
- Mobile result: menu opened and closed with Escape.
- Exact design tokens found: `#FFF3DA`, `#F3E1B9`, `#B89754`, `#E4CC9C`, `#0F3A40`, `#1D535B`, `#D4A353`, `#FFFFF0` (browser reports the equivalent keyword `ivory`), `#FDFBF7`, and `#FAEDCD`.

## Automated verification

- API Jest: 19 suites, 119 tests passed. Machine-readable result: `dogfood-output/api-jest-final.json`.
- Lesson regression set: 30 tests passed.
- Payment regression set: 8 tests passed.
- API ESLint: passed.
- Web ESLint: passed.
- API TypeScript: passed.
- Web TypeScript: passed.
- API, shared types, and Next.js production builds: passed.
- `pnpm audit --audit-level=high`: no known vulnerabilities.
- `git diff --check`: passed (Windows line-ending notices only).

## Checklist result by section

### 0–1. Contract and migration

- DONE: NestJS backend; no Flask production route.
- DONE: Next.js frontend; no legacy HTML production path.
- DONE: PostgreSQL database and migrations.
- DONE: Argon2id password hashing and user-selected registration passwords; demo password is environment-configured, not a production default.
- DONE: corrected Arabic Windows setup guide and environment guide.
- NEEDS CLIENT EVIDENCE: budget/duration, precise original contract text, and human-review commitment are business acceptance evidence rather than executable software checks.
- NEEDS SOURCE ARTIFACT: exact old-vs-new design comparison cannot be certified without the client’s original ZIP/screenshots.

### 2. Authentication and accounts

- DONE IN CODE/TESTS: Google OAuth creates or links a database user; password reset expiry/rate limit; session locking; safe account purge/refund and login prevention.
- NOT YET EXTERNALLY PROVEN: first Google login with a real client-owned Google account. The database currently has no Google-linked test user.
- CLIENT DECISION: Facebook and Apple login requirement.

### 3. Dashboards and SubAdmin

- DONE: student, teacher, admin, and SubAdmin share the same authentication system.
- DONE: admin uses a top navigation bar, not a sidebar.
- DONE: SubAdmin database permissions are exactly `manage_tutors` and `manage_students`; no finance, settings, approval/rejection decision, or impersonation access.
- DONE: SubAdmin can communicate and send a teacher rejection reason without making the final decision.

### 4. Classroom

- DONE IN CODE: authenticated room entry, participant validation, WebRTC signaling, audio/video, in-room real-time chat, persisted whiteboard state for new joiners, native-room primary flow, Meet/Jitsi fallback, protected book canvas/watermark, and no raw download control.
- NOT YET PHYSICALLY PROVEN: a sustained student/teacher WebRTC call on two separate real devices and networks.
- NOT YET VENDOR-PROVEN: a real Google Calendar event and Meet link created using the client’s Google Workspace account.
- TECHNICAL LIMIT: no web application can guarantee prevention of operating-system screenshots; the implemented dynamic user watermark is the enforceable deterrent requested by the checklist.

### 5. Booking and lessons

- DONE: overlap locking/double-booking prevention; duration × hourly-rate pricing.
- DONE: balance is charged on `CONFIRMED`, never on `PENDING`.
- DONE: pending cancellation gives no refund; confirmed cancellation refunds exactly the charged amount and reverses legacy premature tutor credit.
- DONE: tutor earnings and static `platformFee` are recorded on completion.
- DONE: teacher lesson rejection is distinct from cancellation.
- DONE: application Approve/Reject controls, retained application files, and rejection-reason email path.

### 6. Payments and commissions

- DONE: real Stripe implementation, signed webhook verification, idempotency ledger, row locks/atomic balance changes, and login/register throttling.
- DONE: real PayPal Orders create/capture implementation with amount, currency, status, order, and capture verification; fake auto-credit path removed.
- DONE: USD balance remains 1:1; EGP rate is required from database settings.
- DONE: five commission tiers are stored in settings; fee is preserved historically at lesson completion.
- SAFE CONFIGURATION: PayPal, Instapay, and Vodafone Cash remain disabled until real client credentials/destination details exist; the admin API refuses to enable incomplete methods. Stripe/card is active.
- NOT YET FINANCIALLY PROVEN: an intentional live Stripe/PayPal charge and refund. No real money was charged during engineering verification.
- CLIENT DECISION: Binance requirement.

### 7. Course referrals

- DONE: generated teacher referral link, 30-day cookie/local storage, cryptographic binding to course+tutor, copy control, and referral/direct statistics.
- NOTE: the URL includes a security signature alongside the teacher ID. This prevents another teacher from attaching a forged referrer ID.

### 8–9. Applications, training, and courses

- DONE: complete teacher application, Pending admin queue, and retained files.
- DONE: training article title/image/content, admin CRUD, and published-only teacher view.
- DONE: every new course defaults to Pending, admin approval is explicit, video-quality confirmation is required and audited, and students see/enroll/view only approved courses.
- DATA LIMIT: the synchronized database currently has zero courses, enrollments, and training articles; the flows are code/test verified but the client should populate acceptance fixtures.

### 10. Video protection

- DONE IN CODE: Bunny Stream integration, signed temporary playback URLs, HLS delivery path, enrollment checks, session lock, and admin video-quality approval record.
- NOT YET VENDOR-PROVEN: Bunny dashboard HLS encryption and domain restriction because the client Bunny library/account contains no test course/video evidence here.
- CLIENT DECISION: signed URL lifetime (implementation currently uses the configured secure default; the checklist’s two-hour value is not a confirmed client decision).

### 11–12. Email and legal pages

- DONE IN CODE/TESTS: lesson, application, rejection reason, payment receipt, and expiring password-reset emails; reset abuse throttling.
- DONE: Privacy, Terms, FAQ, and Help contain real content; Corporate Training navigation/footer/route is absent.
- NOT YET INBOX-PROVEN: delivery to client-owned real inboxes for every event.

### 13. Design and language

- DONE: exact requested palette tokens.
- DONE: top navigation across the dashboards; public desktop/mobile and admin screenshots captured through ngrok.
- DONE IN SMOKE TEST: Arabic RTL, English LTR switching mechanics, responsive menu, and dark/light theme.
- NEEDS SOURCE ARTIFACT: contractual pixel-level comparison with the old site cannot be completed without the original ZIP/reference screenshots.

### 14. Security and operations

- DONE: strong configured JWT secret, TypeORM 0.3.31, zero high/critical audit findings, global maintenance guard, ignored environment files, migrations, and HTTPS via ngrok.
- DONE IN REPOSITORY: scheduled database-backup workflow and executable backup/sync commands.
- OWNER ACTION: rotate every key ever exposed in chat/review history; repository inspection cannot prove vendor-side rotation.
- DEPLOYMENT NOTE: ngrok is a temporary client-test tunnel, not the final production hosting/backup SLA.

### 15–16. Optional and final acceptance

- DONE IN CODE: Gemini vocabulary service and real `.ics` export.
- NOT ACTIVE: Gemini requires the client’s Gemini key.
- IN SCOPE: responsive browser site; native mobile app remains out of scope.
- PARTIALLY ACCEPTED: automated student/admin/browser flows passed and historical booking/admin/tutor screenshots exist.
- REQUIRES PEOPLE/EXTERNAL SYSTEMS: full real-payment journey, two physical-device classroom journey, real inbox delivery, Google Workspace Calendar/Meet, and Bunny dashboard acceptance.

## Open acceptance items

These are the only items that cannot honestly be closed by repository changes alone:

1. Client answer: Facebook/Apple login.
2. Client answer: Binance payment.
3. Client answer: final signed video URL duration.
4. Client supplies the original design ZIP/screenshots for contractual side-by-side review.
5. Client supplies/authorizes real PayPal, Instapay, and Vodafone Cash details; PayPal is safely disabled meanwhile.
6. Client authorizes a small live Stripe/PayPal transaction/refund acceptance test.
7. Client supplies/authorizes Google, Bunny, SMTP inbox, and Gemini test accounts/settings.
8. Two people test classroom audio/video/whiteboard/chat on separate physical devices and networks.
9. Owner confirms vendor-side key rotation and production backup retention/restore policy.

## Client test note

The current ngrok URL is temporary and remains available only while this computer, PostgreSQL, API, Next.js, Redis, and ngrok processes stay running. Use fictional/demo records for initial testing and do not enter real card or identity data until the client-owned live credentials and production data-handling policy are approved.
