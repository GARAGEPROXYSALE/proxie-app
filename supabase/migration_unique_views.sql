-- ============================================================
-- PROXIE — unique-viewer view counts
-- Run this in the Supabase SQL editor (project: uraixvdffarhezhopngt)
-- ============================================================

-- One row per (user, listing) — lets us tell "first ever view by this
-- person" apart from "they reopened the same listing again."
create table if not exists public.listing_views (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, listing_id)
);
alter table public.listing_views enable row level security;
create policy "listing_views: own insert" on public.listing_views for insert with check (auth.uid() = user_id);
create policy "listing_views: own read"   on public.listing_views for select using (auth.uid() = user_id);

-- Increments tap_count only the first time this specific user views this
-- listing. Re-viewing (refresh, reopening, navigating back) is a no-op.
create or replace function public.record_view(p_listing_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.listing_views (user_id, listing_id)
  values (auth.uid(), p_listing_id)
  on conflict (user_id, listing_id) do nothing;

  if found then
    update public.listings set tap_count = tap_count + 1 where id = p_listing_id;
  end if;
end;
$$;

-- Guests (no auth.uid()) have no reliable identity to dedupe against —
-- the existing increment_views() function stays as their fallback path,
-- so guest views still count but aren't deduplicated.
