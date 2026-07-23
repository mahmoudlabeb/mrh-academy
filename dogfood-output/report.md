# Senior QA Report: MRH Academy

| Field | Value |
|---|---|
| Date | 2026-07-22 |
| Local URL | http://127.0.0.1:3000 |
| Public URL tested | https://veneering-strenuous-underdog.ngrok-free.dev |
| Method | Agent-browser exploratory testing, API probes, responsive inspection, regression tests, TypeScript checks |
| Roles | Guest, student, approved tutor, pending tutor, admin, subadmin |

## Result

The tested local application journeys are working after remediation. Seven confirmed defects were fixed during this pass, including one high-severity authorization failure. The final targeted browser retest found no remaining errors in the repaired journeys.

This result does not certify third-party dashboards or physical multi-device behavior. Google OAuth consent/redirect registration, real Stripe/Connect flows, Bunny restrictions, SMTP inbox delivery, and two-device WebRTC still require the external checks listed below.

## Coverage and outcomes

| Area | Outcome | Evidence |
|---|---|---|
| Public homepage and responsive navigation | Pass | Correct hero accessible name, mobile control names, and Arabic footer content |
| Public courses | Pass | Empty state shown when no approved courses exist |
| Login | Pass | Email/password works; Google entry starts OAuth; unavailable Facebook/Apple options are visibly disabled |
| Student discovery | Pass | Tutor discovery and no-results behavior work |
| Lesson booking | Pass | Fictional 25-minute booking created for USD 6.25 |
| Tutor lesson approval | Pass | Booking changed to confirmed; student wallet changed from USD 100.00 to USD 93.75 |
| Tutor earnings | Pass | Approved booking produced USD 4.37 tutor earnings |
| Student lessons page | Pass after fix | Confirmed lesson renders and Jitsi URL is labeled `Jitsi Meet` ([screenshot](screenshots/final-student-lessons.png)) |
| Approved tutor dashboard | Pass | Full teaching tools remain available ([screenshot](screenshots/final-approved-tutor.png)) |
| Pending tutor boundary | Pass after fix | Restricted status screen shown; direct course-create API probe returns HTTP 403 ([screenshot](screenshots/final-pending-tutor.png)) |
| Admin tutor/course lists | Pass | Fresh API process returns successful lists; earlier 500s were traced to a stale pre-build process |
| Course form validation | Pass | Invalid input is rejected before submission |
| Footer accessibility | Pass after fix | Social placeholders are named, disabled controls rather than dead `#` links |

## Defects fixed

1. **High — pending tutor authorization bypass.** Pending tutors could access teaching operations and create courses. The API now requires an approved tutor profile, the UI displays an account-review state, and regression tests cover pending and approved creation.
2. **High — student lessons runtime crash.** `/student/lessons` expected a nested `tutor` object while the API returns `tutorName`, `date`, and `duration`. The page now follows the real response contract and renders safely.
3. **Medium — meeting provider mislabeled.** Jitsi fallback links were presented as Google Meet. Labels now derive from the actual URL.
4. **Medium — enabled-looking placeholder authentication.** Facebook and Apple sign-in are now disabled and marked “Coming soon”.
5. **Medium — dead, unnamed footer links.** Social placeholders now have accessible names and cannot navigate to `#`.
6. **Medium — unnamed icon controls.** Mobile menu and dashboard theme controls now expose accessible names and state.
7. **Low — concatenated hero accessible name.** The styled Arabic heading now exposes the complete phrase with correct word separation.

The two QA courses created while proving the pending-tutor bypass were deleted by exact ID after the fix was verified.

## Automated verification

- API course-approval regression tests: **2/2 passed**
- API TypeScript check: **passed**
- Web TypeScript check: **passed**
- Targeted formatting: **passed**
- Live pending-tutor create probe against fresh build: **HTTP 403**, expected approval message
- Live student lessons reload: **renders without page errors**

## External checks still required

These cannot be fully certified from one local browser and local test credentials:

- In Google Cloud Console, register the exact callback currently emitted by the application and complete consent-screen/test-user configuration. A mismatch there will continue to produce Google `redirect_uri_mismatch` even though the application now emits a consistent callback.
- Run Stripe test checkout, webhook, refund/dispute, Connect onboarding, and payout using the Stripe dashboard/CLI.
- Verify Bunny playback, allowed-domain enforcement, and expired-token rejection from the Bunny dashboard.
- Confirm password-reset, booking, and payment messages arrive in the configured Ethereal/SMTP inbox.
- Join the same classroom from two real devices and verify camera, microphone, chat, whiteboard, reconnect, and room locking.
- Validate Google Calendar/Meet creation with the intended Workspace impersonation account; Jitsi fallback is currently operational.

## Security note

Credentials were pasted into the conversation during setup. Rotate the Google client secret/service-account key, Cloudinary secret, Bunny keys, Metered keys/TURN credentials, Stripe secret, SMTP password, database password, and ngrok token before any production deployment.
