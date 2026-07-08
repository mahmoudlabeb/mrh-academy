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

---
*Built with ❤️ for MRH Academy.*
