# Repository Guidelines

## Project Structure & Module Organization

This pnpm/Turborepo monorepo contains two applications and one shared package. `apps/web` is the Next.js 15 frontend; routes live in `src/app`, reusable UI in `src/components`, and browser tests in `e2e`. `apps/api` is the NestJS backend, organized by domain under `src` (for example, `lessons/` and `payments/`); API end-to-end tests live in `test`. Shared TypeScript contracts belong in `packages/types/src`. Repository maintenance utilities are in `scripts`, while application-owned static assets stay near their application (such as `apps/api/src/assets`).

## Build, Test, and Development Commands

Use Node.js 24 and pnpm 11.

- `pnpm install --frozen-lockfile` installs the pinned workspace dependencies.
- `pnpm dev` starts the web and API development tasks through Turborepo.
- `pnpm build` builds every workspace.
- `pnpm lint`, `pnpm typecheck`, and `pnpm test` run repository-wide quality checks.
- `pnpm format:check` verifies formatting; `pnpm knip` detects unused code and dependencies.
- `pnpm --filter @mrh/api test:e2e` runs API integration tests.
- `pnpm --filter @mrh/web test:e2e` runs Playwright tests against a running API and migrated disposable test database.

## Coding Style & Naming Conventions

Write TypeScript with two-space indentation, single quotes, and trailing commas; Prettier and ESLint enforce the established style. Use PascalCase for React components (`AvatarUploader.tsx`), `use`-prefixed names for hooks, and kebab-case, role-suffixed backend files (`book-lesson.dto.ts`, `lessons.service.ts`). Keep domain logic within its NestJS module and expose cross-application types through `@mrh/types`.

## Testing Guidelines

Jest unit tests use `*.spec.ts`; API end-to-end tests use `*.e2e-spec.ts`, and Playwright specs live as `apps/web/e2e/*.spec.ts`. Add regression coverage with behavior changes. Run `pnpm --filter @mrh/api test:cov` when changing covered services and preserve the thresholds configured in `apps/api/package.json`. Before submitting, mirror CI with formatting, lint, typecheck, Knip, tests, and build.

## Commit & Pull Request Guidelines

History follows Conventional Commit subjects such as `fix: preserve unauthenticated public pages` and `test: add isolated cookie auth fixtures`. Keep commits focused and use an imperative, scoped summary (`feat:`, `fix:`, `test:`, `docs:`, `refactor:`, or `chore:`). Pull requests should explain the user-visible impact, link relevant issues, list verification commands, and include screenshots for UI changes. Call out migrations, environment changes, and deployment considerations explicitly.

## Security & Configuration

Copy application `.env.example` files for local setup, never commit secrets, and use fictional `.example` identities in fixtures. Treat database migrations and demo seeding as opt-in operations against explicitly selected databases.
