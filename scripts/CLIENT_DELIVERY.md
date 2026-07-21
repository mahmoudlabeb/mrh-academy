# MRH Academy — Client Delivery Checklist

**Live URLs**

- Frontend: https://mrh-academy-1.vercel.app
- API: https://mrh-academy.onrender.com/api/v1

**Target delivery date:** July 20, 2026

---

## Demo accounts

Demo passwords are intentionally not documented. Set `DEMO_SEED_PASSWORD` only
in development with a strong, unique value, and rotate every seeded credential
before deployment.

| Role     | Email                      | Notes                               |
| -------- | -------------------------- | ----------------------------------- |
| Admin    | admin@mrhacademy.com       | Full admin panel                    |
| Owner    | fekrah23451@gmail.com      | Admin                               |
| SubAdmin | subadmin@mrhacademy.com    | Limited permissions (after re-seed) |
| Student  | student@demo.com           | $50 balance                         |
| Student  | hkprivat50@gmail.com       |                                     |
| Tutor    | Sarah.alazzeh87@gmail.com  |                                     |
| Tutor    | yasmenaiman1@gmail.com     |                                     |
| Tutor    | fatimetouzehra27@gmail.com |                                     |

---

## Environment variables

### Vercel (web)

```
NEXT_PUBLIC_API_URL=https://mrh-academy.onrender.com/api/v1
```

### Render (API)

```
FRONTEND_URL=https://mrh-academy-1.vercel.app
JWT_SECRET=<strong-secret>
DATABASE_URL=<postgres>
REDIS_URL=<redis>
ADMIN_EMAILS=admin@mrhacademy.com,fekrah23451@gmail.com
RUN_MIGRATIONS=true
DATABASE_SSL_REJECT_UNAUTHORIZED=false
```

Optional: `BUNNY_API_KEY`, `BUNNY_LIBRARY_ID`, `BUNNY_CDN_HOSTNAME` for course video streaming.

### Database migrations (production-grade)

**Render:** set `RUN_MIGRATIONS=true` — migrations run automatically on API start.

**Fresh local DB:**

```powershell
cd apps/api
$env:CONFIRM_BOOTSTRAP="yes"
npm run db:bootstrap
```

**Manual migration run:**

```powershell
cd apps/api
npm run migration:run
```

**Local dev schema sync (escape hatch only):**

```
DB_SYNCHRONIZE=true
```

### Automatic database backups

`.github/workflows/database-backup.yml` runs daily at 02:17 UTC and can also be
started manually. Configure the repository secret `DATABASE_URL` before enabling
the workflow. Backups are private GitHub artifacts retained for 7 days; copy them
to a separate encrypted storage provider for longer retention.

---

## Integration & E2E tests

```powershell
# API deliverables smoke test
.\scripts\test-api-deliverables.ps1

# Third-party integrations (Redis, Stripe, Bunny, Gemini status)
.\scripts\test-integrations.ps1

# Playwright (starts web dev server; API must be running on :4000)
cd apps/web
npm run test:e2e

# Skip auto web server if already running
$env:SKIP_WEB_SERVER="1"; npx playwright test
```

Integration health endpoint: `GET /api/v1/health/integrations`

---

## Client deliverables — manual checklist

### Students

- [ ] Register at `/register` (student role)
- [ ] Login / logout
- [ ] Browse tutors on student dashboard (Discover)
- [ ] Book lesson at `/book-lesson` (requires tutor availability + balance)
- [ ] Pay / subscribe (PayPal or manual payment approval by admin)
- [ ] Join classroom from My Lessons (`/classroom/{roomId}`)
- [ ] Video, chat, whiteboard in classroom
- [ ] Messages tab
- [ ] Courses browse + enroll + progress + watch video (if Bunny configured)
- [ ] Vocabulary at `/vocabulary`
- [ ] Settings: change email, password, delete account, notification preferences

### Tutors

- [ ] Student applies at `/become-teacher` (login required)
- [ ] Admin approves tutor in Admin → Tutors
- [ ] Tutor dashboard: stats, lessons, students
- [ ] Availability at `/tutor/availability`
- [ ] Messages + contact student from Students list
- [ ] Classroom tab + join live lesson
- [ ] Settings: profile + password + notification preferences
- [ ] Stripe Connect (if configured)

### Admin

- [ ] All 10 tabs load (Stats, Tutors, Students, Lessons, Courses, Reviews, Payments, Employees, Reports, Settings)
- [ ] Approve/reject tutors, payments, reviews
- [ ] Create SubAdmin employee (shows temp password)
- [ ] Impersonation (SubAdmin with `impersonate_users` permission)

### General

- [ ] Arabic + English toggle
- [ ] Mobile responsive layout
- [ ] Protected routes redirect to login

---

## Automated tests

### 1. API smoke test (run after deploy)

**Windows (PowerShell):**

```powershell
cd "c:\Users\user\Downloads\Free_job\موقع تعليم"
.\scripts\test-api-deliverables.ps1
```

**Against local API:**

```powershell
$env:API_URL="http://localhost:4000/api/v1"
.\scripts\test-api-deliverables.ps1
```

**Linux/macOS:**

```bash
chmod +x scripts/test-api-deliverables.sh
./scripts/test-api-deliverables.sh
```

### 2. Playwright E2E (browser flows)

**Against live site:**

```powershell
cd apps/web
$env:BASE_URL="https://mrh-academy-1.vercel.app"
npx playwright test
```

**Against local dev:**

```powershell
# Terminal 1: pnpm dev
cd apps/web
npx playwright test
```

**E2E spec files:**

| File                           | Covers                      |
| ------------------------------ | --------------------------- |
| `e2e/auth.spec.ts`             | Register, login, validation |
| `e2e/dashboard.spec.ts`        | Student dashboard tabs      |
| `e2e/courses.spec.ts`          | Course listing              |
| `e2e/vocabulary.spec.ts`       | Vocabulary page             |
| `e2e/admin.spec.ts`            | Admin panel                 |
| `e2e/tutor-onboarding.spec.ts` | Become teacher flow         |
| `e2e/deliverables.spec.ts`     | Full role-based smoke       |

### 3. Run everything

```powershell
.\scripts\run-all-tests.ps1
```

---

## Deploy steps (you push — Vercel + Render auto-deploy)

1. Commit and push all changes to GitHub
2. Wait for Render API + Vercel web builds to finish
3. Run `.\scripts\test-api-deliverables.ps1` against production
4. Run Playwright against `https://mrh-academy-1.vercel.app`
5. Walk through manual checklist above

---

## Build protection (obfuscation for client delivery)

Before delivering the client build, run the obfuscation script to protect source code:

**Windows (PowerShell):**

```powershell
.\scripts\protect.ps1
```

**Node.js (cross-platform):**

```powershell
node scripts/protect.js
```

What it does:

- Builds API (`nest build`) and Web (`next build`)
- Obfuscates all `.js` files in `apps/api/dist/` and `apps/web/.next/` using `javascript-obfuscator`
- Removes source maps from API dist
- The client can run the output but cannot easily read or modify the obfuscated code

**Note:** Obfuscation is one-way — you cannot reverse it to get the original source back. Keep the unobfuscated build artifacts separately for future deployments.

---

## Re-seed database (development only)

```bash
cd apps/api
CONFIRM_SEED=yes npm run seed
```

Creates all demo accounts including `subadmin@mrhacademy.com`.

---

## Known limitations

- Course video requires Bunny CDN env vars on Render; without them, stream-token returns 404 (UI shows a clear config message)
- Google OAuth requires Google Cloud credentials configured on Render
- Stripe Connect requires Stripe keys — run `.\scripts\test-integrations.ps1` to verify
- Classroom WebRTC needs HTTPS + camera/mic permissions (two-browser manual test)
- PayPal payments need admin approval in Admin → Payments
- CSRF: mobile/API clients without `Origin` must send `X-MRH-Client: mrh-web` (web app does this automatically)

---

## Support contacts

- Platform: MRH Academy
- Contact email (seed): hello@mrhacademy.com
