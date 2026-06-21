-- ============================================================
-- PROXIE — Push notifications
-- Run this in the Supabase SQL editor (project: uraixvdffarhezhopngt)
-- ============================================================

alter table public.profiles
  add column if not exists push_token text,
  add column if not exists push_token_updated_at timestamptz;

-- No new RLS policy needed — "profiles: own write" already covers this column.
