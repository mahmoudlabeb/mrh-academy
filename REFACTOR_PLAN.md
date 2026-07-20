# Client/server repository refactor plan

Status: non-deferred implementation complete as of July 20, 2026. The locale/Next.js major/proxy/CSP-SRI/Dependabot phase remains intentionally deferred, and database-backed migration/E2E gates still require provisioned PostgreSQL and Redis services.

## Intent

Reorganize the repository around the official `apps/` and `packages/` workspace boundaries, keep only project-owned assets in the appropriate application, remove generated/agent/debug artifacts that are not part of the product, and preserve a buildable, testable workspace.

## Guardrails

- No files are moved or deleted until the grilling session reaches shared understanding and the user confirms the resulting plan.
- Preserve every change already present in the local working tree before implementation (snapshot July 20, 2026; 149 entries): modified `.gitignore`, `apps/web/src/app/tutors/[id]/page.tsx`, and `apps/web/src/lib/api-url.ts`; untracked `REFACTOR_PLAN.md`; deleted `.turbo/cache/**` (132 tracked cache files), the three `.kiro/specs/*/.config.kiro` files, `apps/api/check-passwords.mjs`, `apps/api/fix-passwords.mjs`, `apps/api/list-users.mjs`, `apps/api/lint-report.json`, `apps/api/lint_errors.txt`, `apps/api/lint_output.txt`, `apps/api/startup.err`, `apps/web/playwright-report/index.html`, `pnpm-lock.yaml.3611111790`, and `swagger-screenshot.png`. Treat this snapshot as user-owned work: do not restore, overwrite, or discard any entry, and reconcile later refactor edits around it.
- Every proposed deletion must be classified as generated output, temporary/debug material, duplicate/scaffold content, or intentionally retained project documentation/assets.
- Package-manager workspaces, imports, scripts, CI, deployment configuration, tests, documentation, and environment templates must be updated together with any move.
- The final refactor must be validated with the project’s documented lint, typecheck, build, and test commands (or an explicitly documented exception).

## Local changes to reproduce on a fresh checkout

This plan will be handed off without a commit. The implementer must therefore reproduce the following existing local work before starting the later phases; these are baseline changes, not merely observations. After reproduction, preserve them while reconciling them with the final architecture described below.

1. Update `.gitignore`:
   - Add `.turbo/` beside the dependency/cache exclusions.
   - Keep the existing `*.md` rule for now but add `!REFACTOR_PLAN.md` beside the README and security-policy exceptions so this plan can be tracked by the recipient.
   - Remove the obsolete literal line `Preview Frontend Live Testing QA Report`.
   - Add `.kiro/`, `.codex/`, `.agents/`, `.claude/`, and `skills-lock.json` as local agent/tool metadata exclusions.
2. Update `apps/web/src/lib/api-url.ts` by adding the current server-rendering helper exactly in behavior:

   ```ts
   export function getServerApiBaseUrl() {
     const configured = process.env.NEXT_PUBLIC_API_URL;
     if (configured) return configured.replace(/\/+$/, '');
     return 'http://localhost:4000/api/v1';
   }
   ```

   This reproduces the current local fix for server-rendered fetches. A later accepted phase must replace the public upstream variable with the final server-only/same-origin configuration rather than losing the behavior.
3. Update `apps/web/src/app/tutors/[id]/page.tsx`:
   - Replace the `getApiBaseUrl` import with `getServerApiBaseUrl`.
   - Use `getServerApiBaseUrl()` in `getTutor`, `getTutorReviews`, and `getTutorAvailability`.
   - Preserve the final newline added to the file.
4. Delete all 132 tracked files under `.turbo/cache/`; the directory is generated and the new ignore rule prevents recurrence.
5. Delete the three tracked Kiro metadata files:
   - `.kiro/specs/phase-1-critical-bug-fixes/.config.kiro`
   - `.kiro/specs/phase-2-deep-audit-fixes/.config.kiro`
   - `.kiro/specs/project-audit-report/.config.kiro`
6. Delete the existing API one-off/debug/generated files:
   - `apps/api/check-passwords.mjs`
   - `apps/api/fix-passwords.mjs`
   - `apps/api/list-users.mjs`
   - `apps/api/lint-report.json`
   - `apps/api/lint_errors.txt`
   - `apps/api/lint_output.txt`
   - `apps/api/startup.err`
7. Delete the generated web report `apps/web/playwright-report/index.html`.
8. Delete the alternate lockfile `pnpm-lock.yaml.3611111790` and the obsolete root image `swagger-screenshot.png`.
9. Copy the supplied `REFACTOR_PLAN.md` into the repository root. It is intentionally the only untracked file in this local snapshot and contains the remaining work to execute.

The baseline totals 149 working-tree entries: three modified tracked files, 145 tracked deletions, and this untracked plan. Verify the replay with `git status --short` before proceeding; do not restore any listed deletion.

## Decisions to resolve in the grilling session

1. Target ownership and naming for `client/`, `server/`, shared packages, scripts, documentation, screenshots, and fonts.
2. Asset policy: what is product/runtime content versus generated/reference material, and whether any assets move into `client/`.
3. Deletion policy and retention/archive rules for agent scripts, text/error/coverage files, screenshots, and scaffolding.
4. Workspace/tooling layout and compatibility requirements for local development, CI, deployment, and published packages.
5. Migration sequencing, validation gates, rollback strategy, and acceptable breaking changes.

## Accepted decisions

- Follow the official workspace convention: deployable apps remain grouped under `apps/` using the documented/reliable stack names `apps/web` (Next.js) and `apps/api` (NestJS), while shared libraries remain under `packages/` (`packages/types`).
- Keep the Arabic PDF font as a server-owned runtime asset under `apps/api/src/assets/fonts/`, configure Nest CLI asset copying, and update runtime path resolution/env documentation accordingly.
- Remove the unreferenced root `screenshots/` directory; it is not part of the client runtime.
- Remove tracked generated diagnostics (`apps/api/coverage/`, `apps/api/lint_errors.txt`, and `apps/api/lint_output.txt`) and add ignore rules so they are produced only locally or in CI.
- Remove the five unreferenced Next.js scaffold SVGs from `apps/web/public/`; retain only client assets that the application serves.
- Keep root scripts only for cross-package and operational workflows; move package-local behavior into the relevant workspace `package.json` and classify stale one-off scripts for removal.
- Remove the custom obfuscation workflow (`protect.js`, `protect.ps1`, the root `protect` script, and its dependency) unless a separate external requirement is discovered; use the framework’s normal build/start workflow.
- Standardize development, CI, and production guidance on the supported Node.js 24 LTS line; upgrade the workspace from pnpm 9 to pnpm 11, pin the exact resolved pnpm version in `package.json`, regenerate `pnpm-lock.yaml`, and use the same toolchain in CI.
- Remove the obsolete, machine-specific `scripts/update_colors.py`; preserve future palette changes in versioned client source/configuration.
- Replace the blanket Markdown ignore with narrow generated-artifact rules so maintained documentation and `REFACTOR_PLAN.md` are trackable.
- Remove test files that only simulate copied “buggy/fixed” implementations; retain tests that import production modules and rename retained agent-history test names to behavior-oriented names where practical.
- Use NestJS feature modules as the API ownership boundary; move generic services only when a clear feature/integration owner exists and keep `common` cross-cutting.
- Keep NestJS feature directories directly under `apps/api/src/`, following the official Nest layout; do not add a redundant `src/modules/` wrapper. Do not create a generic `shared/` directory or global `SharedModule`: reusable business behavior stays owned by and exported from its named feature module, third-party adapters live in `integrations/`, and `common/` is restricted to stateless technical cross-cutting primitives. Create a new reusable module only for a cohesive named capability with a small interface and multiple real consumers.
- Use a hybrid feature/route-first client structure: retain `src/app` routing, colocate route-specific code, keep shared code in explicit shared areas, and introduce route groups/private folders only for real boundaries.
- Replace the generic starter text in `apps/web/README.md` and `apps/api/README.md` with concise, project-specific package documentation; keep the root README as the repository-wide guide.
- Remove the ad-hoc remote smoke-test scripts (`scripts/test-api-deliverables.sh`, `scripts/test-api-deliverables.ps1`, `scripts/test-integrations.ps1`, and `scripts/run-all-tests.ps1`) and their root package-script wrappers; retain framework-native Jest/Playwright suites plus operational backup and migration-validation scripts.
- Scope environment templates to their owning applications (`apps/api` and `apps/web`) instead of the workspace root, split mixed API/web production guidance, update documentation, and keep real `.env` files untracked; this follows Turborepo and Next.js environment-loading guidance.
- Eliminate the catch-all API `src/services/` directory: place external adapters under an explicit `src/integrations/` boundary, move commission and payout reconciliation to the payments/finance boundary, move reminders to lessons, and colocate their tests while preserving Nest module exports/imports.
- Remove the global `SharedModule`; export commission capability from the payments/finance boundary, move the Arabic PDF utility and declaration under invoices/payments, and reserve `common/` for technical cross-cutting code.
- Add narrow ignore rules for verified generated outputs (`coverage/`, `playwright-report/`, `test-results/`, local backups, and related diagnostics), remove tracked generated instances, and keep maintained Markdown visible to Git.
- Keep the root README as the canonical setup/deployment overview, replace the two app starter READMEs with useful package guides, remove the broken `docs/SETUP_AR.md` reference, and create a separate `docs/` guide only when maintained long-form content exists.
- Normalize root scripts to portable workspace orchestration (`dev`, `build`, `lint`, `typecheck`, `test`, `format`, and `format:check` as applicable); remove obsolete wrappers such as `client-start`, and keep app-specific starts, migrations, and database operations in their owning package or explicit operational scripts.
- Rename the API `src/gateway/` directory to feature-owned `src/classroom/`, retaining the gateway/module filenames under the classroom boundary.
- Make `@mrh/types` a shared API-contract package consumed by both `apps/api` and `apps/web`; replace duplicated client status/enumeration definitions while keeping server-only entities and persistence code private to the API.
- Remove the unused Capacitor scaffold from `apps/web` (config, scripts, and dependencies); add mobile packaging later only as an explicit, documented platform/app when required.
- Defer the larger internationalization migration until the end: after the structural refactor is stable, migrate the bilingual routes toward Next.js's official `app/[lang]` plus locale-aware proxy/dictionary pattern; preserve the current bilingual code during the earlier work.
- Keep `ecosystem.config.js` as an explicitly optional PM2/self-hosting adapter, while documenting the framework-native `next start` and `node dist/main.js` production commands as canonical.
- Replace the duplicate shell/PowerShell database-backup wrappers with one cross-platform API-owned Node script exposed as `db:backup`; require environment configuration and write dumps only to an ignored local backup directory.
- Remove the redundant `scripts/validate-migrations.ps1` wrapper; keep migration validation as a portable API package command with explicit confirmation and test-database safety guards.
- Rewrite `SECURITY.md` as a real vulnerability-reporting policy with supported-version/reporting guidance; remove the dated handover timeline and static dependency inventory, and handle dependency monitoring through automated tooling/CI.
- Add a minimal GitHub Actions workspace quality gate for pushes and pull requests: install the pinned Node/pnpm versions with the lockfile, then run format-check, lint, type-check, tests, and builds; keep infrastructure/secret-dependent E2E checks separate.
- Defer adding `.github/dependabot.yml` until after the structural refactor and CI gate; the follow-up should monitor the pnpm workspace and GitHub Actions on a restrained schedule with grouped non-major updates.
- Remove the central `apps/api/src/entities/` directory and colocate each TypeORM entity with its owning Nest feature under an `entities/` subdirectory; allow consumers to import from the owning feature while keeping migrations under `database/migrations`.
- With feature-owned entities, rely on Nest/TypeORM `autoLoadEntities: true` and remove the root `entities` barrel plus explicit `entities` list from `AppModule`; each feature registers its own entities through `TypeOrmModule.forFeature()`.
- Split API configuration into namespaced files under `apps/api/src/config/` (application, database, auth, and integrations as applicable); keep startup validation centralized, move parsing/defaults out of `AppModule`, and configure TypeORM through the typed namespace provider pattern.
- Remove the Nest starter `GET /` endpoint and `AppService#getHello()`; add a dedicated `health` feature using `@nestjs/terminus` with public liveness/readiness routes, standardized database/Redis checks, and safe custom integration indicators that do not expose configuration secrets.
- Enable Nest shutdown hooks in `main.ts` and implement lifecycle cleanup for Redis, schedulers, WebSocket resources, and other long-lived providers so termination signals close the application cleanly.
- Migrate runtime API code away from direct `process.env` reads to injected, typed `ConfigService`/namespace providers; permit direct environment access only in configuration factories and explicitly standalone database/seed commands.
- Replace the hard-coded `api/v1` global prefix with Nest URI versioning: use a stable `api` prefix, set `defaultVersion: '1'`, preserve existing `/api/v1/...` URLs, and assign explicit version-neutral/versioned metadata to health routes; update test bootstrap and OpenAPI paths.
- Keep Swagger UI disabled in production, modernize the OpenAPI metadata, generate a stable JSON contract through Nest's document factory for review/client tooling, and expose documentation only in explicitly enabled development/staging environments.
- Preserve the API error-response contract while refactoring the catch-all filter to Nest's `BaseExceptionFilter`/`HttpAdapterHost`, register it through `APP_FILTER` for dependency injection, and isolate the Google-auth redirect in an auth-specific handler/filter without exposing internal stacks or secrets.
- Defer the Next.js major-version upgrade to the final phase, after structural cleanup and the deferred i18n migration; at that point re-check the official latest stable release and apply its supported codemod/migration path (including `middleware` to `proxy`) rather than pinning a stale target now.
- Progressively apply Next's Server/Client Component guidance: keep route pages and static layouts server-rendered by default, isolate state/browser/API-client code in small client components, and mark server-only data modules to prevent accidental client imports.
- Audit all remote images and tighten Next `remotePatterns` to exact approved providers/paths (including protocol/query constraints); remove unused external decorative backgrounds or replace them with approved local assets, and handle user-supplied avatar URLs through an explicit safe policy.
- Keep `next/font`, but consolidate the web typography after a visual usage audit to one intentional Arabic family and one Latin family where possible, prefer variable weights, and remove redundant font imports/CSS variables.
- Add Next metadata conventions: canonical metadata base, bilingual title/description templates, route-specific metadata (including dynamic tutor/course pages), maintained Open Graph assets, a public-pages-only sitemap, and `noindex` metadata for auth/admin/private dashboard routes.
- Adopt Next.js App Router's file-based error-handling conventions: add shared root `error.tsx` and `not-found.tsx`, add `loading.tsx` at meaningful route boundaries (with segment-specific files where UX differs), retain only narrowly scoped custom boundaries for behavior the framework files cannot cover, and add `global-error.tsx` only if a distinct root-layout failure experience is required.
- Keep the NestJS API's Passport/JWT guards as the authoritative authentication and authorization boundary; remove unverified role-based authorization from the web proxy, limit the proxy to optimistic cookie/session-presence redirects (or cryptographically verified routing hints), and require secure server-side/data-layer checks for Next-rendered data or mutations and for every API operation. Do not add a second Next auth system during this structural refactor unless a later requirement justifies it.
- Move browser authentication to server-set cookies: set access/refresh cookies with explicit `HttpOnly`, `Secure`, `SameSite`, expiry, and path/domain policy; make OAuth callbacks redirect without token query parameters; remove JavaScript token storage/URL ingestion and bearer-header injection from the web client; preserve CSRF/origin defenses and adapt WebSocket authentication to the cookie or a narrowly scoped short-lived connection credential.
- Add API-wide double-submit CSRF protection after cookie parsing, require an `X-CSRF-Token` header for browser state-changing requests, retain strict allowlisted Origin/Referer checks as defense-in-depth, remove the generic no-Origin client-header bypass, and exempt only independently signature-verified webhooks; keep all GET endpoints non-mutating.
- Make same-origin Next `/api/v1` the canonical browser HTTP boundary through the existing rewrite; keep the API upstream URL server-only, handle OAuth through a Next callback handler or one-time-code exchange that sets web-origin HttpOnly cookies without URL tokens, retain a dedicated API origin only for WebSockets/operations, and document the complete production host/cookie/CORS/trusted-origin topology. Optimize for correctness and security rather than speed; schedule work in validated phases.
- Preserve the external Nest HTTP API plus TanStack Query as the web app's primary data-access strategy during this refactor; avoid a broad parallel Next DAL/Route-Handler rewrite, and add a small server-only DAL only when a later feature genuinely requires protected server-rendered data.
- Harden Google OAuth with a single-use browser-bound transaction: generate and verify cryptographically random `state` and `nonce`, consume them before accepting the profile, use Google's stable `sub` identity, restrict return paths to fixed same-origin destinations, and set application cookies only after verification.
- Rotate refresh tokens on every refresh using unique token identifiers and families; persist only hashed token state with expiry, invalidate predecessors, detect reuse and revoke the family, and revoke relevant families on logout, password changes, account deletion, and other security events while retaining short-lived access tokens.
- Centralize JWT profiles and validation: explicitly pin the permitted algorithm, validate issuer/audience and standard claims, use explicit access/refresh/connection types and unique identifiers, minimize duplicated claims, and apply identical checks across HTTP, refresh, WebSocket, and impersonation tokens.
- Use Argon2id directly for all passwords (the system has no deployed bcrypt users to migrate), require at least 15 characters for password-only authentication while allowing 64 or more, remove composition rules, reject known compromised passwords, and avoid arbitrary periodic resets unless compromise is detected; update development seed credentials and documentation.
- Harden password recovery by hashing and atomically consuming reset tokens, enforcing short expiry and per-IP/account rate limits, using trusted HTTPS reset URLs with `Referrer-Policy: no-referrer`, keeping generic responses, avoiding auto-login, notifying users, and revoking all existing sessions after a successful reset.
- Require email verification before password-created accounts receive normal sessions; store only hashed single-use verification tokens with expiry, rate-limit resend, use trusted HTTPS links and generic responses, and treat verified Google identities as already verified.
- Make email changes pending until the new address is verified; require recent password/provider reauthentication, notify the old address, atomically replace the identity after confirmation, refresh or revoke active session/token families, rate-limit the workflow, and align all web forms with the API contract, using stricter confirmation for privileged roles.
- Centralize secure file-upload policies by upload class: validate size and detected content/signatures against strict allowlists, generate storage identifiers, avoid trusting or exposing original paths, re-encode images, scan/content-disarm PDFs and documents where practical, authorize private signed delivery, clean object storage consistently, and keep all runtime uploads outside the repository and web public directory.
- Create a non-global `apps/api/src/integrations/storage/` Nest module with a narrow injectable `ObjectStorage` contract and one Cloudinary adapter configured once; keep feature-specific upload rules and metadata in their owning modules while removing direct Cloudinary SDK setup from features.
- Remove the global `XssCleanMiddleware` and its middleware-only tests; use DTO-level syntactic/semantic validation, feature-owned sanitization for intentional rich HTML/message content, React's normal contextual escaping for text, and an audit of unsafe rendering sinks instead of mutating every request string.
- Use a nonce-based production Content Security Policy generated by the web proxy, remove `unsafe-eval` and unsafe inline scripts in production, precisely allowlist resource origins, roll out in report-only mode before enforcement, accept the documented dynamic-rendering tradeoff, and keep `unsafe-eval` development-only while deferring experimental SRI to the final Next upgrade review.

### Decision 67: Runtime logging and repository log artifacts

- Treat logs as structured event streams: emit production JSON to `stdout`/`stderr`, while keeping local development output human-readable.
- Do not let either application create `.log`, `.err`, or captured output files inside the repository; remove repository-local `./logs/*` destinations from PM2 and leave routing, retention, and archival to the execution environment.
- Include consistent timestamps, severity, application/module context, stable event names, and request/correlation identifiers.
- Log proportionate operational and security events, including authentication and authorization outcomes, validation failures, privileged actions, uploads, lifecycle events, and dependency failures.
- Redact or omit passwords, tokens, cookies, authorization headers, secrets, connection strings, reset/OAuth values, request bodies, session identifiers, and unnecessary personal information such as complete email addresses.
- Use Nest's logging abstraction for API runtime code; restrict direct console output to standalone CLI commands and intentional development-only browser diagnostics.
- Keep the logging interface vendor-neutral during this refactor; a centralized logging provider may be selected later without coupling feature code to it.
- Sources: NestJS Logger documentation, Twelve-Factor App logs guidance, and the OWASP Logging Cheat Sheet (reviewed July 2026).

### Decision 68: Database migrations and clean baseline

- Keep `synchronize: false` in every environment and make TypeORM migrations the sole schema authority.
- Delete the schema bootstrap command that calls `DataSource.synchronize()`; never combine automatic synchronization with the migration workflow.
- Because the system has never been deployed and no database requires compatibility with the provisional history, replace the existing eight migrations with one canonical initial migration after the entity/module refactor is complete.
- Give the baseline complete `up()` and `down()` implementations, and run later schema changes through new immutable timestamped migrations.
- Run migrations explicitly as a development/deployment operation rather than automatically during API startup.
- Restrict any destructive reset command to clearly named, explicitly confirmed disposable local/test databases.
- Validate the baseline transactionally against an empty PostgreSQL database and require the resulting schema to match the TypeORM entity metadata with no remaining generated diff.
- Sources: official TypeORM migration setup, generation, and execution documentation; Redgate Flyway baseline-migration convention for clean environments (reviewed July 2026).

### Decision 69: Reference data, demo fixtures, and initial administrator provisioning

- Delete the current seed implementation and remove its embedded real-looking identities, shared password, bank-account-like value, remote avatar URLs, and credential logging.
- Never let a seed command synchronize or drop the schema; keep destructive resets separate, explicitly confirmed, and limited to disposable local/test databases.
- Separate immutable reference data from optional demo fixtures.
- Provide an idempotent `db:seed:demo` command only for development/test and make it refuse production.
- Use deterministic fictional people and IETF-reserved `.example` email addresses; accept any demo password only from an untracked local environment value and never print it.
- Never reset an existing user's password as a side effect of idempotent seeding.
- Have end-to-end tests create isolated users with per-run credentials rather than depend on shared demo accounts.
- Provision the first real administrator through the accepted one-time invitation workflow rather than through production seed data.
- Verify reference and demo seeding after applying migrations to an empty PostgreSQL database.
- Sources: OWASP Secrets Management guidance and IETF reserved example-address guidance (reviewed July 2026).

### Decision 70: PostgreSQL and TypeORM identifier naming

- Keep TypeScript entity classes in `PascalCase` and entity properties in `camelCase`.
- Use lowercase `snake_case` for PostgreSQL schemas, plural table names, columns, join columns, indexes, foreign keys, unique/check constraints, enum types, and other migration-created objects.
- Preserve the project's dominant plural-table convention rather than introducing an unnecessary singular/plural mixture.
- Avoid SQL keywords and keep every identifier within PostgreSQL's 63-byte limit.
- Implement one repository-owned TypeORM naming strategy rather than adding a third-party naming package or repeating mapping overrides throughout entity decorators.
- Explicitly name important indexes and constraints so generated migrations and database diagnostics remain stable and understandable.
- Apply the convention directly in the clean initial migration; no compatibility migration is required for this unreleased system.
- Add schema validation that rejects unexpected mixed-case identifiers.
- Sources: official PostgreSQL identifier rules and official TypeORM DataSource/entity mapping documentation (reviewed July 2026).

### Decision 71: Dead-code and dependency pruning

- Add Knip as a root development tool and configure explicit Next.js, NestJS, standalone command, migration, seed, test, and configuration entry points for every workspace.
- Run both comprehensive analysis and strict production analysis.
- Require each workspace to declare its own direct dependencies; do not rely on dependencies hoisted from another workspace.
- Classify shipped runtime packages as `dependencies` and build/test/lint/type-only tooling as `devDependencies`; keep internal workspace relationships explicit with `workspace:*`.
- Resolve dead files before packages that may only be imported by those files, and manually verify all findings involving framework discovery, decorators, dependency injection, dynamic imports, scripts, migrations, or configuration.
- Do not use Knip's automatic file-deletion facility during this refactor.
- Remove a package only after its import/config references are gone; regenerate the pnpm lockfile and require type-check, lint, unit, integration, end-to-end, and production builds to pass.
- Keep the verified Knip checks in CI after the refactor to prevent new dead files and dependency drift.
- Sources: npm dependency classification guidance and Knip's official monorepo, production-mode, strict-mode, and auto-fix cautions (reviewed July 2026).

### Decision 72: Workspace package identity and JavaScript module format

- Name the private workspaces `@mrh/web`, `@mrh/api`, and `@mrh/types`; name the private root package `mrh-academy`.
- Mark every workspace private and use `0.0.0` for internal workspace versions because these packages are not released independently.
- Follow the official Nest starter's supported default by making the API explicitly CommonJS instead of retaining the accidental NodeNext/CommonJS hybrid.
- Compile `@mrh/types` to explicit CommonJS as well so Nest and Next consume one unambiguous internal build without dual-package hazards.
- Keep `@mrh/types`'s export map minimal, put the `types` condition first, and expose only the package root.
- Leave Next.js module handling framework-managed, consistent with the official scaffold.
- Retain `workspace:*` for internal relationships and validate consumption from clean built package output rather than private source aliases.
- Remove misleading conditional exports that point `import` and `require` at the same incompatible artifact.
- Sources: official Node.js package/module documentation and the official NestJS TypeScript starter (reviewed July 2026).

## Final target and execution plan

### Target repository tree

The final repository keeps the official deployable-app boundaries and removes a root `client/`/`server/` split that would duplicate the existing framework conventions:

```text
.
├── .github/
│   └── workflows/ci.yml
├── apps/
│   ├── api/                         # @mrh/api — NestJS CommonJS service
│   │   ├── src/
│   │   │   ├── config/              # typed, validated namespaces
│   │   │   ├── common/              # technical cross-cutting code only
│   │   │   ├── database/
│   │   │   │   ├── commands/        # explicit migration/backup/reset commands
│   │   │   │   ├── migrations/       # one clean baseline, then immutable changes
│   │   │   │   └── seeds/            # reference data and opt-in demo fixtures
│   │   │   ├── integrations/         # email, Google, video, AI, storage, cache
│   │   │   ├── health/
│   │   │   ├── auth/
│   │   │   ├── admin/
│   │   │   ├── articles/
│   │   │   ├── classroom/            # HTTP/socket classroom ownership
│   │   │   ├── courses/
│   │   │   ├── lessons/
│   │   │   ├── messages/
│   │   │   ├── payments/              # invoices, payouts, commission
│   │   │   ├── reports/
│   │   │   ├── reviews/
│   │   │   ├── students/
│   │   │   ├── tutors/                # tutor availability included here
│   │   │   ├── users/
│   │   │   └── vocabulary/
│   │   ├── src/assets/fonts/          # Arabic PDF font only
│   │   ├── test/                      # API integration/e2e suites
│   │   ├── .env.example
│   │   └── README.md
│   ├── web/                          # @mrh/web — Next.js application
│   │   ├── src/app/[lang]/            # final locale-aware App Router boundary
│   │   │   ├── (public)/
│   │   │   ├── (auth)/
│   │   │   ├── (dashboard)/
│   │   │   ├── classroom/[roomId]/
│   │   │   ├── layout.tsx
│   │   │   ├── error.tsx
│   │   │   ├── not-found.tsx
│   │   │   └── loading.tsx             # added at meaningful boundaries
│   │   ├── src/app/api/                # only framework route handlers required for BFF/OAuth
│   │   ├── src/components/{ui,layout}/
│   │   ├── src/features/               # genuinely shared feature UI and state
│   │   ├── src/lib/{api,auth,i18n,security}/
│   │   ├── src/providers/
│   │   ├── src/styles/
│   │   ├── src/proxy.ts                # after the deferred Next major upgrade
│   │   ├── e2e/
│   │   ├── public/                     # only referenced product assets
│   │   ├── .env.example
│   │   └── README.md
│   └── (no runtime files shared across apps)
├── packages/
│   └── types/                          # @mrh/types — public API contracts/schemas
├── docs/                               # created only for maintained long-form guides
├── .gitignore
├── .prettierrc.*
├── README.md
├── SECURITY.md
├── ecosystem.config.js                 # optional PM2 adapter, no repo log files
├── knip.json
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
└── turbo.json
```

The exact route-group placement will preserve every public URL. Route groups and `[lang]` are applied in the deferred internationalization phase, after the earlier structure is stable.

### API ownership map

| Existing concern | Final owner | Entity placement |
| --- | --- | --- |
| User identity and account profile | `users` | `users/entities/user.entity.ts` |
| Tutor profile and availability | `tutors` | `tutors/entities/tutor-profile.entity.ts`, `tutor-availability.entity.ts` |
| Student profile and favorites | `students` | `students/entities/student-profile.entity.ts`, `student-favorite.entity.ts` |
| Admin employees, settings, sub-admin profile | `admin` | `admin/entities/` |
| Lessons and lesson books | `lessons` | `lessons/entities/` |
| Classroom state and classroom messages | `classroom` | `classroom/entities/` |
| Courses, course lessons, enrollments, completions, promo codes | `courses` | `courses/entities/` |
| Direct messages and notifications | `messages` | `messages/entities/` |
| Payments, payment methods, payouts, processed webhooks | `payments` | `payments/entities/` |
| Reports | `reports` | `reports/entities/` |
| Reviews | `reviews` | `reviews/entities/` |
| Teacher-training articles | `articles` | `articles/entities/` |
| Vocabulary | `vocabulary` | `vocabulary/entities/` |

External services move from the catch-all service directory to `integrations/` adapters. Feature rules remain in their feature modules: commission/invoice/payout reconciliation in `payments`, reminders in `lessons`, and classroom connection logic in `classroom`.

### Move and rename manifest

- Move `assets/fonts/Amiri-Regular.ttf` to `apps/api/src/assets/fonts/Amiri-Regular.ttf`; fold its usage instructions into the API README and delete the empty root asset wrapper.
- Move each API entity from `apps/api/src/entities/` into its owner’s `entities/` folder; remove the central barrel and update `autoLoadEntities`/`forFeature` registration.
- Move `apps/api/src/gateway/classroom.*` to `apps/api/src/classroom/` and update imports, tests, coverage exclusions, and OpenAPI/WebSocket references.
- Move `apps/api/src/shared/pdf-arabic.*` to the payments/invoices boundary; keep only technical utilities in `common/`.
- Move `apps/api/src/services/{bunny,calendar,email,gemini}.service.ts` to named integration adapters, and move commission, payout reconciliation, and reminder services to their feature owners with colocated tests.
- Move the database shell wrappers into one API-owned Node command; retain portable package scripts rather than root PowerShell/bash variants.
- Move environment templates into `apps/api/.env.example` and `apps/web/.env.example`; split production instructions by application and keep real `.env` files untracked.
- During the final i18n phase, move locale dictionaries and locale-aware route helpers into `apps/web/src/lib/i18n/` and the `[lang]` route boundary.

### Keep/delete manifest

#### Keep and maintain

- Product source, framework configuration, API integration/e2e suites, Playwright suites, the web favicon, and the Arabic PDF font after its move.
- Root `README.md`, `SECURITY.md`, package manifests, lockfile, workspace/turbo configuration, optional PM2 adapter, and the approved plan.
- User modifications to `apps/web/src/app/tutors/[id]/page.tsx`, `apps/web/src/lib/api-url.ts`, and `.gitignore`; they must be reviewed and integrated rather than overwritten.
- Production-importing regression tests after renaming them to behavior-oriented names and updating imports for the new ownership tree.

#### Delete as generated or temporary output

- `.turbo/**`, `apps/api/coverage/**`, `apps/web/playwright-report/**`, `test-results/**`, local backup output, `*.tsbuildinfo`, `*.log`, `*.err`, `lint-report.json`, `lint_errors.txt`, and `lint_output.txt`.
- User-requested pre-existing deletions must remain deleted: the three `.kiro` config files, API password/list/debug artifacts, the Playwright report, `swagger-screenshot.png`, and `pnpm-lock.yaml.3611111790`.
- Add narrow ignore rules for these outputs without ignoring maintained Markdown.

#### Delete as agent, scaffold, or obsolete project material

- Root `screenshots/**` and `apps/web/public/{file,globe,next,vercel,window}.svg` after reference verification.
- `scripts/protect.js`, `scripts/protect.ps1`, the root `protect` script, `javascript-obfuscator`, `scripts/update_colors.py`, the remote smoke-test wrappers, and `scripts/validate-migrations.ps1`.
- Root `.env.example` and `env.production.template` after their application-owned replacements are documented.
- `apps/web/capacitor.config.json`, Capacitor scripts, and Capacitor dependencies.
- The generic API starter `app.controller.ts`, `app.controller.spec.ts`, and `app.service.ts` after health routes replace the Hello World endpoint.
- `apps/api/src/database/bootstrap-schema.ts`, the current seed, and the eight provisional migrations after the clean baseline is generated and validated.
- The global `XssCleanMiddleware`, its middleware-only tests, `SharedModule`, the central entities barrel, and emptied legacy directories.
- `apps/web/src/lib/auth-cookie.ts` and browser token-ingestion helpers after the HttpOnly-cookie flow is live; retain `api-url.ts` only where its server-only role remains justified.
- `apps/web/src/components/ErrorBoundary.tsx` only if all callers are replaced by App Router error files and no distinct boundary behavior remains.
- Tests that only execute copied buggy/fixed pseudocode rather than importing production behavior: the TypeORM export/version simulations, WebRTC `c5`/bug4/bug5 simulation files, the classroom report payload simulation, and any equivalent finding from the Knip/manual review.

#### Rename or retain after production-import review

- Keep and rename production-importing tests for authentication, lessons, payments, email, exception handling, tutor dashboard, reports, Stripe configuration, and Socket.IO URL resolution.
- Merge duplicate bug/preservation pairs where one behavior-oriented test can cover the production contract; do not preserve test names that encode agent phase IDs.
- Keep realistic API and browser e2e suites, but remove assumptions about shared seeded credentials and update the obsolete Hello World assertion to health behavior.

Local `.agents/`, `.codex/`, `.claude/`, and `skills-lock.json` files are execution-environment metadata, not project files; they remain untracked and are not copied into the final repository. The refactor must not delete the active agent toolchain while work is in progress.

### Execution phases and gates

1. **Approval and inventory:** obtain explicit approval of this plan, capture the current diff/status, freeze the keep/delete manifest, and record user-owned changes and deletions.
2. **Repository hygiene/toolchain:** remove only approved generated/scaffold artifacts, split environment templates, narrow ignores, update Node/pnpm pins, replace root scripts, and add root formatting/Knip configuration. Gate: clean manifest references and lockfile regeneration.
3. **Workspace contracts:** rename packages to `@mrh/web`, `@mrh/api`, and `@mrh/types`; make module formats explicit; build and consume `@mrh/types` from compiled output. Gate: all workspace type checks and builds pass.
4. **API structure:** move entities, integrations, classroom, payments/lessons utilities, configuration, and health; update modules, imports, tests, asset copying, shutdown lifecycle, logging, and environment access. Gate: API unit tests, type-check, build, and boot smoke test pass.
5. **Database authority:** create the snake_case clean baseline from final entities, delete the synchronization/bootstrap path, migrate explicit commands, validate on a disposable empty PostgreSQL database, and confirm no generated diff. Gate: migration validation and schema identifier checks pass.
6. **API security/runtime contract:** implement the accepted versioning, OpenAPI, exception, cookie, CSRF, OAuth, JWT/refresh, password, email-verification/change, upload, storage, sanitization, and structured-logging policies. Gate: security-focused unit/integration tests and negative-path checks pass.
7. **Web structure and assets:** remove Capacitor/starter assets, apply route/feature boundaries, server/client component boundaries, metadata/sitemap/error/loading conventions, remote-image/font policies, and same-origin API plumbing while preserving the current bilingual routes. Gate: web type-check, lint, unit tests, and production build pass.
8. **Cross-app authentication and operations:** complete the browser HttpOnly-cookie/OAuth/CSRF/WebSocket boundary, update e2e fixtures to create isolated users, update PM2 as optional stdout/stderr-only adapter, and refresh docs/SECURITY/CI. Gate: API and web e2e suites pass in their explicitly provisioned environments.
9. **Dependency and quality closure:** run comprehensive and strict-production Knip, manually verify every finding, remove dead packages/files, run dependency/security checks, and review generated output/secret scans. Gate: no unexplained Knip findings or stale paths.
10. **Deferred final work:** migrate i18n to `[lang]` and locale-aware proxy/dictionaries; then re-check the official latest Next.js release and apply its supported upgrade/codemod (including `middleware` to `proxy`), review CSP/SRI guidance, and add Dependabot only after CI is stable. Gate: full URL, metadata, auth, CSP, and browser regression review.
11. **Handoff:** run the complete validation matrix, inspect the diff for accidental deletion or secrets, update the root/app READMEs with actual commands, summarize moves/deletions/deferred work, and mark this plan complete.

### Validation matrix

- `pnpm install --frozen-lockfile`
- `pnpm format:check`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm knip` and `pnpm knip --production --strict`
- `pnpm test` plus workspace unit tests; API integration/e2e and web Playwright suites run separately when PostgreSQL, Redis, and external-service fixtures are explicitly provisioned.
- `pnpm build`, followed by clean `@mrh/types`, API, and web production-start smoke checks.
- Disposable-database migration validation with explicit confirmation, schema/entity diff generation, transaction/rollback checks, and mixed-case identifier query.
- Demo/reference seed validation in a non-production disposable database; verify no password is printed, no existing password is reset, and no real-looking identity is present.
- Security checks for cookie flags, CSRF/origin enforcement, OAuth state/nonce replay, JWT algorithm/issuer/audience, refresh-token reuse, password recovery/email verification, upload policy, redacted logs, and CSP headers.
- `pnpm audit`/CI dependency review, `git diff --check`, stale-path searches, generated-artifact assertions, and a final secret scan before handoff.

### Safety, rollback, and non-goals

- No destructive move/delete, database reset, dependency removal, or lockfile rewrite begins until the user approves this completed plan.
- Preserve the existing working-tree modifications and pre-existing deletions; never use a destructive reset to undo them.
- Perform moves before deletions, update imports/configuration immediately, and validate after every phase. Keep a phase-by-phase diff so an individual phase can be reverted without erasing unrelated user work.
- All database reset, migration validation, seed, backup, and external-service operations require explicit environment/confirmation guards and disposable targets where destructive.
- No production database/data migration or bcrypt compatibility is required because the user confirmed the system is not yet used; the clean baseline still must be proven against an empty PostgreSQL database.
- This plan does not add a mobile application, a logging SaaS, a broad Next DAL rewrite, a new design system, or a production deployment provider; those remain explicit future decisions.

### Research source register (reviewed July 20, 2026)

- Workspace/build conventions: [Turborepo configuration](https://turborepo.com/docs), [npm dependency classification](https://docs.npmjs.com/specifying-dependencies-and-devdependencies-in-a-package-json-file/), [pnpm workspaces](https://pnpm.io/workspaces), [Knip production/strict analysis](https://knip.dev/features/production-mode).
- Runtime/package contracts: [Node.js package/module fields and exports](https://nodejs.org/api/packages.html), [official NestJS TypeScript starter](https://github.com/nestjs/typescript-starter), [NestJS SWC](https://docs.nestjs.com/recipes/swc), [NestJS modules](https://docs.nestjs.com/modules), [NestJS configuration](https://docs.nestjs.com/techniques/configuration), [NestJS lifecycle events](https://docs.nestjs.com/fundamentals/lifecycle-events), and [NestJS logging](https://docs.nestjs.com/techniques/logger).
- Persistence/schema: [TypeORM DataSource options](https://typeorm.io/docs/data-source/data-source-options/), [migration setup](https://typeorm.io/docs/migrations/setup/), [migration generation](https://typeorm.io/docs/migrations/generating/), [migration execution](https://typeorm.io/docs/migrations/executing/), [entities](https://typeorm.io/docs/entity/entities/), [PostgreSQL identifier rules](https://www.postgresql.org/docs/current/sql-syntax-lexical.html), and [Flyway baseline migrations](https://documentation.red-gate.com/flyway/flyway-concepts/migrations/baseline-migrations).
- Next.js architecture/security: [authentication](https://nextjs.org/docs/app/guides/authentication), [backend-for-frontend](https://nextjs.org/docs/app/guides/backend-for-frontend), [data security](https://nextjs.org/docs/app/guides/data-security), [cookies](https://nextjs.org/docs/app/api-reference/functions/cookies), [proxy](https://nextjs.org/docs/app/getting-started/proxy), [content security policy](https://nextjs.org/docs/app/guides/content-security-policy), and [image optimization](https://nextjs.org/docs/app/getting-started/images).
- NestJS API security/operations: [authentication](https://docs.nestjs.com/security/authentication), [CSRF](https://docs.nestjs.com/security/csrf), [encryption and hashing](https://docs.nestjs.com/security/encryption-and-hashing), [file upload](https://docs.nestjs.com/techniques/file-upload), [versioning](https://docs.nestjs.com/techniques/versioning), [health checks](https://docs.nestjs.com/recipes/terminus), and [testing](https://docs.nestjs.com/fundamentals/testing).
- Identity and security: [Google OAuth web-server flow](https://developers.google.com/identity/protocols/oauth2/web-server), [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect), [RFC 9700 OAuth security](https://www.rfc-editor.org/rfc/rfc9700.html), [RFC 7009 token revocation](https://www.rfc-editor.org/rfc/rfc7009.html), [RFC 8725 JWT best current practices](https://www.rfc-editor.org/rfc/rfc8725.html), and [IETF example addresses](https://authors.ietf.org/example-addresses).
- OWASP controls: [Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [Forgot Password](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html), [Email Validation and Verification](https://cheatsheetseries.owasp.org/cheatsheets/Email_Validation_and_Verification_Cheat_Sheet.html), [File Upload](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html), [XSS Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html), [Content Security Policy](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html), [Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html), and [Logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html).
- Operations/logging: [Twelve-Factor logs](https://12factor.net/logs), [NestJS JSON logging](https://docs.nestjs.com/techniques/logger), and [Cloudinary access control](https://cloudinary.com/documentation/control_access_to_media).

## Tasks checklist

- [x] Complete the one-question-at-a-time grilling session and record the accepted official-docs/reliable-convention decisions.
- [x] Inventory the tracked tree, current generated artifacts, asset references, existing tests, user-owned modifications, and pre-existing deletions.
- [x] Add the target tree, ownership map, move/rename manifest, keep/delete manifest, execution phases, validation matrix, safety rules, and deferred work to this plan.
- [x] Obtain final approval of this plan before any implementation or destructive operation.
- [x] On a fresh checkout, reproduce and verify every entry in the documented 149-entry local-change replay manifest before beginning the refactor phases.
- [x] Freeze a baseline diff/status snapshot and preserve all user-owned changes and deletions.
- [x] Refactor root workspace metadata, Node/pnpm pins, scripts, ignores, formatting, Knip, CI, and environment templates.
- [x] Rename and harden workspace package manifests and the compiled `@mrh/types` contract.
- [x] Move API features, entities, integrations, classroom gateway, payment/lesson utilities, configuration, health, assets, lifecycle handling, and logging.
- [ ] Replace provisional TypeORM migrations with the verified snake_case baseline and remove synchronization/bootstrap paths.
- [ ] Replace seed data with safe reference/demo seed commands and isolated e2e fixtures.
- [x] Implement the accepted API security/runtime policies and update their regression tests.
- [x] Refactor the web routes/components/providers/lib boundaries, assets, metadata, server/client boundaries, and framework error/loading files.
- [x] Complete the same-origin browser authentication, OAuth, CSRF, WebSocket, and cookie contract.
- [ ] Apply deferred locale routing and then the official latest Next.js upgrade/proxy migration, CSP/SRI review, and Dependabot follow-up.
- [ ] Run the complete formatting, lint, type-check, Knip, unit, integration, migration, build, security, and provisioned e2e validation matrix.
- [x] Review the final diff for accidental deletions, stale paths, generated artifacts, credentials, and undocumented behavior changes.
- [ ] Replace this draft status with a handoff summary and mark the plan complete only after every required gate passes.
