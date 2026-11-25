-- ============================================================================
-- Sports Turf & Box Cricket Booking System - Supabase (PostgreSQL) Schema
-- Run this SQL in your Supabase SQL Editor when using DATABASE_PROVIDER=supabase
-- ============================================================================

-- 1. Configurable Pricing Tiers Table (Admin-editable)
CREATE TABLE IF NOT EXISTS public.pricing_settings (
  players_per_team INTEGER PRIMARY KEY,
  label TEXT NOT NULL,
  total_price INTEGER NOT NULL CHECK (total_price >= 0),
  advance_amount INTEGER NOT NULL CHECK (advance_amount >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default Bangladeshi Taka (BDT) pricing tiers
INSERT INTO public.pricing_settings (players_per_team, label, total_price, advance_amount)
VALUES
  (5, '5v5 Standard', 2500, 1200),
  (6, '6v6 Popular', 3000, 1400),
  (7, '7v7 Full Box', 3500, 1600)
ON CONFLICT (players_per_team) DO NOTHING;

-- 2. Turf General & Custom Pricing Configuration Table
CREATE TABLE IF NOT EXISTS public.turf_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.turf_config (key, value)
VALUES
  ('custom_base_players', '5'),
  ('custom_base_total', '2500'),
  ('custom_base_advance', '1200'),
  ('custom_per_player_total', '500'),
  ('custom_per_player_advance', '200'),
  ('admin_whatsapp_number', '8801712345678'),
  ('time_slots', '["08:00 AM – 09:30 AM","10:00 AM – 11:30 AM","04:00 PM – 05:30 PM","05:30 PM – 07:00 PM","07:00 PM – 08:30 PM","09:00 PM – 10:30 PM","10:30 PM – 12:00 AM"]')
ON CONFLICT (key) DO NOTHING;

-- 3. Bookings Table
CREATE TABLE IF NOT EXISTS public.bookings (
  id BIGSERIAL PRIMARY KEY,
  booking_id TEXT NOT NULL UNIQUE,
  match_date DATE NOT NULL,
  time_slot TEXT NOT NULL,
  players_per_team INTEGER NOT NULL CHECK (players_per_team >= 2 AND players_per_team <= 22),
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  team_name TEXT,
  total_amount INTEGER NOT NULL CHECK (total_amount >= 0),
  advance_amount INTEGER NOT NULL CHECK (advance_amount >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  webhook_status TEXT NOT NULL DEFAULT 'skipped',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prevent double-booking for active (pending or confirmed) bookings on the same date + slot
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_slot
  ON public.bookings (match_date, time_slot)
  WHERE status IN ('pending', 'confirmed');

-- Helpful query indexes for admin dashboard filtering
CREATE INDEX IF NOT EXISTS idx_bookings_match_date ON public.bookings (match_date);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings (status);
CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON public.bookings (created_at DESC);
