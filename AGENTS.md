# Repository Guidelines

## Project Structure & Module Organization

This is a pnpm/Turborepo TypeScript monorepo:

- `apps/web/`: Next.js 15 and React 19 frontend. Routes live in `src/app/`, reusable UI in `src/components/`, and browser tests in `e2e/`.
- `apps/api/`: NestJS 11 API. Feature modules live under `src/`; API end-to-end tests live in `test/`.
- `packages/types/`: shared TypeScript contracts consumed by both applications.
- `scripts/`: repository-wide validation, packaging, and security helpers.
- `docs/`: setup, delivery, design, and operational documentation.

Keep application-specific logic inside its owning workspace; move only genuinely shared contracts into `@mrh/types`.

## Build, Test, and Development Commands

Use Node.js 24 and pnpm 11.

- `pnpm install`: install all workspace dependencies.
- `pnpm dev`: run web and API development servers through Turbo.
- `pnpm build`: build every workspace.
- `pnpm lint && pnpm typecheck`: run ESLint and TypeScript checks.
- `pnpm test`: run workspace unit tests.
- `pnpm --filter @mrh/api test:e2e`: run API integration tests.
- `pnpm --filter @mrh/web test:e2e`: run Playwright tests against a running API and disposable migrated database.
- `pnpm format:check`: verify supported configuration files with Prettier.

## Coding Style & Naming Conventions

Use TypeScript with two-space indentation, single quotes, and trailing commas. Run the workspace lint and format commands before submitting changes. Follow existing naming: React components use `PascalCase`, hooks use `use-kebab-case.ts` or the established local pattern, and NestJS files use descriptive suffixes such as `.controller.ts`, `.service.ts`, and `.module.ts`. Prefer the `@/` alias for web imports.

## Testing Guidelines

Jest unit tests use `*.spec.ts` beside source files or in `__tests__/`; API integration tests use `*.e2e-spec.ts` in `apps/api/test/`. Playwright specs belong in `apps/web/e2e/`. Add regression coverage for fixes and preserve the API Jest thresholds in `apps/api/package.json` (including stricter service-specific thresholds). Never point E2E suites at production data.

## Commit & Pull Request Guidelines

History follows Conventional Commit subjects such as `feat: ...`, `fix: ...`, and `chore: ...`. Keep subjects imperative, concise, and scoped to one coherent change. Pull requests should explain intent and risk, link the issue or requirement, list verification commands, and include screenshots or recordings for visible UI changes. Call out migrations, environment changes, security implications, and bilingual/RTL behavior explicitly.

## Security & Configuration

Copy each workspace’s `.env.example`; never commit secrets or real user data. Validate authentication, payments, uploads, and redirects server-side. Use fictional `.example` identities for fixtures and run `node scripts/secret-scan.js` when changing configuration or delivery files.
