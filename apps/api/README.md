# `@mrh/api`

The NestJS API for Mr.H Academy. It owns authentication, lessons, courses,
payments, classroom sessions, and the PostgreSQL data model.

## Development

From the repository root:

```bash
pnpm install
pnpm --filter @mrh/api start:dev
```

Copy `apps/api/.env.example` to `apps/api/.env` and provide the local
PostgreSQL, Redis, JWT, mail, and integration settings required by the feature
you are working on. The API listens on `http://localhost:4000` by default.

## Database operations

Schema changes are applied explicitly through TypeORM migrations:

```bash
pnpm --filter @mrh/api migration:run
pnpm --filter @mrh/api migration:validate
pnpm --filter @mrh/api db:backup
```

Backups are written to the ignored `apps/api/backups/` directory. The backup
command requires `DATABASE_URL` (or the discrete database variables) and never
runs schema synchronization.

The optional demo fixtures are fictional, idempotent, and disabled in
production. Supply the password through an untracked environment variable; the
command never prints it or changes an existing user's password:

```bash
DEMO_SEED_PASSWORD='use-a-local-password-at-least-15-chars' \
  pnpm --filter @mrh/api db:seed:demo
```

API E2E tests require a migrated disposable PostgreSQL database, Redis, and a
32-character test JWT secret. The isolated fixture smoke test creates a fresh
`.example` user per run and authenticates through the real CSRF and HttpOnly
cookie boundary; it does not depend on demo accounts:

```bash
NODE_ENV=test \
DATABASE_URL='postgresql://user:password@localhost:5432/mrh_academy_e2e' \
JWT_SECRET='a-local-test-secret-with-at-least-32-characters' \
  pnpm --filter @mrh/api test:e2e -- \
    test/isolated-fixtures.e2e-spec.ts --runInBand
```

## Verification

```bash
pnpm --filter @mrh/api format:check
pnpm --filter @mrh/api lint
pnpm --filter @mrh/api typecheck
pnpm --filter @mrh/api test
pnpm --filter @mrh/api build
```

The production process is `node dist/main.js`. Swagger is available only when
the API runs in an explicitly enabled non-production environment.

## Arabic PDF font

The maintained `Amiri-Regular.ttf` runtime asset lives at
`src/assets/fonts/Amiri-Regular.ttf`. Set `ARABIC_PDF_FONT_PATH` only when a
deployment provides a different absolute path; otherwise the bundled asset is
used.
