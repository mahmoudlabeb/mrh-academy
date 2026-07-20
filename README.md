# MRH Academy - Premium E-Learning Platform

MRH Academy is a comprehensive online learning platform with virtual classrooms, video calls, multi-role dashboards, payments, and bilingual support (Arabic/English).

## Features

- **Multi-Role System:** Admin, SubAdmin, Tutor, and Student dashboards
- **Virtual Classrooms:** Real-time chat, whiteboard, WebRTC video/voice, screen sharing
- **Booking & Scheduling:** Tutor availability and lesson booking with commission tiers
- **Payments:** 6 methods (Card/Stripe, PayPal auto-approve, manual methods with admin approval)
- **Courses:** Bunny.net streaming, enrollment, referral tracking
- **AI Vocabulary:** Gemini-powered vocabulary tool
- **Security:** CSRF, rate limiting, session locking, JWT access/refresh separation

## Tech Stack

- **Frontend:** Next.js 15, React 19, Tailwind CSS v4
- **Backend:** NestJS 11, TypeORM, PostgreSQL, Redis, Socket.IO
- **Monorepo:** Turborepo, pnpm 11, Node.js 24 LTS

## Project Structure

```text
├── apps/
│   ├── web/        # Next.js frontend
│   └── api/        # NestJS API
├── packages/
│   └── types/      # Shared TypeScript types
└── scripts/        # Repository-wide maintenance helpers
```

## Quick Start

### Prerequisites

- Node.js 24 LTS
- pnpm 11 (the exact version is pinned in `package.json`)
- PostgreSQL
- Redis

### Installation

1. Clone and install:
   ```bash
   git clone https://github.com/mahmoudlabeb/mrh-academy.git
   cd mrh-academy
   pnpm install
   ```

2. Configure each application:
   ```bash
   cp apps/api/.env.example apps/api/.env
   cp apps/web/.env.example apps/web/.env.local
   ```
   Edit the application-owned files with your PostgreSQL, Redis, JWT, and integration keys.

3. Run migrations and start both workspaces:
   ```bash
   pnpm --filter @mrh/api migration:run
   pnpm dev
   ```
   - Web: http://localhost:3000
   - API: http://localhost:4000
   - Swagger (dev): http://localhost:4000/api/docs

Demo fixtures are opt-in and require `DEMO_SEED_PASSWORD` in the API's local
environment. They use fictional `.example` identities and never reset an
existing password:

```bash
pnpm --filter @mrh/api db:seed:demo
```

## Production Deployment

### Build

```bash
pnpm build
```

### PM2

```bash
pnpm build
pm2 start ecosystem.config.js --env production
```

### Database Backup

```bash
pnpm db:backup
```

### Required environment variables (production)

| Variable | Notes |
|----------|-------|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | 32+ random characters |
| `FRONTEND_URL` | Your frontend URL (CORS/CSRF locked to this) |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis for session locking |
| `ADMIN_EMAILS` | Comma-separated admin emails |
| `SUBADMIN_DEFAULT_PASSWORD` | Required in production |
| `STRIPE_SECRET_KEY` | For card payments |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook verification |

See `apps/api/.env.example` and `apps/web/.env.example` for the complete
application-owned configuration lists.

### Health checks

```bash
curl http://localhost:4000/api/v1/health
curl http://localhost:4000/api/v1/health/integrations
```

## Testing

```bash
# Workspace checks
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build

# API unit tests
pnpm --filter @mrh/api test

# API e2e
pnpm --filter @mrh/api test:e2e

# Playwright e2e (requires running API + seeded DB)
pnpm --filter @mrh/web test:e2e
```

---
Built for MRH Academy.
