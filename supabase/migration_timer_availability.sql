-- ============================================================
-- PROXIE — "In the area" chat timer + seller availability schedule
-- Run this in the Supabase SQL editor (project: uraixvdffarhezhopngt)
-- ============================================================

-- ── listings: availability schedule ──────────────────────────
alter table public.listings
  add column if not exists availability_type text default 'anytime'
    check (availability_type in ('anytime', 'scheduled')),
  add column if not exists schedule jsonb default '[]'::jsonb;

-- schedule format: array of windows, each:
--   { "days": [0,1,2,3,4,5,6], "start": "09:00", "end": "14:00" }
-- days: 0 = Sunday … 6 = Saturday. Times are 24h "HH:MM" in the seller's local time.

-- ── conversations: "in the area" timer ───────────────────────
alter table public.conversations
  add column if not exists timer_expires_at timestamptz,
  add column if not exists timer_extended_count int default 0;

-- No new RLS policies needed — existing "participants update" policy on
-- conversations and "owner update" policy on listings already cover these columns.
