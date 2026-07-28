# Paper & Signal route and backend coverage

This matrix records the production route architecture introduced for the MRH Academy redesign. Every primary surface lives under the real `app/[locale]` Next.js route tree and supports both `en` (LTR) and `ar` (RTL). Legacy unprefixed URLs are compatibility redirects only.

| Area | Locale route family | Backend authority | Status / limitation |
|---|---|---|---|
| Marketplace | `/{locale}`, `/tutors`, `/tutors/[id]`, `/courses`, `/courses/[id]` | Approved tutor and course APIs | Implemented with real catalog/profile state. Missing media remains an honest placeholder. |
| Tutor booking | `/tutors/[id]/book` | Tutor availability, balance preview, `POST /lessons/book` | Implemented. The API revalidates slot, duration, price, balance, and collision state. Success is shown only after the response. |
| Course enrollment | `/courses/[id]/enroll` | Course details, enrollments, `POST /courses/[id]/enroll` | Implemented as a focus-safe routed drawer. Server errors and insufficient balance remain visible. |
| Public information/auth | `/become-a-tutor`, `/resources`, `/help`, `/sign-in`, `/sign-up`, `/forgot-password` | Existing application, article, and auth APIs | Implemented in the locale tree. |
| Learner today/lessons | `/learn`, `/learn/lessons` | Balance, unread state, student lessons | Implemented with learner-only shell guard. |
| Learner courses/player | `/learn/courses`, `/learn/courses/[id]` | `/courses/my/enrollments`, lessons, completion endpoint, stream token | Implemented. Video playback reports missing Bunny configuration honestly. |
| Wallet/add funds | `/learn/wallet`, `/learn/wallet/add` | Balance, payment methods, payment/deposit endpoints | Implemented; add is a durable routed drawer. Manual-transfer methods remain pending until operations approval. |
| Saved tutors/vocabulary | `/learn/saved`, `/learn/words` | Favorites and vocabulary APIs | Implemented. |
| Tutor workspace | `/teach`, `/classroom`, `/schedule`, `/availability`, `/students`, `/courses`, `/earnings`, `/insights`, `/profile` | Tutor approval, lessons, availability, students, courses, stats, earnings | Implemented with approved-tutor guard and real API state. |
| Course studio | `/teach/courses/new/studio`, `/teach/courses/[id]/studio` | Existing course create/list/referral endpoints | Partially supported. Basic metadata persistence is real; the API currently has no complete section/lecture asset authoring workflow, so unsupported studio fields are not reported as saved. |
| Payout | `/teach/earnings/payout` | Balance, transactions, payouts | Implemented as a durable routed drawer. Payout status remains pending until backend/operations processing. |
| Lesson record/classroom | `/lesson/[lessonId]`, `/room/[roomId]` | Ownership-scoped lessons, classroom membership, WebRTC/socket state | Implemented. Native MRH room is primary; Google Meet is displayed only when the backend provides a fallback URL. |
| Messages/notifications/account | `/messages/[userId]`, `/notifications`, `/account/*` | Existing messaging, notifications, user profile/security/preferences APIs | Implemented. Account subroutes reuse the shared settings surface because the backend object is shared. |
| Operations | `/ops`, `/people`, `/lessons`, `/money/payments`, `/settings` | Admin/subadmin permission-scoped endpoints | Implemented with shell-level role guard and component-level permission checks. Actions remain server-authoritative. |

## Externally configured capabilities

- Card checkout requires valid payment-provider configuration and webhook verification.
- Stripe Connect payout automation requires Stripe Connect credentials/onboarding; the existing generic payout request workflow remains available.
- Course streaming requires Bunny CDN configuration.
- Native two-party classroom verification requires two browsers/devices plus camera and microphone permissions.
- Google Meet is never created by the client. It appears only as an optional backend-provided fallback.
