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

The production process is `next start`. Playwright suites are intentionally
separate because they require provisioned API, database, and browser fixtures.
