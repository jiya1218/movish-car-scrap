# Movish Group — Business Management System (BMS)

Centralized Meta Ads, Lead Management CRM, Vehicle Scrapping Operations, and Financial Analytics platform for **Movish Group** (Gujarat, India).

## Tech Stack
- **Frontend & API:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS
- **Database & ORM:** Prisma + SQLite (`prisma/schema.prisma`)
- **Charts & Exports:** Recharts, Lucide React, SheetJS (`xlsx`), jsPDF

## Local Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure environment variables:
   ```bash
   copy .env.example .env
   ```
3. Initialize database and seed Gujarat operations data:
   ```bash
   npx prisma generate
   npx prisma db push
   npx tsx prisma/seed.ts
   ```
4. Run development or production server:
   ```bash
   npm run dev
   # or
   npm run build
   npm run start
   ```

## Role Accounts (Default Password: `Movish@2026`)
- Super Admin / Owner: `owner@movishgroup.in`
- Admin: `admin@movishgroup.in`
- Manager: `manager@movishgroup.in`
- Sales Executive: `karan.sales@movishgroup.in`
- Marketing Executive: `marketing@movishgroup.in`
- Operations Executive: `operations@movishgroup.in`
- Accounts Executive: `accounts@movishgroup.in`
