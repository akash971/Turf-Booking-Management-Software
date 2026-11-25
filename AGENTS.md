# AGENTS.md — Sports Turf & Box Cricket Booking System

This file provides workspace context for Antigravity (and coding agents) when opening this repository on any machine.

## Project Overview

- **Stack**: Next.js 15 (App Router, TypeScript), Tailwind CSS v4, SheetJS (`xlsx`), Node built-in `node:sqlite` (default local DB) + optional Supabase PostgreSQL (`@supabase/supabase-js`).
- **Node Requirement**: Node.js `>= 22.5.0` (recommended: Node 24 LTS, see `.nvmrc`) for built-in `node:sqlite` (`DatabaseSync`).
- **Styling**: Emerald green & dark slate modern sports-turf theme (`src/app/globals.css`).

## Key Paths

- **Customer Booking UI (`/`)**: `src/app/page.tsx`, `src/components/BookingClient.tsx`, `src/components/CalendarPicker.tsx`, `src/components/BookingModal.tsx`
- **Admin Dashboard (`/admin`)**: `src/app/admin/page.tsx`, `src/components/AdminDashboardClient.tsx`
- **Database Layer**: `src/lib/db/index.ts` (switches between `sqlite.ts` and `supabase.ts` based on `DATABASE_PROVIDER`), `supabase/schema.sql`
- **Pricing & WhatsApp Helpers**: `src/lib/pricing.ts`
- **Excel Export (`.xlsx`)**: `src/lib/excel.ts`
- **Webhook Notifier**: `src/lib/webhook.ts`
- **Admin Session Auth**: `src/lib/auth.ts`
- **API Routes**:
  - `GET/PUT /api/settings` — turf pricing tiers, custom player formula, daily slots, WhatsApp number
  - `GET /api/slots?date=YYYY-MM-DD` — live slot availability
  - `GET/POST /api/bookings` — create customer booking (locks slot as `pending`, fires webhook) & admin filtered listing
  - `PATCH /api/bookings/[bookingId]` — admin one-click status toggle (`pending` / `confirmed` / `cancelled`)
  - `GET/POST/DELETE /api/admin/auth` — password login & HTTP-only signed session cookie
  - `GET /api/admin/export` — binary `.xlsx` spreadsheet download

## Running on a New Machine

1. Install dependencies:
   - macOS/Linux: `npm install`
   - Windows PowerShell (if script execution policy blocks `npm.ps1`): `npm.cmd install`
2. Start dev server (automatically runs `scripts/setup.mjs` via `predev` to create `.env.local` from `.env.example` if missing):
   - `npm run dev` (or `npm.cmd run dev` on Windows)
3. Verify build & types:
   - `npx tsc --noEmit && npm run build` (use `npx.cmd` / `npm.cmd` on Windows PowerShell if needed)

## Rules & Conventions

- **Never commit secrets or local databases**: `.env.local` and `data/*.db*` are gitignored. Keep real credentials in `.env.local` only.
- **Double-booking prevention**: Always preserve the partial unique index `idx_unique_active_slot` on `(match_date, time_slot) WHERE status IN ('pending', 'confirmed')` in both SQLite and Supabase schemas.
- **Database portability**: When adding schema or query changes, update **both** `src/lib/db/sqlite.ts` and `src/lib/db/supabase.ts` (plus `supabase/schema.sql`).
- **Currency**: All amounts are stored as integer Bangladeshi Taka (BDT / `৳`).
