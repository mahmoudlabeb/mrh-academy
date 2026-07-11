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
- **Monorepo:** Turborepo, pnpm

## Project Structure

```text
├── apps/
│   ├── web/        # Next.js frontend
│   └── api/        # NestJS API
├── packages/
│   └── types/      # Shared TypeScript types
├── scripts/        # Backup, deployment helpers
└── docs/           # Setup guides (including Arabic)
```

## Quick Start (Windows, no Docker)

### Prerequisites

- Node.js 18+
- pnpm
- PostgreSQL
- Redis

### Installation

1. Clone and install:
   ```bash
   git clone https://github.com/mahmoudlabeb/mrh-academy.git
   cd mrh-academy
   pnpm install
   ```

2. Copy environment file:
   ```bash
   copy .env.example .env
   ```
   Edit `.env` at the repo root with your PostgreSQL, Redis, JWT, and integration keys.

3. Run migrations and seed:
   ```bash
   cd apps/api
   pnpm run migration:run
   pnpm run seed
   ```

4. Start development:
   ```bash
   pnpm run dev
   ```
   - Web: http://localhost:3000
   - API: http://localhost:4000
   - Swagger (dev): http://localhost:4000/api/docs

## Demo Accounts (password: `123456`)

| Role | Email |
|------|-------|
| Admin | admin@mrhacademy.com |
| Tutor | Sarah.alazzeh87@gmail.com |
| Student | student@demo.com |

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

```powershell
# Windows
.\scripts\backup-db.ps1

# Linux/macOS
./scripts/backup-db.sh
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

See `.env.example` for the full list including Gemini, Bunny.net, Google OAuth, and SMTP.

### Arabic setup guide

See [docs/SETUP_AR.md](./docs/SETUP_AR.md)

### Health checks

```bash
curl http://localhost:4000/api/v1/health
curl http://localhost:4000/api/v1/health/integrations
```

## Testing

```bash
# API unit tests
cd apps/api && pnpm test

# API e2e
cd apps/api && pnpm run test:e2e

# Playwright e2e (requires running API + seeded DB)
cd apps/web && pnpm run test:e2e
```

---
Built for MRH Academy.
