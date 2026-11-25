# Sports Turf & Box Cricket Booking System

A modern, mobile-first Sports Turf & Box Cricket Booking System built with **Next.js (App Router)**, **Tailwind CSS**, **SQLite / Supabase (PostgreSQL)**, **SheetJS (`xlsx`)**, and **WhatsApp Webhook + `wa.me` fallback notifications**.

## Features

- **Customer Booking Page (`/`)**:
  - Clean interactive upcoming date picker (disables past dates).
  - Live time slot availability selector that automatically greys out and locks slots that are `pending` or `confirmed` (enforced with a partial unique index at the database level to prevent double-booking).
  - Dynamic pricing in Bangladeshi Taka (`৳`) for `5v5`, `6v6`, `7v7`, and custom player counts, configurable from the Admin Settings panel.
  - Instant booking confirmation modal displaying Booking ID, Match Date, Slot, Player Count, Required Advance (Ogrim), a one-tap `wa.me` WhatsApp summary link, and a "Done" button.
- **Automated Owner Notification (Webhook)**:
  - Sends an HTTP `POST` JSON payload to `ADMIN_WEBHOOK_URL` (compatible with BotSailor, Make.com, and n8n) on every new booking:
    ```json
    {
      "booking_id": "TRF-20261126-4821",
      "customer_name": "Tanvir Hasan",
      "customer_phone": "01712345678",
      "team_name": "Dhaka Strikers",
      "date": "2026-11-26",
      "time_slot": "07:00 PM – 08:30 PM",
      "players_per_team": 6,
      "total_amount": 3000,
      "advance_amount": 1400,
      "status": "pending",
      "created_at": "2026-11-25T19:15:00.000Z"
    }
    ```
- **Password-Protected Admin Dashboard (`/admin`)**:
  - Summary KPI cards: **Total Bookings**, **Today's Bookings**, **Total Advance Collected (`৳`)**, and **Pending Verification**.
  - Searchable, filterable bookings table (filter by Date, Status: `Pending`, `Confirmed`, `Cancelled`, or keyword) with one-click status toggle buttons.
  - **Real `.xlsx` Excel Export** powered by SheetJS (`xlsx`) with auto-fitted column widths, currency formatting, auto-filters, and a companion Summary sheet.
  - **Pricing & Turf Settings** tab to edit `5v5` / `6v6` / `7v7` rates, custom player rate formulas, daily time slots, and the fallback admin WhatsApp number.

---

## Running on Another PC (GitHub + Antigravity)

This repository includes [`AGENTS.md`](./AGENTS.md) and an automatic local setup script (`scripts/setup.mjs`), so you can clone it on any PC and resume working in Antigravity immediately.

### Prerequisites
- **Node.js `>= 22.5.0`** (Node 24 LTS recommended — see [`.nvmrc`](./.nvmrc))
- **Git**

### 1. Clone & Open in Antigravity
```bash
git clone https://github.com/akash971/Turf-Booking-Management-Software.git
cd Turf-Booking-Management-Software
```
Open the cloned folder in **Antigravity**. Antigravity will automatically read [`AGENTS.md`](./AGENTS.md) to load full project architecture and workflow context.

### 2. Install & Run (Auto-bootstraps `.env.local` + SQLite DB)
```bash
npm install
npm run dev
```
*(On Windows PowerShell if execution policy blocks `npm.ps1`, use `npm.cmd install` and `npm.cmd run dev`.)*

`npm run dev` automatically runs `scripts/setup.mjs` to create `.env.local` from `.env.example` on first run and initialize the local SQLite database in `./data/turf-bookings.db`.

- **Customer Booking Page:** `http://localhost:3000`
- **Admin Dashboard:** `http://localhost:3000/admin` (default password: `admin123`)

### 3. Sync Changes Between PCs
Before starting work on another PC:
```bash
git pull origin main
npm install
```
After making changes:
```bash
git add .
git commit -m "Describe your changes"
git push origin main
```

---

## Sharing Live Data Across PCs (Supabase PostgreSQL)

Local SQLite (`./data/turf-bookings.db`) stays on each PC and is excluded from Git. To share bookings and settings across multiple PCs or deploy to production:

1. Run [`supabase/schema.sql`](./supabase/schema.sql) in your Supabase SQL Editor.
2. Update `.env.local` on each PC (or set environment variables in Vercel / your host):
   ```env
   DATABASE_PROVIDER=supabase
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```
3. Restart the server.
