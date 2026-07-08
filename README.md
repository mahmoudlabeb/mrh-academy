# MRH Academy - Premium E-Learning Platform

MRH Academy is a comprehensive, state-of-the-art online learning platform built to provide interactive virtual classrooms, integrated video calls, live tracking, multi-role dashboards, and seamless payment integration. Designed with a premium, fully responsive, and highly animated UI.

## 🚀 Features

- **Multi-Role System:** Dedicated dashboards and workflows for Admins, Tutors, and Students.
- **Interactive Virtual Classrooms:** Real-time video calls, interactive whiteboards, and screen sharing built directly into the platform.
- **Real-time Messaging & Notifications:** Integrated chat system connecting students and tutors.
- **Advanced Booking & Scheduling:** Tutors can manage their availability and students can book sessions seamlessly.
- **Premium User Interface:** Highly animated, responsive, and luxury-styled Arabic UI with smooth video-like CSS animations.
- **Secure Payments:** Integrated with Stripe for course enrollments and wallet balances.
- **Bilingual Support (i18n):** Supports Arabic (RTL) and English (LTR).

## 🛠️ Tech Stack

- **Frontend (Web App):** Next.js 15, React 19, Tailwind CSS v4, Framer Motion, Zustand.
- **Backend (API):** NestJS, TypeScript, TypeORM, PostgreSQL, Redis, Socket.IO.
- **Monorepo:** Turborepo, pnpm.

## 📦 Project Structure

```text
├── apps/
│   ├── web/        # Next.js Frontend Application
│   └── api/        # NestJS Backend API
├── packages/
│   └── types/      # Shared TypeScript types between frontend and backend
```

## ⚙️ Quick Start

### Prerequisites
- Node.js (v18+)
- pnpm
- PostgreSQL & Redis

### Installation & Running

1. **Clone the repository:**
   ```bash
   git clone https://github.com/mahmoudlabeb/mrh-academy.git
   cd mrh-academy
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Set up environment variables:**
   - Configure PostgreSQL and Redis credentials in `apps/api/.env`.
   - Update Google OAuth and Stripe keys as needed.

4. **Start the development server:**
   ```bash
   pnpm run dev
   ```
   This will spin up both the Web App (http://localhost:3000) and the API (http://localhost:4001).

## 🔑 Demo Accounts (Default Password: `123456`)
- **Admin:** `admin@mrhacademy.com`
- **Tutors:** `Sarah.alazzeh87@gmail.com`, `yasmenaiman1@gmail.com`
- **Students:** `student@demo.com`, `john.doe@gmail.com`

## 🌐 Production Deployment

| Service | URL |
|---|---|
| Frontend (Vercel) | https://mrh-academy-1.vercel.app |
| API (Render) | https://mrh-academy.onrender.com |

### Vercel environment variables

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://mrh-academy.onrender.com/api/v1` |

### Render environment variables (required)

| Variable | Example / notes |
|---|---|
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | `https://mrh-academy-1.vercel.app` |
| `JWT_SECRET` | 32+ random characters (never use the default) |
| `ADMIN_EMAILS` | `admin@mrhacademy.com` |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |

### Verify deployment

```bash
# API health
curl https://mrh-academy.onrender.com/api/v1/health

# Login smoke test
curl -X POST https://mrh-academy.onrender.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -H "Origin: https://mrh-academy-1.vercel.app" \
  -d '{"email":"admin@mrhacademy.com","password":"123456"}'
```

After changing env vars on Vercel, **redeploy** so `NEXT_PUBLIC_*` values are baked into the build.

---
*Built with ❤️ for MRH Academy.*
