# `@mrh/web`

The Next.js App Router frontend for Mr.H Academy. Public pages, bilingual
content, authenticated student/tutor dashboards, and the classroom UI live in
this package.

## Development

From the repository root:

```bash
pnpm install
pnpm --filter @mrh/web dev
```

Copy `apps/web/.env.example` to `apps/web/.env.local`. Browser requests use the
same-origin `/api/v1` rewrite; the API upstream is configured server-side and
must not be exposed as a long-lived browser credential.

## Verification

```bash
pnpm --filter @mrh/web lint
pnpm --filter @mrh/web typecheck
pnpm --filter @mrh/web test
pnpm --filter @mrh/web build
```

The production process is `next start`.

## Browser E2E

Playwright requires PostgreSQL and Redis plus an API running against an already
migrated disposable database whose name contains `e2e` or `test`. The API's
`FRONTEND_URL` must equal the browser `BASE_URL`. For example, with the API on
port 4000 and its `FRONTEND_URL` set to `http://localhost:3100`:

```bash
BASE_URL='http://localhost:3100' \
API_UPSTREAM_URL='http://localhost:4000' \
DATABASE_URL='postgresql://user:password@localhost:5432/mrh_academy_e2e' \
DATABASE_SSL=false \
  pnpm --filter @mrh/web test:e2e
```

The suite starts the web development server on the `BASE_URL` port unless
`SKIP_WEB_SERVER` is set. Global setup registers unique `.example`
admin/student/tutor fixtures through the real API, stores their HttpOnly-cookie
sessions in a mode-0600 ignored artifact, and global teardown removes the exact
run users and local fixture file. It never relies on shared demo credentials.
