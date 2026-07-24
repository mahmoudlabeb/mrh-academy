# MRH Academy — Detailed Client Status Report

**Report date:** 24 July 2026 (Africa/Cairo)  
**Assessment basis:** repository implementation, delivery documents, automated-test evidence dated 22 July, current source inspection, and current static checks.  
**Purpose:** distinguish delivered client requirements from work that is awaiting acceptance, configuration, or a client decision.

## Executive summary

MRH Academy is a substantially implemented web learning platform, not an early prototype. The core student, tutor, administrator, booking, classroom, payment, course, security, bilingual, and responsive-browser requirements are implemented in the codebase. The prior readiness audit recorded passing API, browser, lint, type, build, and security checks.

It should **not yet be presented as fully accepted production delivery**. The remaining items mostly need client-owned credentials, a real-device or live-money test, missing design reference material, or a clear business decision. Two social-login choices shown in the login interface — Facebook and Apple — are explicitly marked as “Coming soon” and are not implemented.

### Current verification position

| Check | Result | Meaning |
| --- | --- | --- |
| Repository lint (24 Jul) | Passed | No current lint errors in API or web workspaces. |
| Repository TypeScript check (24 Jul) | Passed | API, web, and shared types compile at type-check level. |
| Production build (24 Jul) | Not concluded | The combined check exceeded the available command time; this is not a build failure, but it is not current-build proof. |
| API automated suite (22 Jul) | 119 tests passed in 19 suites | Strong historical regression evidence; it was not re-run after the current uncommitted edits. |
| Browser/client smoke checks (22 Jul) | Passed | Historical authenticated and public-browser evidence exists. |
| Security audit (22 Jul) | Passed at high severity threshold | Historical evidence only; repeat before production release. |

This delivery includes changes across **23 web-source files** covering UI, authentication, language handling, and performance. The changes pass lint, type-checking, formatting, Knip, and the repository unit-test suite, but still require a fresh production build and browser regression test before being treated as an approved release.

## Delivered requirements

### 1. Platform foundation, roles, and accounts — delivered

- Next.js web application, NestJS API, PostgreSQL schema/migrations, Redis-backed session protections, and shared TypeScript contracts are in place.
- Four roles use one authentication model: Student, Tutor, Admin, and SubAdmin.
- Registration, login/logout, refresh/access-token separation, email verification, password reset with expiry and throttling, account deletion/purge safeguards, and notification preferences are implemented.
- Google OAuth code is implemented to create or link a user account.
- Admin dashboard uses the requested top navigation rather than a sidebar.
- SubAdmin is deliberately limited to tutor/student management and communication. It cannot access finance, settings, final approval/rejection actions, or impersonation.

### 2. Student and tutor operations — delivered

- Students can discover tutors, maintain favourites, view tutor profiles, manage their profile, wallet, messages, lessons, settings, and notifications.
- Tutors can apply through the teacher onboarding flow, manage profile, availability, students, messages, lessons, insights, earnings, and courses.
- Tutor applications are retained, visible in an admin review queue, and support approval/rejection with a rejection-reason email flow.
- The booking service prevents overlapping/double bookings and calculates price from duration and hourly rate.
- A student balance is charged only after lesson confirmation, not while a lesson is pending.
- Cancellation/refund, tutor lesson rejection, tutor earnings, and recorded platform fees are handled separately and are covered by regression evidence.

### 3. Classroom and learning experience — delivered in code

- Authenticated classroom entry and participant validation.
- WebRTC signaling, audio/video, real-time chat, whiteboard state for new participants, and screen-sharing-related classroom capabilities.
- Native classroom is the primary route, with Google Meet/Jitsi fallback support.
- Protected book viewer/canvas with dynamic watermarking and no raw download control.
- Course browsing, enrolment, progress/completion tracking, tutor course creation, pending-course workflow, and explicit admin approval.
- Teacher-training article management and published-only teacher access.
- Gemini-backed vocabulary feature and `.ics` calendar export are implemented, subject to configuration.

### 4. Payments, commissions, and financial safeguards — delivered in code

- Stripe card payment implementation with signed webhook verification, idempotency ledger, row locks, and atomic balance updates.
- PayPal Orders create/capture flow with amount, currency, status, order, and capture verification; the former fake auto-credit behaviour was removed.
- Manual payment workflows and admin approval/rejection are present.
- Five commission tiers are stored in settings and the fee is retained historically for completed lessons.
- USD balance is one-to-one; EGP conversion requires the managed database setting.
- Stripe Connect payout support was added in the latest committed work (23 Jul).
- Unsafe incomplete methods are protected: PayPal, Instapay, and Vodafone Cash remain disabled until valid client credentials/destination details are supplied. The admin API refuses incomplete activation.

### 5. Administration, content, legal, and design — delivered

- Admin coverage includes statistics, tutors, students, lessons, courses, reviews, payments, employees/SubAdmins, reports, and settings.
- Admin can review tutors, payments, reviews, courses, and staff invitations; controlled SubAdmin impersonation is supported only where permission allows it.
- Privacy, Terms, FAQ, and Help pages contain real content.
- Arabic RTL and English LTR, responsive navigation/layout, and dark/light theme switching are implemented.
- The requested premium education visual direction and palette have been implemented: teal, cream, gold, rounded card styling, and bilingual typography.
- Public desktop/mobile and authenticated-admin visual evidence was captured during the 22 Jul browser audit.

### 6. Security, operations, and deployment readiness — delivered in repository

- CSRF controls, request throttling, route protection, session locking, strong JWT configuration requirements, exception handling, migration validation, and environment-file exclusions are present.
- Database backup and database synchronization/verification commands exist, plus a scheduled backup workflow.
- The 22 Jul audit recorded no high/critical dependency-audit finding and successful migration/database checksum verification.
- The delivery documentation includes setup, environment, deployment, backup, smoke-test, and client handover instructions.

## Implemented but not yet completed/accepted

These items are implemented in code but remain open because they require an external service, real user action, physical devices, live data, or client sign-off.

| Area | Current state | What closes it |
| --- | --- | --- |
| Google login | Code complete; no real Google-linked test account proven. | Client performs first Google login with its Google credentials. |
| Classroom | Code and automated coverage complete. | Student and tutor sustain an audio/video/chat/whiteboard call on separate real devices and networks. |
| Google Calendar/Meet | Integration path exists. | Client Google Workspace test creates a real calendar event and Meet link. |
| Stripe/PayPal | Verified without charging real money. | Client authorizes a small intentional charge and refund acceptance test. |
| PayPal/Instapay/Vodafone Cash | Safely disabled pending complete details. | Client provides approved merchant credentials and destination/account details, then test each route. |
| Bunny video streaming | Signed playback and enrolment controls are coded. | Client provides Bunny library/video evidence and verifies HLS encryption/domain restriction in Bunny. |
| Email events | Email workflows are coded/tested. | Deliver each event to client-owned inboxes and confirm receipt/spam handling. |
| Gemini vocabulary | Feature coded but inactive without key. | Add client Gemini key and perform a live vocabulary request. |
| Courses/training data | Workflows implemented, but synced acceptance database had zero courses, enrollments, and training articles. | Client/admin creates representative content and tests complete learner flow. |
| Design contract | Palette, responsive behavior, language/theme mechanics were checked. | Client supplies original approved ZIP/screenshots for a contractual pixel-level comparison. |
| Production operations | Backup tools/workflow exist; temporary ngrok client test URL was used. | Agree final hosting, backup retention/restore procedure, monitoring, and production-domain testing. |

## Not implemented, deliberately inactive, or awaiting a decision

### Not implemented in the current product

1. **Facebook sign-in** — the login page labels it “Coming soon”; no completed implementation is evidenced.
2. **Apple sign-in** — the login page labels it “Coming soon”; no completed implementation is evidenced.
3. **Native mobile application** — the agreed scope is a responsive browser application, not iOS/Android native apps.
4. **Corporate Training route/navigation** — it is absent from the current public navigation/footer/routes.

### Client decisions required before development/activation

1. Confirm whether Facebook and Apple login are required.
2. Confirm whether Binance payment is required.
3. Confirm the signed video URL lifetime (the existing value is a secure configured default, not confirmed client policy).
4. Supply the original approved design ZIP/screenshots for objective visual sign-off.
5. Authorize/provide live credentials and approved destination details for PayPal, Instapay, Vodafone Cash, Google Workspace, Bunny, SMTP, and Gemini as applicable.
6. Confirm production backup retention, restore ownership, monitoring, and service-level expectations.
7. Confirm all previously exposed secrets have been rotated in provider dashboards. Repository review cannot prove external rotation.

## Risks and delivery notes

- The previous public ngrok address was a temporary test tunnel, not production hosting. Its availability depends on the local machine, API, web server, database, Redis, and tunnel process remaining online.
- A browser application cannot prevent operating-system screenshots. The implemented per-user watermark is the practical deterrent, not an absolute technical prohibition.
- Do not enter real payment or identity data until client-controlled production credentials, privacy/data-handling policy, and live-payment acceptance tests are approved.
- Do not deploy future working-tree changes informally. Review and commit them first, then run a fresh production build, API test suite, browser E2E suite, and deployment smoke test.

## Recommended acceptance sequence

1. Client confirms the pending business choices: social logins, Binance, video-link duration, and any required payment methods.
2. Client supplies the original visual reference and required vendor credentials in a secure channel.
3. Populate a non-production acceptance dataset: one tutor, one student, one approved course/video, one training article, and payment test records.
4. Run a two-device classroom session, Google Calendar/Meet creation, inbox delivery tests, Bunny restriction check, and a controlled live-payment/refund test.
5. Run a fresh production build and browser E2E suite for the committed web changes.
6. Deploy to the final client-owned domain; verify backup restoration and then obtain written acceptance.

## Evidence consulted

- `README.md`
- `scripts/CLIENT_DELIVERY.md`
- `dogfood-output/client-readiness-final-2026-07-22.md`
- `dogfood-output/comprehensive-checklist-audit-2026-07-22.md`
- `docs/UI_UX_BRIEF.md`
- Current source status and current 24 Jul lint/type-check results.
