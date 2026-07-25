# MRH Academy — Client Setup and Acceptance

This package contains the complete application source without private credentials.
The client must supply credentials through the hosting provider's secret/environment
settings. Never send completed `.env` files by email or place them in source control.

## 1. Configure

1. Copy `apps/api/.env.example` to `apps/api/.env`.
2. Copy `apps/web/.env.example` to `apps/web/.env.local`.
3. Replace every production value using `docs/CLIENT_CREDENTIALS_AND_ACCEPTANCE.md`.
4. Run:

```powershell
pnpm install --frozen-lockfile
node scripts/validate-client-config.mjs
pnpm --filter @mrh/api migration:run
pnpm build
```

## 2. Start

```powershell
pnpm dev
```

Local web: `http://localhost:3000`

Local API: `http://localhost:4000/api/v1`

## 3. Accept

After deployment, open `GET /api/v1/health/integrations`, then complete the
short external acceptance checklist in `docs/CLIENT_CREDENTIALS_AND_ACCEPTANCE.md`.
Code completion does not replace payment-provider approval, real-inbox delivery,
or a two-device camera/microphone test.
