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

## Quick Start (Local SQLite)

1. Copy `.env.example` to `.env.local` (a default `.env.local` is already configured for local testing):
   ```bash
   cp .env.example .env.local
   ```
2. Install dependencies and start the development server:
   ```bash
   npm install
   npm run dev
   ```
3. Open:
   - Customer Booking Page: `http://localhost:3000`
   - Admin Dashboard: `http://localhost:3000/admin` (default password in `.env.local`: `admin123`)

## Switching to Supabase (PostgreSQL)

1. Run [`supabase/schema.sql`](./supabase/schema.sql) in your Supabase SQL Editor.
2. Update `.env.local`:
   ```env
   DATABASE_PROVIDER=supabase
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```
3. Restart the server.
