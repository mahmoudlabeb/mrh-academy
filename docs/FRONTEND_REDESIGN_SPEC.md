# MRH Academy greenfield frontend redesign specification

**Version:** 2.0 — full redesign  
**Date:** 26 July 2026  
**Supersedes:** v1.0 (26 July 2026). v1.0 remains in git history; nothing in it is binding except the capability set it enumerated.  
**Status:** Approved product, experience, and visual direction; implementation-ready  
**Audience:** Product, design, frontend, backend, QA, content, and operations  
**Companion research:** [Primary-source redesign research](./research/redesign-primary-source-research.md)

---

## 0. What changed in v2.0 and why

v1.0 correctly fenced the scope — it proved which capabilities exist and forbade inventing more. It then organised those capabilities into a sensible but conventional product: a sidebar per role, a wizard per transaction, a route per admin table, and a token palette that could belong to any SaaS.

v2.0 keeps every guardrail and every capability, and changes the three things v1.0 left conventional:

| Axis | v1.0 | v2.0 |
| --- | --- | --- |
| **Flows** | Multi-section wizards; separate review pages; role-duplicated surfaces | **Decide-in-place.** Every transaction is one panel with a live consequence line and one commit button. Interaction budgets are acceptance criteria (§9). |
| **Information architecture** | 60+ routes, duplicated per role (`/learn/settings/*` + `/teach/settings/*`, two message trees, two notification centres, ten admin tables) | **Shared object routes.** One `/messages`, one `/notifications`, one `/account`, one `/lesson/{id}`, one `/room/{id}`, one ops **Queue** in front of the tables. ~40 routes, fewer implementations, same coverage. |
| **Visual language** | Warm canvas + indigo/orange tokens, "premium not ornamental" | **Paper & Signal** — a named, two-atmosphere design system (Daylight for discovery, Focus for work), an editorial serif/sans bilingual pairing, seven signature components, warm-charcoal dark mode, and explicit rules for where beauty is allowed to cost attention (§18–19). |

The rule that governs the redesign is unchanged and absolute: **preserve every real capability in the repository, invent none.**

---

## 1. Product decision and experience thesis

MRH Academy is one premium bilingual learning marketplace with two peer ways to learn:

1. **Learn live with an expert** — find an approved tutor, request a 25- or 50-minute lesson, message them, and meet in MRH's own classroom.
2. **Learn at your own pace** — find an approved course, enrol, watch its protected video, mark lessons complete, and track progress.

**Experience thesis:** *Discovery should feel like a beautifully made magazine. Work should feel like a precision instrument. Nothing in between.*

Public pages earn trust with scale, photography, typography, and restraint. Workspaces, money, and the classroom earn trust by being fast, dense where density helps, quiet, and never ambiguous about state. The design system carries both without becoming two products (§18.1).

This is a new frontend, not a reskin. Routes, layouts, navigation, components, content hierarchy, and visual language are all replaced. The old frontend creates **no** compatibility obligation: no legacy redirects, no query-tab preservation, no component reuse, no visual continuity.

"Like Udemy" authorises the *polish* of course discovery and learning. It authorises no Udemy feature.

---

## 2. Source of truth and conflict rules

When this document, old copy, the current UI, and backend behaviour disagree, resolve in this order:

1. Current backend authorisation and domain behaviour.
2. Shared contracts and persisted data.
3. This specification's organisation and presentation of those capabilities.
4. Current frontend behaviour.
5. Old status reports, screenshots, and marketing copy.

A control that is local-only, unbacked by an API, or inconsistent with authorisation **is not a feature** and must not be rebuilt. Known examples to delete: tutor category / native-speaker / availability filters, and local-only tutor time-off.

---

## 3. Goals, guardrails, and success

### 3.1 Goals

- Make the choice between live tutoring and self-paced courses understandable in one viewport.
- Get every role to its primary task in **one** navigation action and every transaction done in **one** panel.
- Replace query-tab dashboards with stable, linkable, shareable routes — including every panel and sheet.
- Make booking, enrolment, payments, payouts, and moderation explicit, reviewable, and server-authoritative.
- Give courses a focused catalog, decision page, library, and protected player.
- Give live learning one coherent path from discovery to classroom completion.
- Build Arabic RTL and English LTR from one semantic component system, not two layout trees.
- Meet WCAG 2.2 AA from 320 px to ultrawide.
- Establish an original premium identity with no relation to the current teal/gold UI.

### 3.2 Non-negotiable guardrails

- Every capability in §26 must be reachable in the new IA.
- No screen advertises an action the domain cannot complete.
- No hidden "coming soon" nav, disabled upsells, fake metrics, or placeholder filters.
- Only enabled, correctly configured payment methods appear.
- Permission-restricted operations are **absent**, not disabled.
- All money and lesson times come from the server; the browser never invents an authoritative total or status.
- Beauty never costs correctness: no decorative element may delay, obscure, or animate a financial or classroom state (§18.7).

### 3.3 Success definition

A first-time visitor identifies both learning modes, inspects the relevant offer without signing in, and knows the next step. Each authenticated role reaches its primary task in one action. Every current capability has a route, a state set, an interaction budget, and an acceptance rule in this document.

---

## 4. Decision register

Decisions carried from v1.0 (unchanged, still binding):

| Question | Decision | Reason |
| --- | --- | --- |
| What is MRH first? | One marketplace; live tutoring and courses are peers. | Both are implemented; neither may look bolted on. |
| Language-only marketplace? | No new category claim. Use existing tutor specialization/language and course title/description. | No subject taxonomy exists. |
| Universal search on home? | No. Two learning-mode paths and destination-specific discovery. | Tutor search exists; course search/recommendation does not. |
| Does "like Udemy" authorise features? | No — catalog polish, decision hierarchy, library, player, progress only. | Ratings, quizzes, certificates, notes, downloads, authoring do not exist. |
| Separate tutor registration? | No. One learner account + authenticated "Become a tutor" application. | The role-switch model supports one identity. |
| Do old URLs survive? | No. Locale-prefixed new routes, no redirects. | Greenfield authorised. |
| One giant dashboard? | No. Task-based workspace per role with a deliberate role switch. | Removes mixed-role clutter, keeps one identity. |
| Admin and SubAdmin shell? | Same shell; navigation and row actions built from effective permissions. | SubAdmin must never be teased with inaccessible finance or decisions. |
| Corporate training as a product area? | No. Public proposition + email inquiry only. | No corporate domain exists. |
| Promote Meet equally? | No. MRH classroom is primary; Meet appears only when configured or as failure fallback. | One concept of where a lesson happens. |
| Light and dark modes? | Yes, both first-class, new palette. | Already a product capability. |
| Accessibility level? | WCAG 2.2 AA as an acceptance condition. | Defensible standard for a new transactional frontend. |

New decisions introduced by v2.0:

| Question | Decision | Reason |
| --- | --- | --- |
| Wizards or panels for transactions? | **Panels.** Booking, enrolment, add-funds, and payout are each a single surface with a live consequence line, not a stepped wizard. | Every step boundary is a drop-off and a state to test. The domain data for each transaction fits one screen. |
| Do sheets and panels get URLs? | **Yes.** Every substantial panel is a route, intercepted into a side panel when opened from a list and rendered full-page on direct load. | Preserves Back, sharing, and deep links without a second layout. |
| One messaging/notification/settings implementation or two? | **One**, role-aware. | Two of each was duplication, not product. Eligibility rules already differ by role at the API. |
| Does a lesson have one page or two? | **One** — `/lesson/{id}`, role-aware actions. | Same object, same facts; only the action set differs. |
| What does an admin see first? | **A Queue**, not a dashboard. A single triage list of everything awaiting a human decision. | Ops work is a work-list, not a metric-watching job. Tables remain, one level in. |
| Are tutors and students separate admin areas? | **One `/ops/people`** list with a role filter; the detail view adapts. | Same identity domain; halves the surface. |
| Serif or sans for display? | **Serif display (Fraunces / Noto Naskh Arabic) + sans UI (IBM Plex Sans / IBM Plex Sans Arabic).** | A bilingual editorial voice is the cheapest, most durable source of distinction; Plex is a genuine Latin+Arabic superfamily. |
| What carries brand colour? | **Paper, ink, and one Signal violet**, with Ember used sparingly for human warmth. | Distinction comes from paper, scale, and photography — not from an exotic hue that fails contrast. |
| Is dark mode blue-black? | No — **warm plum-charcoal**. | Warm dark reads premium and matches the paper identity; blue-black is the LMS default. |

---

## 5. Roles and permission model

### 5.1 Visitor
Views marketing pages, tutor discovery and approved profiles/reviews, approved courses and details, teacher-training articles, help/legal, and corporate. May start sign-in, registration, password recovery, email verification, a tutor application, or guest course checkout where allowed.

### 5.2 Student
Discovers and saves tutors; requests, cancels, joins, and reviews eligible lessons; enrols in and learns from courses; uses wallet and payment history; messages eligible tutors; manages notifications and account settings; uses vocabulary; applies to become a tutor; deletes the account.

### 5.3 Tutor applicant
The same identity with a `pending` or `rejected` tutor profile. Sees application status and rejection reason, keeps allowed account settings, and takes only backend-exposed application next steps. **Never** sees approved-tutor operations.

### 5.4 Approved tutor
Switches into the tutor workspace; manages public profile and recurring availability; decides booking requests; manages lessons and students; uses messages and classroom; inspects insights; submits course metadata and inspects course/referral performance; manages earnings, payouts, and Stripe onboarding; reads training articles; uses account settings.

### 5.5 Admin
Full operations access: users, tutors, applications, students, lessons, reports, staff, courses, reviews, payments, payouts, articles, payment methods, platform settings, impersonation.

### 5.6 SubAdmin
Only server-assigned effective permissions. Today the safe managed areas are tutors and students. A SubAdmin may add moderation/rejection notes where supported but **cannot** make final tutor approve/reject decisions, reach finance/settings/staff, or impersonate. Routes, nav groups, queue item types, and row actions are all derived from permissions.

### 5.7 System
`system` is an internal domain role with no human workspace.

---

## 6. Objects, states, and fixed vocabulary

Use these exact concepts in UI copy, filters, badges, URLs, tests, and analytics.

| Object | Canonical states and rules |
| --- | --- |
| Tutor profile | `pending`, `approved`, `rejected`; rejected carries a reason when supplied. |
| Lesson | `pending`, `confirmed`, `completed`, `cancelled`. Rejecting a request produces a cancellation; "rejected" is not a stored lesson state. |
| Course | `pending`, `approved`, `rejected` displayed if returned. Admin UI must not imply a reject transition that is not implemented. |
| Review | Pending until approved; admin/SubAdmin moderate with the supported approve/delete behaviour. Only approved reviews are public. |
| Payment | `pending`, `approved`, `rejected`; refund outcomes shown when payment history returns them. |
| Payout | `pending`, `success`, `failed`, with operational note/error when available. |
| Enrollment | One student/course enrolment; a refund can revoke access. Progress derives from lesson completions. |
| Classroom | Inactive until its lesson is confirmed; restricted to that lesson's student and tutor. |
| Availability | Recurring weekday start/end blocks, always interpreted with an explicit timezone. |
| Notification | Read or unread. |

**Status is never colour-only.** Every status is icon + text + accessible colour pair.

**Fixed terminology.** *Tutor* (never alternating with Teacher, except the established "Teacher Training" content title). *Live lesson* for a scheduled tutor session; *Course lesson* for an item in course progress. *Request sent* for a pending live lesson; *Confirmed* only after tutor acceptance and successful charge. *Learner* is allowed in marketplace copy; *Student* remains the exact account role in operational copy. *Saved* replaces "Favorites" in visible copy (the API concept is unchanged).

---

## 7. Information architecture and routes

All routes are locale-prefixed with `/{locale}` (`ar` | `en`). `/` redirects to the resolved locale. Switching locale keeps the equivalent route and updates `lang` and `dir`. Auth redirects preserve a validated internal return path.

**Route law:** every substantial view has a URL. Panels and sheets are intercepted routes — side panel when opened from a list, full page on direct load or refresh. Nothing consequential lives only in a modal.

### 7.1 Public

| Route | Purpose |
| --- | --- |
| `/{locale}` | Marketplace home: the two learning modes, live tutors, approved courses, how each mode works, tutor and corporate calls to action. |
| `/{locale}/tutors` | Tutor discovery with only supported search/filter/sort. |
| `/{locale}/tutors/{tutorId}` | Tutor decision page: identity, rate, intro, bio, approved reviews, API statistics, availability. |
| `/{locale}/tutors/{tutorId}/book` | **Booking panel** — one surface, deep-linkable, auth-return safe. |
| `/{locale}/courses` | Approved course catalog. |
| `/{locale}/courses/{courseId}` | Course decision page. |
| `/{locale}/courses/{courseId}/enroll` | **Enrolment panel** — wallet enrolment or guest card checkout. |
| `/{locale}/become-a-tutor` | Tutor proposition and application entry. |
| `/{locale}/resources` | Published teacher-training article library. |
| `/{locale}/resources/{articleId}` | Published article. |
| `/{locale}/corporate` | Corporate-training proposition and email inquiry. |
| `/{locale}/help` | Help and FAQ in one page with anchored sections (`#faq`). |
| `/{locale}/privacy`, `/{locale}/terms` | Legal. |

### 7.2 Authentication and entry

| Route | Purpose |
| --- | --- |
| `/{locale}/sign-in` | Email/password plus configured social providers. |
| `/{locale}/sign-up` | Student registration. |
| `/{locale}/verify-email` | Verification result and resend. |
| `/{locale}/forgot-password` | Reset request. |
| `/{locale}/reset-password` | Token-based reset. |
| `/{locale}/confirm-email` | Email-change confirmation. |
| `/{locale}/auth/callback` | Social auth callback. |
| `/{locale}/staff/invite` | SubAdmin invitation acceptance. |

Sign-in and sign-up stay distinct routes: a single email-first identifier step would leak account existence.

### 7.3 Shared authenticated routes (all roles, one implementation)

| Route | Purpose |
| --- | --- |
| `/{locale}/lesson/{lessonId}` | One lesson detail. Facts identical for both participants; action set derived from role and state. |
| `/{locale}/room/{roomId}` | Classroom. Distraction-free shell; pre-join and in-session on one route. |
| `/{locale}/messages` | Conversation list; two-pane on wide screens. |
| `/{locale}/messages/{userId}` | Direct conversation. |
| `/{locale}/notifications` | Notification centre, role-aware links. |
| `/{locale}/account` | Redirects to `/account/profile`. |
| `/{locale}/account/profile` | Name, phone, timezone, avatar. |
| `/{locale}/account/security` | Password, email change, sessions, account deletion. |
| `/{locale}/account/notifications` | Notification preferences. |
| `/{locale}/account/appearance` | Language and light/dark. |
| `/{locale}/account/roles` | Role switch, tutor application entry/status link. |

### 7.4 Learner workspace

| Route | Purpose |
| --- | --- |
| `/{locale}/learn` | **Today** — action-first learner home. |
| `/{locale}/learn/lessons` | Live lessons: Needs action, Upcoming, History, calendar view, `.ics`. |
| `/{locale}/learn/courses` | Enrolled course library and progress. |
| `/{locale}/learn/courses/{courseId}` | Protected course learning page and player. |
| `/{locale}/learn/wallet` | Balance, funding methods, payment history, receipts, invoices. |
| `/{locale}/learn/wallet/add` | **Add funds panel.** |
| `/{locale}/learn/wallet/{paymentId}` | Durable payment status and detail. |
| `/{locale}/learn/saved` | Saved tutors. |
| `/{locale}/learn/words` | Vocabulary lookup and saved words. |

### 7.5 Tutor workspace

| Route | Purpose |
| --- | --- |
| `/{locale}/teach/apply` | Tutor application. |
| `/{locale}/teach/application` | Pending / rejected application status. |
| `/{locale}/teach` | Tutor home: next lesson, decisions waiting, alerts, insight summary. |
| `/{locale}/teach/schedule` | Lessons by state and calendar; entry point to availability. |
| `/{locale}/teach/availability` | Recurring weekly availability. |
| `/{locale}/teach/students` | Students derived from booked lessons. |
| `/{locale}/teach/courses` | Course list, statuses, referral performance. |
| `/{locale}/teach/courses/new` | Course metadata submission. |
| `/{locale}/teach/courses/{courseId}` | Course status, referral link and stats. Not a curriculum editor. |
| `/{locale}/teach/earnings` | Earnings, commission history, Stripe onboarding, payouts. |
| `/{locale}/teach/earnings/payout` | **Payout request panel.** |
| `/{locale}/teach/insights` | Lesson, student, review, hour, and earnings data returned by the API. |
| `/{locale}/teach/profile` | Public profile editing with live preview. |
| `/{locale}/teach/resources` | Teacher-training article library. |

Tutors use the shared `/messages`, `/notifications`, `/account/*`, `/lesson/{id}`, `/room/{id}`.

### 7.6 Operations (Admin and SubAdmin)

| Route | Purpose |
| --- | --- |
| `/{locale}/ops` | **Queue** — every item awaiting a human decision, filtered by effective permissions. |
| `/{locale}/ops/people` | Unified user list (tutors, applicants, students) with role/status filters. |
| `/{locale}/ops/people/{userId}` | Adaptive detail: tutor application review, tutor profile, or student record. |
| `/{locale}/ops/lessons`, `/{lessonId}` | Lesson operations. |
| `/{locale}/ops/courses`, `/new`, `/{courseId}` | Course management and video-quality approval. |
| `/{locale}/ops/reviews` | Review moderation. |
| `/{locale}/ops/reports` | Submitted issue reports. |
| `/{locale}/ops/money/payments`, `/{paymentId}` | Payment ledger and manual-payment review. |
| `/{locale}/ops/money/payouts`, `/{payoutId}` | Payout queues and tutor wallets. |
| `/{locale}/ops/money/methods` | Payment method configuration, enablement, ordering. |
| `/{locale}/ops/staff`, `/{staffId}` | Employee/SubAdmin records, invitations, activation. |
| `/{locale}/ops/articles`, `/new`, `/{articleId}` | Teacher-training article CRUD and publishing. |
| `/{locale}/ops/settings` | Platform, maintenance, exchange rate, commission settings. |
| `/{locale}/ops/insights` | Platform KPIs; every metric links to the collection that explains it. |

---

## 8. Shells and navigation

### 8.1 Public header
Left to right (logical `start` to `end`): brand; **Find a tutor**; **Courses**; **Teach**; **More**; locale; theme; **Sign in** / account. "More" holds Corporate, Resources, Help, and legal. The header is transparent over the home hero and becomes an opaque surface with a hairline on scroll. Mobile uses a semantic disclosure drawer with `aria-expanded`/`aria-controls` — never `menu`/`menubar` roles.

### 8.2 Learner shell
Desktop rail (5): **Today**, **Lessons**, **Courses**, **Messages**, **Wallet**. Account utilities (avatar menu): Saved, Words, Notifications, Account, Switch role, Sign out.  
Mobile bottom bar (5): Today, Lessons, Courses, Messages, Me.  
Badges appear only for genuine unread messages, unread notifications, or lessons needing action.

### 8.3 Tutor shell
Desktop rail (6): **Home**, **Schedule**, **Students**, **Messages**, **Courses**, **Earnings**. Availability is reached from Schedule; Insights and Public profile from Home; Resources and settings from account utilities.  
Mobile bottom bar (5): Home, Schedule, Messages, Earnings, More.

### 8.4 Operations shell
Fixed rail grouped **Queue · People · Learning · Money · Platform**; groups and items constructed from effective permissions — a SubAdmin sees Queue and People only. Mobile uses a drawer. A permanent environment/role chip states which operator is acting.

### 8.5 Cross-shell laws
- One page title and one primary action per page region.
- Back always works. A state-changing surface is never the only route to a substantial detail view.
- Breadcrumbs only on nested detail/edit pages.
- Unsaved-change prompts only when a form is dirty.
- Impersonation shows a persistent high-contrast banner naming the impersonated user with an always-visible **Exit impersonation**, on every route.
- Maintenance mode replaces public and workspace shells with the maintenance experience while exempting allowed operations access.
- Skip link, one meaningful `h1`, and landmark regions on every route.

---

## 9. Interaction budgets and the laws of simple flows

### 9.1 Six laws

1. **One surface per decision.** If the data fits one screen at 360 px with scrolling, it is one screen — not a wizard.
2. **Show the consequence before the commit.** Every financial or state-changing panel carries a *Money Line* or *State Line* (§19.2) that states what will be true after the action.
3. **Default the common answer.** 25 minutes preselected; nearest available slot preselected; wallet preselected when the balance covers the price; the learner's own timezone preselected.
4. **Never lose input.** Errors return to the same surface with every selection intact; drafts survive navigation and reload.
5. **One irreversible confirm, never two.** Destructive and financial actions get exactly one explicit confirmation, with the consequence restated inside it.
6. **Truth over optimism.** No optimistic success for anything the server owns. Pending is a first-class, well-designed state — never a greyed-out placeholder.

### 9.2 Interaction budgets (acceptance criteria)

Counted as deliberate user interactions after arriving at the starting point, on mobile, with defaults accepted.

| Flow | Start | Budget |
| --- | --- | --- |
| Home → tutor list | Home | 1 |
| Tutor card → lesson request sent | `/tutors` | 4 (open profile → Book → pick slot → Send request) |
| Course card → enrolled (sufficient balance) | `/courses` | 3 (open course → Enrol → Confirm) |
| Add funds (card) | `/learn/wallet` | 4 (Add funds → amount → method → Confirm) |
| Join a live lesson from any authenticated page | any | 2 |
| Tutor accepts a request | `/teach` | 2 (open request → Accept, with inline confirm) |
| Tutor marks a lesson complete | `/teach/schedule` | 2 |
| Tutor requests a payout | `/teach/earnings` | 4 |
| Student leaves a review | `/learn/lessons` | 3 |
| Ops decision on any queue item | `/ops` | 2 |
| Locale switch anywhere | any | 1 |

Exceeding a budget is a design defect, not a preference. Where a required domain input makes the budget impossible, the budget is amended in this document — not silently missed.

### 9.3 Loading, empty, and error contract (every data surface)

- **Skeletons match the shape they replace.** No indefinite spinner pages. Skeletons carry no fake numbers.
- **First-use empty state** with one relevant next action and one line of copy.
- **Filtered no-results** state with a clear-filters action, distinct from first-use empty.
- **Inline validation** plus a form-level error summary that links to each invalid field.
- **Permission and session-expiry recovery** that returns to the same intent after re-auth.
- **Retry that never duplicates a mutation.**
- **Not-found and deleted/unavailable** states with a route out.
- **Success** confirmed near the action and announced politely to assistive technology.

Toasts are for transient confirmations only. Financial, booking, enrolment, application, and payout outcomes require a durable page or row state.

---

## 10. Public marketplace screens

### 10.1 Home

```
┌──────────────────────────────────────────────────────────────┐
│  [brand]        Find a tutor  Courses  Teach  More   AR EN ☾ │  transparent over hero
├──────────────────────────────────────────────────────────────┤
│                                              ╭─────────────╮ │
│   Learn live.                                │             │ │
│   Or learn on your own time.                 │  photograph │ │  Aperture arc
│   ────────────────────────────               │  of a real  │ │  behind, ONE per page
│   ┌────────────────┐ ┌────────────────┐      │  lesson     │ │
│   │ Find a tutor → │ │ Browse courses │      ╰─────────────╯ │
│   └────────────────┘ └────────────────┘                      │
├──────────────────────────────────────────────────────────────┤
│  Tutors on MRH                                   See all →   │
│  ◀ [tutor][tutor][tutor][tutor]  ▶      ← the Shelf          │
├──────────────────────────────────────────────────────────────┤
│  Courses you can start today                     See all →   │
│  ◀ [course][course][course]  ▶                               │
├──────────────────────────────────────────────────────────────┤
│  How a live lesson works        │  How a course works        │
│  01 Choose a tutor              │  01 Choose a course        │
│  02 Request a time              │  02 Enrol                  │
│  03 Your tutor confirms         │  03 Watch and learn        │
│  04 Meet in the classroom       │  04 Mark lessons complete   │
│  (charged only on confirm)      │                            │
├──────────────────────────────────────────────────────────────┤
│  Teach on MRH →      Training for teams →                    │
├──────────────────────────────────────────────────────────────┤
│  Footer: help, legal, locale, theme                          │
└──────────────────────────────────────────────────────────────┘
```

Rules: the hero states the promise and offers the two learning modes as equal, equally weighted actions. No global subject search sits between the visitor and that choice. The two "how it works" columns are the only place the pricing rule ("you are charged only when your tutor confirms") appears above the fold of a scroll — it is a trust asset, not fine print.

**No fabricated learner count, success rate, course count, testimonial, category, rating, or outcome may appear anywhere.** If the API returns no rating for a tutor, the card shows no rating slot at all — not "no reviews yet" styled as a metric.

### 10.2 Tutor discovery

Supported controls only: search across name/bio/specialization; teaching language; minimum and maximum hourly price; sort by price ascending or descending.

Desktop: filter bar pinned under the header (not a sidebar — it keeps the results grid full width), result count, applied-filter chips with individual remove, clear-all. Mobile: a **Filter** button opening a sheet with Apply and Reset, and the same chips inline above results.

Tutor card contains only: avatar, name, specialization, teaching languages, hourly rate, save control, and rating/review data **when the API supplies it**. It must not claim country, native-speaker status, online state, credentials, years of experience, or open time slots. Hover/focus raises the card by one elevation step and reveals nothing new — no hover-only information.

States: skeleton grid matching card shape; no-results with clear-filters; network error with retry.

### 10.3 Tutor profile and the booking panel

```
┌───────────────────────────────────────┬──────────────────────┐
│ ⌾ Avatar   Name                       │  $18 / hour          │  ← sticky on desktop
│            Specialization             │  ────────────────    │     inline card on mobile
│            Speaks: Arabic, English    │  Book a lesson  →    │
│            ★ 4.8 (23)  ← only if API  │  Message            │
│            [Save]                     │  Save               │
├───────────────────────────────────────┤                      │
│ ▶ Intro video (only if present)       │                      │
│ About                                 │                      │
│ Reviews (approved only)               │                      │
│ Weekly availability — in your timezone│                      │
└───────────────────────────────────────┴──────────────────────┘
```

Decision hierarchy is fixed: identity and approval cue → specialization, languages, rate → actions → intro video → bio → approved reviews → API statistics → recurring availability rendered in the viewer's timezone. The sticky action card must never cover focused content or the last 96 px of the page. Visitors see everything public before authenticating; after sign-in they return to the same tutor and the same booking intent.

**Booking panel** (`/tutors/{id}/book`) — one surface, right-side panel on desktop, full-screen sheet on mobile:

```
Book with {Tutor}                                        [×]
Times shown in Africa/Cairo · change in Account

  Mon 28   Tue 29   Wed 30   Thu 31   Fri 1   ▸        ← day rail
  ─────────────────────────────────────────────
  09:00   09:30   [10:00]  10:30   11:00  …            ← slot rail, nearest preselected

  Duration    ( 25 min )  ( 50 min )                   ← segmented, 25 default

  ┌──────────────────────────────────────────────┐
  │ Wed 30 Jul · 10:00–10:25 · Africa/Cairo      │     ← the State Line
  │ $7.50            Wallet $42.00 → $34.50      │     ← the Money Line
  │ You are charged only if {Tutor} accepts.     │
  └──────────────────────────────────────────────┘

              [  Send lesson request  ]
```

Behaviour: the display price is hourly rate × duration ÷ 60 and is confirmed against server data before submit. Past times, times outside availability, overlaps, and double bookings are impossible to select — unavailable slots are rendered as unavailable, never selectable-then-rejected. If a slot is taken between render and submit, the panel explains it, refreshes the rail, and keeps the duration choice. Signed-out visitors get the panel, choose a time, and authenticate at submit; the intent survives sign-in and the panel reopens populated.

Outcome: the panel becomes a result state — "Request sent", lesson `pending`, links to the lesson and to Lessons. The word "Booked" never appears before tutor acceptance.

### 10.4 Course catalog

Approved courses only. Card: thumbnail (16:9, reserved dimensions, no layout shift), title, tutor, price. No implied server search, recommendation, category, or personalisation. No rating, review count, duration, level, badge, learning outcome, or category — none of those exist in the domain.

### 10.5 Course decision page and enrolment panel

Content: large thumbnail, title, tutor identity linking to the tutor profile, description, price, and a single state-aware action:

| Viewer | Action |
| --- | --- |
| Visitor | **Enrol** → guest card checkout, or "sign in to pay from your wallet" |
| Student, not enrolled | **Enrol** → wallet enrolment panel |
| Student, enrolled | **Continue course** → `/learn/courses/{id}` |
| Tutor owner / admin | Preview or manage per existing authorisation |

The enrolment panel is one surface:

```
Enrol in {Course}                                        [×]
{Tutor}

  ┌──────────────────────────────────────────────┐
  │ $29.00                                        │
  │ Wallet $42.00 → $13.00                        │   ← Money Line
  └──────────────────────────────────────────────┘
  ▸ Have a promo code?        ← collapsed by default

              [  Enrol for $29.00  ]
```

Promo redemption is supported and collapsed until asked for; if a code makes the price zero the button reads **Enrol free**. Insufficient balance replaces the button with **Add $12.00 and enrol**, which routes to add-funds with the amount and return intent prefilled. Duplicate enrolment is prevented and explained. Referral codes captured from the URL retain the existing 30-day attribution. No preview lesson, curriculum claim, outcome list, requirement list, rating, or certificate language exists on this page.

Guest card checkout collects the existing first name, last name, and email, then creates a Stripe checkout. The browser never marks the enrolment paid — the result is webhook-authoritative. If the backend creates an unverified student identity, the outcome tells the learner to use **Forgot password** to establish access. Existing non-student accounts and duplicate enrolments receive exact recovery guidance.

### 10.6 Teach, corporate, resources, help, legal

- **`/become-a-tutor`** — proposition, the honest commission story (§16.2 tiers, presented as a table), what approval requires, and one **Apply to teach** action that routes signed-out visitors through sign-up and back into `/teach/apply`.
- **`/corporate`** — bilingual informational page and an email inquiry link matching its existing proposition. No form submission, corporate account, group management, or reporting portal.
- **`/resources`** — published articles only; article detail preserves content, publish metadata when available, loading, not-found, and bilingual behaviour. Reading measure 680–760 px.
- **`/help`** — one page: contact, common questions as an accessible disclosure list at `#faq`, and links to legal.
- **`/privacy`, `/terms`** — editorial reading layout, locale-complete.

---

## 11. Authentication and account

### 11.1 Registration
Fields: first name, last name, email, phone where the current contract requires it, timezone (geo-defaulted, editable), password, confirmation, and required legal consent. Password guidance states the server's **15-character** rule up front, not after failure. Submit creates the account and moves to "Check your email" with resend and change-address recovery where supported.

Tutor intent is handled after account creation at `/teach/apply`. No competing tutor-only identity flow exists.

### 11.2 Sign-in
Email/password plus only the configured Google, Facebook, or Apple providers — configured providers appear above the email form; unconfigured ones do not exist. Safe internal return paths are preserved. Invalid credentials, inactive/deleted accounts, unverified email, rate limits, and provider failures are explained **without leaking account existence**. When a new student login invalidates a prior session, the old device resolves to a clear signed-out state with a plain explanation.

### 11.3 Verification and recovery
- **Verification:** token success, expired/invalid token, already verified, resend with cooldown and error states.
- **Forgot password:** identical success message regardless of account existence.
- **Reset password:** token validity, the 15-character rule, confirmation, success into sign-in.
- **Email change:** authenticated initiation with password or Google reauthentication as required; the confirmation route reports a durable outcome.
- **Staff invitation:** token details, 48-hour expiry, password setup, acceptance, and expired/already-used recovery.

### 11.4 Account (shared by all roles)
- **Profile:** first/last name, phone, timezone, avatar (JPEG/PNG/WebP, ≤2 MB, client-guided and server-authoritative).
- **Security:** email change, password change, session state, account deletion.
- **Notifications:** email, SMS, browser, lesson reminders, new messages, promotions, payment updates.
- **Appearance:** Arabic/English and light/dark, applied immediately and persisted.
- **Roles:** current role, switch, and the tutor application entry or status link.

**Account deletion** requires typed confirmation and states plainly that the server soft-deletes the account, cancels pending and confirmed lessons, refunds confirmed lesson charges, and ends the session. The UI reports the server's result; it never optimistically removes the user.

---

## 12. Live tutoring

### 12.1 Today (`/learn`)

One column of decisions, in this order, each rendered only when real data exists:

1. **Next confirmed lesson** — tutor, local time, countdown, **Join** when eligible, message and `.ics` secondary.
2. **Requests waiting on your tutor** — pending lessons with cancel.
3. **Continue learning** — in-progress enrolled courses with aggregate progress.
4. **Unread** — messages and notifications as counts linking to their routes.
5. **Do something next** — Find a tutor, Browse courses, Saved tutors, Add funds, Look up a word.

Only current lesson, enrolment, balance, and unread data is used. Live lessons and course progress are **never** merged into a single score, and no recommendation is fabricated.

### 12.2 Lessons (`/learn/lessons`)

Three groups, in priority order: **Needs action** (respond, review, or resolve), **Upcoming**, **History** (completed and cancelled). A calendar view toggle is preserved. Each row states participant, local date and time with timezone, duration, price, and status as icon + text. Row actions are state- and role-correct: Join, Cancel, Message, Download `.ics`, Leave a review.

### 12.3 Lesson detail (`/lesson/{id}`, shared)

One page, both participants, identical facts: participants, scheduled time in the viewer's timezone, duration, price, status with its history, classroom availability, Meet link when returned, and `.ics`. The action set differs:

| State | Student | Tutor |
| --- | --- | --- |
| `pending` | Cancel | **Accept**, Reject |
| `confirmed` | Join, Cancel, Message, `.ics` | Join, Cancel, Message, `.ics`, **Mark complete** (only after scheduled start) |
| `completed` | **Leave a review** (once, if not yet submitted), Report issue | Report issue |
| `cancelled` | — (reason shown when returned) | — |

### 12.4 Tutor decision

Accepting rechecks overlap and student balance server-side. On success the lesson becomes `confirmed`, the student is charged, the classroom activates, and Google Calendar/Meet data is created when configured. On insufficient balance or conflict, the lesson stays `pending` and the tutor is told exactly why confirmation did not occur — never a generic failure. Rejecting takes one confirmation and produces a cancelled lesson with no charge.

### 12.5 Lesson lifecycle rules

- Both participants may cancel `pending` or `confirmed` lessons; the server performs the exact refund and the UI displays the server's result.
- Completed lessons cannot be cancelled.
- A tutor may mark complete only after the scheduled start. Completion credits earnings and preserves the fee/tier record.
- Confirmed lessons expose Join when appropriate and the Meet link or fallback where returned.
- Both participants can download the existing `.ics` event.
- Students can save/unsave tutors from discovery, profile, and lesson surfaces.

### 12.6 Reviews and reports

After an owned completed lesson, a student submits one review: 1–5 rating and comment, with an explicit "this is reviewed before it appears publicly" note. Only approved reviews are public. **Report issue** accepts the existing category, optional lesson, and description, and returns a submission result — it promises no ticket thread, assignment, or resolution workflow.

### 12.7 Messaging (`/messages`, shared)

Two-pane on wide screens (list + conversation), list/detail routes on mobile. Preserves pagination, unread counts, real-time incoming messages, and sanitised text.

Eligibility: a student may start a conversation with an approved, active tutor. Otherwise a new conversation requires a confirmed or completed shared lesson, or an existing conversation. A tutor cannot cold-message a student without that relationship. Ineligible states show no composer and explain why.

The composer is text-only. No attachments, calls, reactions, typing indicators, editing, deletion, or group chat. A failed send keeps the draft, marks the message as failed in place, and offers retry — never a duplicate optimistic message.

---

## 13. Classroom (`/room/{roomId}`)

### 13.1 Authorisation
Only the lesson's student and tutor may enter, and the lesson/classroom must be confirmed and active. Both page load and socket join revalidate membership. Unauthorised, inactive, ended/ineligible, network-failure, and missing-room states each have distinct copy and a distinct route out.

### 13.2 Pre-join — one screen, one button

```
┌──────────────────────────────────────────────────────────────┐
│                    Lesson with {Name}                        │
│                 Wed 30 Jul · 10:00 · 25 min                  │
│        ┌────────────────────────────────┐                    │
│        │      local camera preview      │   Mic  ●  on       │
│        │   (or a calm placeholder)      │   Cam  ○  off      │
│        └────────────────────────────────┘                    │
│                  [   Join classroom   ]                      │
│         Meet link · only when configured or after failure    │
└──────────────────────────────────────────────────────────────┘
```

Connection and permission feedback is inline and plain-language. The existing voice/camera choices are preserved. **No browser device picker is added.** The Meet fallback appears only when a configured link exists or a connection failure makes it relevant.

### 13.3 In session

The learning surface dominates: participant video, whiteboard, or the synchronised lesson book. Chat, participants, and tools are side panels on wide screens and mutually exclusive drawers on small screens — never two at once on mobile. A stable **Dock** keeps voice, camera, screen share, tools, report, and leave reachable. **Leave is spatially separated from the media controls** and always confirms.

Preserved exactly, with no additions:

- Participant presence plus connection health and round-trip state.
- Sanitised, rate-limited text chat.
- Voice call and camera call over WebRTC.
- Screen sharing.
- Collaborative persisted multipage whiteboard: colour, width, eraser, undo, clear, page navigation.
- Tutor PDF upload/delete up to 20 MB, page rendering, present/close, synchronised page control.
- Participant-visible watermark and the existing best-effort copy/print/save/tab-hiding deterrence.
- Report issue.
- Google Meet direct/fallback path where returned.
- Role-correct return destination on leave.

Copy about protection must be truthful: watermarks and browser deterrence reduce casual copying and **cannot** prevent operating-system screenshots. Never claim otherwise.

Forbidden: recording, captions, reactions, hand raising, breakout rooms, background effects, chat file sharing, classroom notes, course-content integration.

### 13.4 Failure behaviour
Media permission denial explains how to continue with the capabilities available. Peer connection failure shows reconnection state, then the Meet fallback when present. Socket reconnection must not duplicate chat messages or whiteboard operations. A book or whiteboard sync problem reports stale state and resynchronises from the server. Status announcements never steal keyboard focus.

### 13.5 Classroom visual rules
The classroom uses the **Focus** atmosphere at its most extreme: near-neutral surfaces, no decorative colour, no Aperture, no gradient, motion limited to state transitions under 150 ms. Connection quality is shown as icon + text + colour, never colour alone. Nothing decorative may compete with the learning surface for GPU or attention.

---

## 14. Self-paced courses

### 14.1 Library (`/learn/courses`)
Enrolled courses as a shelf/grid: thumbnail, title, tutor, aggregate progress, **Continue**. Continue resolves from existing completion data. The UI must not claim a saved video position, because none is stored.

### 14.2 Learning page (`/learn/courses/{courseId}`)

```
┌──────────────────────────────────────────┬───────────────────┐
│                                          │  Course title     │
│        protected signed player           │  38% complete     │
│                                          │  ──────────       │
│                                          │  ✓ Lesson 1       │
├──────────────────────────────────────────┤  ▸ Lesson 2  ←    │
│  Lesson title                            │    Lesson 3       │
│  [ Mark lesson complete ]                │    Lesson 4       │
│  Description as returned by the API      │                   │
└──────────────────────────────────────────┴───────────────────┘
```

Playback uses the protected signed Bunny content exposed by the current contract. Ownership, enrolment, or admin authorisation gates playback; signed URLs and tokens are transient and never persisted to browser storage or logs. Curriculum information is rendered only as the API returns it. Lesson completion is manual and explicit; aggregate progress derives from completions. A Stripe refund revokes access and reverses the related financial and completion effects per the server. On mobile the curriculum panel becomes a drawer beneath the player.

Absent by design: certificates, quizzes, assignments, course ratings, wishlist, cart, bundles, subscriptions, notes, downloads, transcripts, discussions, offline access.

### 14.3 Tutor course submission and referral
Approved tutors submit existing metadata only: title, description, price, thumbnail. Submission becomes `pending`. `/teach/courses/{id}` shows status, the existing referral link with copy action, and current referral sales and revenue statistics. It exposes **no** lesson/video authoring, because no tutor curriculum endpoint exists. The frontend may render backend-returned course lessons but must never fabricate create/edit/upload controls.

### 14.4 Admin course management
Admin lists all courses; creates a course tied to a tutor; edits metadata; deletes; inspects content; and approves **only** after an explicit video-quality confirmation step. A returned `rejected` status may be displayed, but no reject transition is offered unless the backend implements it. Deletion requires review and confirmation and states what is destroyed.

### 14.5 Vocabulary (`/learn/words`)
The learner enters a word or phrase and an optional language and receives the existing AI result: word, pronunciation, part of speech, English definition, examples, and Arabic translation where the service supplies them. Saving stores the returned definition, examples, translation, language, and an optional context sentence. Saved words list newest first; an owned entry can be deleted after confirmation.

The lookup is rate-limited, and the limit is stated before it is hit. If Gemini is unconfigured or unavailable, show a clear unavailable/retry state and keep saved words fully accessible. No flashcards, tests, spaced repetition, audio pronunciation, streaks, or automatic capture from courses/classroom.

---

## 15. Money

### 15.1 Learner wallet (`/learn/wallet`)

Balance first, in the largest type on the page, USD. Then **Add funds**, then payment history. History rows show amount, method, status as icon + text, date, rejection reason where returned, receipt where authorised, and invoice PDF download. `/learn/wallet/{paymentId}` is a durable, linkable status page for any payment — the surface a learner returns to after a redirect, a webhook delay, or a manual review.

**Add funds panel** (`/learn/wallet/add`) — one surface:

```
Add funds                                                [×]
  Amount   [  50.00 ]  ( USD )( EGP )      $5 – $100,000
  ┌──────────────────────────────────────────────┐
  │ Wallet $42.00 → $92.00                        │   ← Money Line
  │ EGP shown at the configured rate              │   (only when EGP)
  └──────────────────────────────────────────────┘
  Method
   ○ Card (Stripe)        pending until confirmed
   ○ PayPal               approve, then captured
   ○ Vodafone Cash        send, then upload receipt
   ○ Instapay · Binance · Bank transfer
  [ receipt upload appears inline for manual methods ]

              [  Add $50.00  ]
```

Only methods reported enabled and sufficiently configured appear. Currencies are USD and EGP; EGP uses the configured exchange rate and becomes unavailable with a plain explanation when the rate is missing. Manual methods show the configured destination details and require a JPEG/PNG/WebP/PDF receipt up to 5 MB, then remain `pending` for admin review — the panel's result state says exactly that and links to the payment's page.

Method semantics, stated in the UI: **Card/Stripe** pending until webhook confirmation; **PayPal** redirect and approval followed by server-side capture before credit; **manual methods** pending until an admin approves.

### 15.2 Tutor earnings (`/teach/earnings`)

Available balance first, then lesson and course earning transactions, historical platform fee and tutor share per transaction, Stripe Connect onboarding/status, and payout history. Commission tiers are server-owned and shown as a plain table wherever a tutor could reasonably ask "why this amount":

| Completed tutor hours | Platform fee |
| --- | ---: |
| Up to 20 | 30% |
| Over 20 through 50 | 24% |
| Over 50 through 200 | 20% |
| Over 200 through 400 | 18% |
| Over 400 | 12% |

Course referral and academy-sale commission rates remain configurable; historical allocations are immutable and displayed as recorded, never recomputed in the browser.

### 15.3 Payout request (`/teach/earnings/payout`)

One panel: amount (minimum $10), method (bank transfer, PayPal, Vodafone Cash, Instapay) with method-specific account fields, a Money Line showing resulting balance, and one commit. Statuses are `pending`, `success`, `failed`, with the admin note or error when returned. A pending payout is **never** labelled paid.

### 15.4 Operations finance (`/ops/money/*`)

- **Payments:** ledger with filters, detail with private receipt inspection, approve/reject with a required reason, exactly one confirmation, and a durable result. Double decisions are blocked server-side and prevented client-side.
- **Payouts:** queues, tutor account detail, Stripe payout where configured, manual approve/reject paths, and grouped course/tutor wallet context.
- **Methods:** payment-method CRUD, destination details and instructions, enabled state, and display ordering.
- **Rates and commissions:** the existing EGP rate and commission keys, with validation and an audit-conscious confirmation that restates the consequence.

---

## 16. Tutor application and workspace

### 16.1 Application (`/teach/apply`)

**One page, three fieldsets, autosaved draft, one submit.** The current eight-screen presentation is replaced without dropping any accepted input.

1. **You and your teaching** — specialization/subject, teaching languages, country where currently captured, bio (server's 50-character minimum stated up front), experience, motivation, optional intro video URL.
2. **Verification** — verification document and the certificate/education inputs currently accepted, with the API's own type and size constraints.
3. **Your rate** — hourly rate ($5–$500), plus a plain notice that recurring availability is configured after approval.

A persistent summary rail (desktop) or collapsible summary (mobile) shows completeness; submit is enabled only when required inputs are valid, and the submit action restates what is being sent. The backend persists structured tutor fields plus application content assembled into the bio — the frontend preserves the submitted meaning and must **not** imply normalised certificate or education records that do not exist.

Submission produces `pending`. `/teach/application` handles pending, approved, and rejected-with-reason, offering retry/edit only where the backend supports it.

### 16.2 Tutor home (`/teach`)

Priority order: next confirmed lesson with Join → booking decisions waiting → operational alerts (Stripe onboarding incomplete, no availability set, profile incomplete) → recent lessons → summary statistics (completed lessons, total hours, earnings, review count and rating, student count, course and referral summaries, Stripe status) as returned. Every statistic links to the collection that explains it.

### 16.3 Schedule and availability

`/teach/schedule` groups **Needs decision**, **Upcoming**, and **History**, with the calendar view preserved. Empty calendar regions link directly to `/teach/availability`.

`/teach/availability` creates, edits, and deletes recurring weekday time ranges using the same **Slot Rail** component as booking. The timezone is stated prominently and permanently. Start/end and overlap are validated inline, and a weekly read-only preview shows the result as a learner would see it. No blackout dates, holidays, one-off time off, minimum notice, buffers, or availability-based filtering.

### 16.4 Students, insights, profile, resources

- **Students** derive from booked lessons: identity, lesson count, hours, and a message action when eligible.
- **Insights** shows only current lesson, student, review, hour, and earnings data.
- **Profile** edits bio, specialization, teaching languages, hourly rate, and intro video, with a live public preview rendering the same component the marketplace uses.
- **Resources** lists published teacher-training articles.

---

## 17. Operations

### 17.1 The Queue (`/ops`) — the redesign's biggest simplification

The default operations surface is a single triage list of everything awaiting a human decision, permission-filtered, newest-critical first:

```
Queue                                    All ▾   Assigned to me is not a feature
──────────────────────────────────────────────────────────────
◆ Tutor application   Sara M.        submitted 2h ago      →
◆ Manual payment      $50 · Instapay · Ahmed K.  1h ago    →
◆ Payout request      $120 · Bank · Yusuf A.     3h ago    →
◆ Course review       "Spoken Arabic A1"         1d ago    →
◆ Pending review      ★4 on lesson #8821         1d ago    →
◆ Issue report        Classroom · lesson #8804   2d ago    →
```

Each row states object type, the identifying facts an operator needs to triage, and age. Selecting a row opens the canonical entity route as a side panel (`/ops/people/{id}`, `/ops/money/payments/{id}`, …) with a real URL; direct navigation or refresh renders the same route full-page. Decisions are taken in the panel and the row resolves in place.

The Queue is constructed from effective permissions: a SubAdmin sees only the item types they can act on, and never sees a finance or final-decision row. Item types with zero items are omitted entirely — no empty section headers.

`/ops/insights` holds the KPIs (users, lessons, payments, courses) and recent activity. Every metric links to the filtered collection that explains it. Metrics are the second screen, not the first.

### 17.2 People (`/ops/people`)

One list of tutors, applicants, and students with role and status filters and search. `/ops/people/{userId}` adapts:

- **Tutor applicant / tutor:** identity, current status, bio, specialization, languages, hourly rate, intro video, verification document access, assembled application content, internal notes, and PDF application export. Full Admin can edit supported profile data and approve or reject with a required confirmation and reason. **SubAdmin can add supported notes and never sees final decision actions.**
- **Student:** supported profile, verification and activity state, balance, and lesson relationships.
- **Impersonate** appears here for full Admin only (§17.6).

### 17.3 Lessons, reviews, reports

- **Lessons:** participants, schedule and timezone, duration, price, state, and related classroom/calendar data. Only currently authorised operational actions appear.
- **Reviews:** lesson, student, and tutor context; approve or delete using the supported actions.
- **Reports:** category, optional lesson, description, reporter, and date. No assignment, status, or thread workflow is added.

### 17.4 Staff (`/ops/staff`)

One area preserving both existing creation paths:

- **Invite by email** with a 48-hour acceptance token.
- **Create directly** and reveal the generated temporary password exactly once.

Fields: first/last name, email, title, and only supported permissions. Admin can edit, deactivate, or delete per current endpoints. Revealed credentials carry an explicit secure-copy warning and are never redisplayed — the UI says so before revealing.

### 17.5 Articles and settings

- **Articles:** create, edit, preview, publish/unpublish where supported, delete. The editor previews in the same reading layout `/resources/{id}` uses, in both locales.
- **Settings:** platform name, contact email, the currently supported default lesson/credit price fields, maintenance mode, EGP exchange rate, and current commission values. Each logical group saves independently; consequential finance changes require a confirmation that restates the effect.

### 17.6 Impersonation

Admin only. Initiation requires a target review and confirmation. While active, every route displays the persistent impersonation banner naming the impersonated user, with an always-visible **Exit impersonation** that returns to the operations context. Backend authorisation continues to govern audit-sensitive actions. SubAdmin never sees this feature in any form.

---

## 18. Visual language — "Paper & Signal"

### 18.1 Two atmospheres, one system

| | **Daylight** | **Focus** |
| --- | --- | --- |
| Where | Home, tutors, courses, teach, corporate, resources, help, legal, auth | Learner and tutor workspaces, wallet, ops, classroom |
| Canvas | Warm paper | Near-neutral paper / warm charcoal |
| Type | Serif display at large sizes, generous measure | Sans throughout, tight and legible |
| Colour | Photography and one Aperture per page carry the colour | Ink, hairlines, and status colour only |
| Density | Generous — one idea per band | Efficient — information per pixel matters |
| Motion | Entrances, parallax-free reveals, ≤260 ms | State transitions only, ≤180 ms |
| Elevation | Cards may lift on hover | Hairlines and background steps, almost no shadow |

Both use the same tokens, the same components, and the same accessibility rules. The difference is **which tokens are allowed**, not a second design system.

Explicitly avoided: the current teal/gold identity; generic LMS blue-on-white; glassmorphism everywhere; gradient soup; mascots and 3D blobs; and the "everything is a floating card" layout.

### 18.2 Colour tokens

Roles and character are fixed; exact values may be nudged during implementation **only** to meet or exceed contrast requirements, and every pair must be verified (§22).

**Light — Paper**

| Token | Value | Use |
| --- | --- | --- |
| `canvas` | `#F7F4EE` | Page background, warm bone paper. |
| `canvas-sunken` | `#EFEBE3` | Wells, table zebra, code/receipt blocks. |
| `surface` | `#FFFFFF` | Cards, panels, menus, sheets. |
| `ink` | `#1A1720` | Primary text, warm near-black with a plum cast. |
| `ink-muted` | `#5C5866` | Secondary text. The **only** approved secondary text colour. |
| `ink-faint` | `#8A8494` | Disabled text and decorative marks. Never load-bearing. |
| `signal` | `#3A2BD6` | Primary actions, links, focus ring. |
| `signal-strong` | `#2A1DA8` | Pressed and active. |
| `signal-soft` | `#EAE7FF` | Selected rows, tinted backgrounds, chart fills. |
| `ember` | `#D8552F` | Human warmth: illustration, accents, Aperture terminus. Fill only. |
| `ember-strong` | `#B4421F` | Ember used behind white text or as text on paper. |
| `success` | `#136F45` / soft `#DFF3E8` | Confirmed, approved, succeeded. |
| `warning` | `#8A5300` / soft `#FBEED8` | Pending, needs attention. |
| `danger` | `#B3261E` / soft `#FBE4E2` | Destructive, failed, rejected. |
| `border` | `#E2DCD1` | Hairlines and control edges. |
| `border-strong` | `#CFC7B8` | Focused/active edges and table rules. |

**Dark — Night Paper** (warm plum-charcoal, deliberately not blue-black)

| Token | Value | Use |
| --- | --- | --- |
| `canvas` | `#15131A` | Page background. |
| `canvas-sunken` | `#100E15` | Wells and inset regions. |
| `surface` | `#1D1A24` | Cards, panels, menus. |
| `surface-raised` | `#252130` | Hover, popovers, dock. |
| `ink` | `#F5F1EA` | Primary text, warm paper white. |
| `ink-muted` | `#B0A9B8` | Secondary text. |
| `ink-faint` | `#7E7688` | Disabled and decorative only. |
| `signal` | `#9E92FF` | Primary actions, links, focus ring. |
| `signal-strong` | `#B9AFFF` | Pressed, active, emphasis. |
| `signal-soft` | `#241F3D` | Selected rows and tints. |
| `ember` | `#FF8A5B` | Warmth accents. |
| `success` | `#4ED598` / soft `#122A20` | |
| `warning` | `#F2B750` / soft `#2B2113` | |
| `danger` | `#FF8177` / soft `#2E1917` | |
| `border` | `#312C3C` | Hairlines. |
| `border-strong` | `#453E52` | Focused edges and rules. |

Rules: **Signal is the only action colour** — never Ember. Ember is a fill and graphic colour; text on Ember must be `ink`, or white on `ember-strong` at ≥18 px. Status is always icon + text + colour. Gradients exist in exactly one place: the Aperture (§18.6), which combines `signal → ember` at low opacity over paper, and never appears in a workspace, form, table, or classroom.

### 18.3 Typography

| Role | English | Arabic |
| --- | --- | --- |
| Display | **Fraunces** (variable; `opsz` and `SOFT` axes) | **Noto Naskh Arabic** |
| UI and body | **IBM Plex Sans** | **IBM Plex Sans Arabic** |
| Numeric and reference | IBM Plex Sans tabular lining figures; IBM Plex Mono for IDs and tokens | same |

Plex Sans and Plex Sans Arabic are one superfamily with compatible metrics — that is why they are chosen; it makes a single bilingual component tree honest.

Fluid scale (root 16 px):

| Step | Size | Line height | Use |
| --- | --- | --- | --- |
| `display-1` | `clamp(2.75rem, 1.4rem + 5.2vw, 5rem)` | 1.02 | Home hero, one per page |
| `display-2` | `clamp(2rem, 1.2rem + 3vw, 3.25rem)` | 1.08 | Section leads, article titles |
| `title-1` | `1.75rem` | 1.2 | Page titles |
| `title-2` | `1.25rem` | 1.3 | Card and panel titles |
| `body-lg` | `1.125rem` | 1.6 | Article and marketing body |
| `body` | `1rem` | 1.55 | Default |
| `body-sm` | `0.875rem` | 1.5 | Tables, metadata, dense workspaces |
| `label` | `0.75rem` | 1.4 | Overlines, chips, table headers |

Rules:
- Display serif is **Daylight only**; Focus surfaces use sans at every size.
- Headings are sentence case. **No all-caps anywhere**, and never in Arabic.
- Arabic gets **+0.15 line-height** at every step and never uses Fraunces italic (italic is reserved for rare English pull-quotes).
- Arabic display uses Noto Naskh Arabic at weight 600 and one step larger optical size than the Latin equivalent to match visual weight.
- Reading measure 680–760 px; forms 560–720 px; no line of body text exceeds 80 characters in English or ~65 in Arabic.
- Money, times, durations, and counts use tabular figures and bidi isolation in RTL.
- Load only used weights and subsets; `font-display: swap` with metric-compatible fallbacks so no layout shift occurs.

### 18.4 Layout, shape, elevation

- **Spacing:** 4 px base; steps 4, 8, 12, 16, 24, 32, 48, 64, 96, 128.
- **Grid:** 4 columns mobile, 8 tablet, 12 desktop; gutters 16/24/32.
- **Widths:** content max 1280 px; editorial bands may run to 1440 px; reading 680–760 px; forms 560–720 px.
- **Radius:** `10 px` controls, `14 px` cards, `20 px` panels and large media, full only for avatars and chips. One radius per surface — no mixed corners.
- **Elevation:** hairline first, background step second, shadow last. Two shadow levels outside overlays, both **warm-tinted** (`rgba(26,23,32,·)`), never pure black:
  - `e1` — `0 1px 2px rgba(26,23,32,.06), 0 1px 1px rgba(26,23,32,.04)`
  - `e2` — `0 8px 24px rgba(26,23,32,.10), 0 2px 6px rgba(26,23,32,.06)`
  - `overlay` — `0 24px 64px rgba(26,23,32,.24)` for sheets, dialogs, and the classroom dock.
  In dark mode shadows are supplemented by a `border` hairline, because shadow alone is invisible on `#15131A`.
- **Touch targets:** 44 × 44 px minimum for primary and mobile controls, even where WCAG 2.2 permits smaller.
- **Density:** workspaces use `body-sm` in tables and `body` elsewhere; row height 48 px comfortable, 40 px compact where an operator opts in.

### 18.5 Imagery and icons

Real, candid learning photography: varied adults, genuine tutor portraits, authentic desks and rooms, legible course artwork. Warm, intelligent, documentary — never staged corporate stock, never a smiling headset call-centre image. Provide focal-point-safe crops at every breakpoint, reserved dimensions to prevent shift, and meaningful alt text; decorative images take empty alt.

Avatars fall back to initials on a `signal-soft` field — never to a generic silhouette.

One outline icon family with directional variants, 1.5 px stroke at 20/24 px. **Mirror** back/forward, chevrons, and spatial panel icons in RTL. **Do not mirror** media controls, clocks, brand marks, or universally fixed symbols.

### 18.6 The Aperture

The single signature graphic: a large, soft arc — a lens opening — rendered as a low-opacity `signal → ember` gradient behind or beside the hero content, cropped by the viewport edge. Rules:

- Exactly **one per page**, and only on Daylight pages.
- Never behind text that carries meaning; contrast is measured against the darkest point of the arc.
- Never animated on load; it may drift ≤8 px on scroll and does not move at all under `prefers-reduced-motion`.
- Never in a workspace, form, table, panel, or classroom.

It is the brand's only ornament, which is what makes it read as intentional rather than decorative.

### 18.7 Motion

| Token | Duration | Curve | Use |
| --- | --- | --- | --- |
| `fast` | 120 ms | `cubic-bezier(.2,.8,.2,1)` | Hover, focus, toggle, checkbox |
| `base` | 180 ms | `cubic-bezier(.2,.8,.2,1)` | Panels, drawers, tabs, row resolve |
| `slow` | 260 ms | `cubic-bezier(.16,1,.3,1)` | Sheet entry, hero reveal |
| `exit` | 120 ms | `cubic-bezier(.4,0,1,1)` | Everything leaving |

Animate `opacity` and `transform` only. Use View Transitions for list → detail continuity where supported, with a static fallback. Motion clarifies drawer origin, selection, progress, and connection state — it never runs ambiently. `prefers-reduced-motion: reduce` removes all non-essential motion and never removes information. **No classroom or financial state is ever communicated by motion.**

### 18.8 Dark mode

Dark mode is not an inversion. Surfaces step *up* in lightness with elevation (`canvas → surface → surface-raised`), never down. Photography gets a 4% warm scrim so it does not glare. Signal shifts to `#9E92FF` so it stays a link colour rather than a hole in the page. Shadows are supplemented by hairlines. Both themes are designed, screenshotted, and visually regression-tested — dark mode is never a derived afterthought.

---

## 19. Components

### 19.1 Signature components (build these first; they define the product)

| Component | Where it appears | Why it exists |
| --- | --- | --- |
| **Shelf** | Home tutors/courses, course library | A horizontal snap-scrolling row of cards with keyboard arrows, visible scroll affordance, and no hover-only content. Replaces endless grids on marketing pages. |
| **Slot Rail** | Booking panel, tutor availability | One day rail + one time rail, timezone-labelled, unavailable times rendered unavailable rather than selectable. Same component both sides of the marketplace. |
| **Money Line** | Booking, enrolment, add funds, payout, ops finance | A single strip: amount, and `balance before → balance after`. The literal implementation of "show the consequence before the commit". |
| **State Line** | Booking, lesson detail, payment detail, application | One sentence of the exact resulting state in domain vocabulary, plus the rule that governs it. |
| **Decision Panel** | Booking, enrolment, add funds, payout, ops decisions | A routed side panel (desktop) / sheet (mobile) with title, body, consequence line, one primary commit, and a durable result state. Every transaction in the product is one of these. |
| **Queue Row** | `/ops` | Object type, triage facts, age, and one affordance to open the canonical detail. |
| **Dock** | Classroom | The stable control bar; leave separated from media controls. |

### 19.2 Foundation

Button (primary/secondary/quiet/destructive), link, icon button, input, textarea, select, checkbox, radio, switch, segmented control, field with label/help/error, form error summary, dialog, sheet/drawer, popover, disclosure, local tabs, tooltip, toast, status banner, badge, avatar, skeleton, empty state, pagination, breadcrumb, table, responsive list, file upload, and copy-to-clipboard.

### 19.3 Marketplace

Tutor card, tutor identity block, language list, price display, save button, review summary, review list, course card, course price/action, learning-mode card, article card, filter bar with chips, and result count.

### 19.4 Transactions

Money Line, balance impact, payment-method option, receipt upload, transaction status with timeline, destructive confirmation, booking review, enrolment review, payout review, and the operations moderation panel.

### 19.5 Learning

Lesson card, lesson detail header, course progress, course card, protected player shell, curriculum list, classroom preflight, media control Dock, connection indicator, chat panel, participant list, whiteboard toolbar and canvas, book presenter, and issue-report dialog.

### 19.6 Operations

Queue Row, KPI with destination, permission gate, entity header, audit/context block, moderation list (no bulk actions — none exist), staff permission editor, setting group, and impersonation banner.

Build composable primitives and domain components once. **Never create a role-specific variant of a pattern that already exists** — that is the duplication v2.0 exists to remove.

---

## 20. Bilingual, RTL, and content rules

- `lang` and `dir` are set on `<html>` for every request; Arabic is `rtl`, English is `ltr`.
- Use CSS logical properties and `start`/`end` throughout. **No duplicated Arabic layout tree exists.**
- Dates, numbers, and currency are formatted with the selected locale; server values are never mutated for display.
- Time selection always names the timezone. Availability and lesson times convert to the viewer's timezone, and the timezone is visible at the moment of choosing, not buried in settings.
- Emails, URLs, IDs, currency amounts, and times are bidi-isolated inside Arabic text.
- Every visible string, accessible name, validation message, status, metadata title/description, email-adjacent instruction, and empty/error state has both Arabic and English copy. A missing translation is a build failure, not a fallback.
- Translation keys are semantic (`booking.consequence.chargedOnAccept`), never positional. Interpolation is typed.
- Arabic copy is written, not translated literally: shorter lines, no all-caps, no English idiom, and numerals per the established project convention applied consistently.
- On mobile, course and classroom side panels become drawers; operations tables become prioritised responsive rows, or a contained horizontally scrolling table where true tabularity is essential.
- At 320 CSS px no page scrolls in two dimensions, except contained data tables and learning canvases, which provide an accessible alternative or control strategy.

---

## 21. Accessibility acceptance criteria

The implementation must meet **WCAG 2.2 AA**.

- Complete keyboard access with a logical focus order and a visible, unobscured focus indicator (3:1 against adjacent colours; the sticky booking card and the classroom Dock must never obscure a focused element).
- Skip link, semantic landmarks, one meaningful `h1`, ordered headings.
- Disclosure navigation uses buttons with `aria-expanded`/`aria-controls`, Escape to close, focus return, and ordinary links — **not** `menu`/`menubar` roles.
- Dialogs and routed panels trap focus, label their purpose, close predictably, and return focus to the trigger.
- Labels are persistent (never placeholder-only); related fields are grouped; errors are text, tied to their control, and summarised with links to each invalid field.
- Financial and destructive actions are reviewable and correctable before commit (WCAG 3.3.4).
- Status updates use appropriate live regions and do not move focus unnecessarily.
- Text contrast ≥4.5:1 (≥3:1 for large text); UI components and focus graphics ≥3:1.
- Pointer targets meet WCAG 2.2 minimums, with 44 px practical targets for primary and mobile controls.
- Media, whiteboard, and book controls have accessible names and state. **Tool selection is never indicated by colour alone** — selected tools carry a border and an accessible pressed state.
- Video alternatives are limited to what the platform actually provides. The UI must never claim captions or transcripts that do not exist.
- Drag operations (whiteboard, if any reordering exists) offer a non-drag alternative (WCAG 2.5.7).
- Test keyboard-only, screen reader, 200% and 400% zoom, reduced motion, forced/high contrast, and both directions across every critical flow.

---

## 22. Frontend architecture

### 22.1 Organisation

Next.js route groups under the locale segment: `(public)`, `(auth)`, `(learn)`, `(teach)`, `(room)`, `(ops)`, plus shared authenticated routes. Decision Panels use intercepting/parallel routes so a panel is a real route with a full-page fallback. Features are grouped by capability, not by a shared "dashboard" component. Shared visual primitives live in the design system package; domain rules live beside their feature module.

### 22.2 Data and authorisation

- **Server authorisation is final.** Client guards improve navigation; they never replace enforcement.
- Page-critical identity and permission data is fetched before protected navigation renders, so no forbidden nav item ever flashes.
- Centralise: normalised API errors, session expiry, locale-aware return paths, money formatting, timezone conversion, and state labels. A status string is produced in exactly one place.
- Mutations use pending locks and idempotent behaviour where the backend supports it. Repeated clicks can never produce a double booking, double enrolment, double payment, or double moderation decision.
- Realtime message and classroom events reconcile into cache by stable ID; reconnection never duplicates a record.
- Signed playback URLs and tokens are transient — never in persistent browser storage, never in logs.
- No secrets, no payment destinations beyond intended display data, and no private tutor documents in client bundles.

### 22.3 Performance

- Public home, catalog, tutor, course, and article pages are server-rendered and metadata-ready where the current data allows.
- Fonts: only used weights and subsets, preloaded for the active locale, with metric-compatible fallbacks — the serif display must not cause a visible reflow.
- Images: responsive sources, modern formats, reserved dimensions, lazy below the fold, eager and preloaded for the LCP hero image only.
- Lazy-load below-fold video, classroom tools, rich editors, and operations-only modules.
- Core Web Vitals "good" at the 75th percentile on representative mobile and desktop: **LCP ≤2.5 s, INP ≤200 ms, CLS ≤0.1**.
- Classroom responsiveness and call quality outrank every decorative asset. The Aperture is CSS, not an image, and never renders in a workspace.

### 22.4 SEO and metadata

Localised metadata, canonical and `hreflang` alternates for every public route, sitemap coverage, meaningful titles and descriptions, and correct not-found behaviour for tutors, courses, articles, corporate, help, and legal. Protected workspaces, the classroom, and operations are not indexed.

---

## 23. Security and privacy UX

- Sanitise all user-generated text at the established trust boundary. Never render raw HTML from messages, reviews, or bios.
- Validate uploads client-side for guidance and server-side for authority; state limits before the user picks a file.
- Tutor verification documents and payment receipts are private and visible only to authorised actors, never in a shareable URL that outlives authorisation.
- Never reveal whether a password-reset email corresponds to an account.
- Preserve CSRF and session-cookie behaviour and validate every internal redirect target.
- Warn, with the consequence restated, before: account deletion, staff credential reveal, course deletion, payment approval or rejection, payout decisions, and impersonation.
- Classroom protection copy is truthful — watermarks and browser deterrence reduce casual copying and cannot prevent OS-level capture.

---

## 24. Explicitly out of scope

Not part of this redesign, because they are not current product capabilities:

- Legacy routes, redirects, components, layouts, colours, or query-tab compatibility.
- New subject/category taxonomy, universal search, recommendations, matching quiz, or personalisation.
- Tutor country / native-speaker / online-now / availability filters unsupported by the API.
- Fabricated tutor country, "years of experience" derived from account age, or trial-lesson claims.
- Trial lessons, subscriptions, group/cohort lessons, packages, coupons beyond current course promo behaviour, or a cart.
- Course ratings/reviews, wishlist, preview lessons, outcomes/requirements, quizzes, assignments, certificates, notes, discussions, downloads, transcripts, saved playback position, autoplay promises, offline learning, bundles.
- Tutor course curriculum or video authoring/upload UI.
- Classroom recording, captions, reactions, hand raising, breakout rooms, background effects, or file sharing.
- One-off tutor time off, blackout dates, booking buffers, minimum notice, or two-way external calendar management beyond current Meet/calendar and `.ics` behaviour.
- Message attachments, group chat, typing presence, edit/delete, reactions, or in-message calls.
- Corporate accounts, organisation dashboards, group administration, cohort reporting, or a lead database.
- Support-ticket assignment, status, or thread workflow.
- Streaks, gamification, competencies, or a fabricated combined learning score.
- Operator assignment/ownership of queue items, bulk moderation actions, or saved ops views.
- New roles, currencies, payment providers, payout providers, or a self-service refund flow.
- Native mobile applications.

---

## 25. Feature-to-route traceability

The "no more, no less" acceptance map. Every current capability appears exactly once.

| Existing capability | New destination |
| --- | --- |
| Home, bilingual content, featured tutors and courses | `/{locale}` |
| Tutor search, price/language filters, sort | `/tutors` |
| Favorite/save tutors | Save control on `/tutors`, `/tutors/{id}`, `/lesson/{id}`; list at `/learn/saved` |
| Public tutor profile, intro video, reviews, availability | `/tutors/{id}` |
| Lesson booking request | `/tutors/{id}/book` |
| Accept, reject, cancel, complete, join, `.ics` | `/lesson/{id}`, `/learn/lessons`, `/teach/schedule` |
| Lesson reviews | Review action on `/lesson/{id}`; moderation at `/ops/reviews` |
| Issue reports | Report action on `/lesson/{id}` and in `/room/{id}`; queue at `/ops/reports` |
| Messaging, unread counts, realtime | `/messages`, `/messages/{userId}` |
| Notifications, read/mark-all-read | `/notifications` + shell badges |
| Native classroom: chat, voice, video, screen share, whiteboard, books, Meet fallback | `/room/{roomId}` |
| Approved course catalog and detail | `/courses`, `/courses/{id}` |
| Wallet enrolment, guest checkout, promo, referral | `/courses/{id}/enroll` |
| Protected video, completions, progress | `/learn/courses/{id}`, `/learn/courses` |
| Tutor course submission, status, referral analytics | `/teach/courses`, `/teach/courses/new`, `/teach/courses/{id}` |
| Wallet balance, funding methods, receipts, invoices | `/learn/wallet`, `/learn/wallet/add`, `/learn/wallet/{paymentId}` |
| Tutor earnings, commission history, Stripe Connect | `/teach/earnings` |
| Payout request and history | `/teach/earnings/payout`, `/teach/earnings` |
| Vocabulary lookup, save, delete | `/learn/words` |
| Tutor application and status | `/teach/apply`, `/teach/application`, entry at `/become-a-tutor` |
| Tutor recurring availability | `/teach/availability` |
| Tutor students, insights, public profile | `/teach/students`, `/teach/insights`, `/teach/profile` |
| Teacher-training articles | `/resources`, `/resources/{id}`, `/teach/resources`, `/ops/articles/*` |
| Corporate information and email inquiry | `/corporate` |
| Profile, avatar, email, password, deletion, preferences, theme, locale | `/account/profile`, `/account/security`, `/account/notifications`, `/account/appearance` |
| Student ↔ tutor role switch | `/account/roles` + account utilities in both shells |
| OAuth, verification, reset, invite acceptance | `/sign-in`, `/sign-up`, `/verify-email`, `/forgot-password`, `/reset-password`, `/confirm-email`, `/auth/callback`, `/staff/invite` |
| Admin overview and action queues | `/ops` |
| Admin KPIs and recent activity | `/ops/insights` |
| Admin tutors, applications, students, users | `/ops/people`, `/ops/people/{userId}` |
| Admin lessons | `/ops/lessons`, `/ops/lessons/{id}` |
| Review moderation | `/ops/reviews` |
| Issue report inspection | `/ops/reports` |
| Course management and video-quality approval | `/ops/courses`, `/new`, `/{courseId}` |
| Payment ledger and manual payment review | `/ops/money/payments`, `/{paymentId}` |
| Payout operations and tutor wallets | `/ops/money/payouts`, `/{payoutId}` |
| Payment-method configuration and ordering | `/ops/money/methods` |
| Staff invitation, direct creation, permissions | `/ops/staff`, `/ops/staff/{staffId}` |
| Platform settings, maintenance, EGP rate, commissions | `/ops/settings` |
| Admin impersonation | `/ops/people/{userId}` action + global banner |
| Maintenance mode | `/ops/settings` + global maintenance gate |
| Help, FAQ, privacy, terms | `/help` (with `#faq`), `/privacy`, `/terms` |
| Error, loading, not-found, sitemap | Global route conventions per §9.3 and §22.4 |

---

## 26. Critical flow acceptance matrix

Every row must pass in **Arabic and English**, **mobile and desktop**, **keyboard-only**, in **both themes**, for the applicable role — and within its §9.2 interaction budget.

| Flow | Required acceptance |
| --- | --- |
| Visitor → tutor → lesson request | Full inspection before auth; booking intent survives sign-in and reopens populated; timezone, duration, and price reviewed in one panel; result says request sent, `pending`, no charge. |
| Slot lost mid-flow | Unavailable slot explained, rail refreshed, duration preserved, no error dead-end. |
| Tutor accepts a request | Server rechecks overlap and balance; `confirmed` only after a successful charge; conflict or insufficient balance leaves an accurate `pending` state with a specific reason. |
| Lesson cancellation and completion | Role and state restrictions enforced; exact server refund/earning displayed; no optimistic success. |
| Classroom entry and session | Authorisation, preflight, join, chat, media, screen share, whiteboard, books, reconnect, Meet fallback, and role-correct leave all work; reconnection duplicates nothing. |
| Wallet-funded enrolment | Duplicate and balance checks; explicit balance impact; protected access only after server success; insufficient balance routes to add-funds with intent preserved. |
| Guest Stripe checkout | Webhook-authoritative result; new-account recovery instruction; no premature enrolment; duplicate/non-student recovery guidance exact. |
| Course learning and progress | Authorisation, signed playback, manual completion, aggregate progress, refund revocation. |
| Add funds | Only configured methods appear; conversion reviewed; webhook/capture/manual states remain accurate; receipt upload constrained; invoice/receipt accessible; durable payment page. |
| Tutor application | Every current input represented; draft survives reload; validation and document constraints correct; pending/rejected/approved outcomes accurate. |
| Tutor payout | Minimum, method, and account validation; consequence reviewed; accurate `pending`/`success`/`failed`; never labelled paid while pending. |
| Ops queue triage | Items permission-filtered; row opens the canonical route as a panel with a working URL; decision resolves the row; direct load renders full page. |
| Admin tutor review | Document, video, and profile context present; full-Admin decision with reason; **SubAdmin sees notes only and no decision affordance anywhere**. |
| Admin manual payment / payout | Private evidence protected; explicit confirmation with reason; no duplicate decision; durable result. |
| Messaging | Eligibility enforced both directions; sanitised content; pagination, unread, realtime; retry without duplication. |
| Account deletion | Consequences disclosed; typed confirmation; server result reflected for lessons, refunds, and session. |
| Locale and direction switch | Equivalent route preserved; `lang`/`dir`, focus, numerals, times, and navigation all correct; no layout regression at 320 px. |
| Impersonation | Admin-only initiation; persistent banner; always-visible exit; SubAdmin never exposed to it. |
| Theme switch | Both themes complete on every shell; no unstyled flash; dark-mode contrast verified. |

---

## 27. Delivery

### 27.1 Sequence

1. Locale routing, auth/session boundary, permission model, design tokens, foundation primitives, and the public shell.
2. The seven signature components (§19.1) — they unblock most of the product.
3. Public: home, tutors, tutor profile + booking panel, courses, course + enrolment panel, become-a-tutor, resources, corporate, help, legal, and all auth routes.
4. Shared authenticated routes: `/lesson/{id}`, `/messages`, `/notifications`, `/account/*`.
5. Learner workspace: Today, lessons, course library and player, wallet and add-funds, saved, words.
6. Tutor application and approved-tutor workspace.
7. Classroom shell and every existing realtime tool.
8. Operations: Queue first, then people, learning, money, and platform, all permission-filtered.
9. Cross-role, financial, accessibility, RTL, performance, and security acceptance; then one planned cutover replacing the old frontend.

This is technical sequencing, not permission to ship a partial replacement as the final product.

### 27.2 Tests

- **Component:** directionality, field errors, status semantics, money and time formatting, permission gates, Money Line arithmetic display, and every consequential confirmation.
- **Integration:** auth return paths, booking state transitions, enrolment and payment outcomes, role switching, SubAdmin filtering, queue permission construction, realtime reconciliation.
- **End-to-end (Playwright):** every row in §26, in both locales, at mobile and desktop widths, keyboard-only for at least the financial and booking rows.
- **Interaction budget tests:** the §9.2 budgets are asserted by counting user actions in the E2E journeys.
- **Accessibility:** automated axe coverage on every route plus manual keyboard, screen reader, 200%/400% zoom, contrast, forced-colours, and reduced-motion passes.
- **Contract:** API tests remain authoritative for financial calculation, authorisation, overlap, refunds, fees, and payout state. The frontend asserts presentation, never arithmetic truth.
- **Visual regression:** both themes × both directions across public, learner, tutor, classroom, and operations shells.

### 27.3 Definition of done

- Every traceability row in §25 is implemented, with a passing journey or documented lower-level coverage.
- Every §24 out-of-scope item is absent from the UI, the copy, and the nav.
- No fake or local-only frontend behaviour from the old app survives.
- Every §9.2 interaction budget is met or formally amended in this document.
- Arabic and English are content-complete and direction-correct; no missing key ships.
- WCAG 2.2 AA passes on every critical flow.
- Permission tests prove SubAdmin restriction and cross-role isolation.
- Financial and lesson transitions display server-authoritative outcomes only.
- Performance budgets met on public routes; classroom stability verified under reconnection.
- Both themes pass visual regression, and dark mode is reviewed as designed work, not derived output.
- Product, design, engineering, QA, and operations sign off this same route, state, and budget inventory.

---

## 28. Research basis

The companion research draws on first-party W3C/WAI guidance for directionality, navigation, forms, status messages, reflow, focus, target size, and financial error prevention; official Google Meet guidance for preflight and control hierarchy; official Udemy guidance only for course decision and player information ordering; official Preply guidance only for tutor decision-data ordering; and GOV.UK guidance for task and status clarity. These sources shape interaction quality. **They authorise no feature.** The repository remains the sole feature authority.

The evidence-backed rules carried into this specification:

- Put live tutoring and courses on equal, explicit entry paths.
- Expose only the decision data and filters the project actually owns.
- Give every consequential action a visible consequence, one commit, and a durable outcome.
- Make each role's next action outrank decorative analytics — hence a Queue before a dashboard, and Today before a chart.
- Treat RTL and accessibility as architecture, not post-build polish.
- Preserve the native classroom's exact tools while radically simplifying entry and layout.
