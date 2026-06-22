-- ============================================================
-- PROXIE — Outpost feature
-- Run this in the Supabase SQL editor (project: uraixvdffarhezhopngt)
-- ============================================================

-- ── listings: Outpost fields ──────────────────────────────────
alter table public.listings
  add column if not exists is_outpost            boolean default false,
  add column if not exists outpost_scheduled_at   timestamptz,
  add column if not exists outpost_confirmed      boolean default false,
  add column if not exists outpost_confirmed_at   timestamptz,
  add column if not exists outpost_fee_paid       boolean default false,
  add column if not exists outpost_fee_amount     numeric(10,2);

create index if not exists listings_outpost_idx
  on public.listings(is_outpost, outpost_confirmed)
  where is_outpost = true;

-- ── app_config — single source of truth for the configurable fee ──
-- Public read so both the client and Edge Functions can display/charge
-- the current amount without hardcoding it anywhere.
create table if not exists public.app_config (
  key   text primary key,
  value jsonb not null
);
alter table public.app_config enable row level security;
create policy "app_config: public read" on public.app_config for select using (true);

insert into public.app_config (key, value)
  values ('outpost_fee_usd', '5.99')
  on conflict (key) do nothing;

-- ── listing_saves — bookmark + Outpost confirmation notification subscription ──
create table if not exists public.listing_saves (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  listing_id  uuid not null references public.listings(id) on delete cascade,
  created_at  timestamptz default now(),
  unique(user_id, listing_id)
);
alter table public.listing_saves enable row level security;
create policy "listing_saves: own read"   on public.listing_saves for select using (auth.uid() = user_id);
create policy "listing_saves: own insert" on public.listing_saves for insert with check (auth.uid() = user_id);
create policy "listing_saves: own delete" on public.listing_saves for delete using (auth.uid() = user_id);

create index if not exists listing_saves_listing_idx on public.listing_saves(listing_id);

-- ── RPC: confirm_outpost ───────────────────────────────────────
-- Called by the seller's own device once their background location task
-- detects them within range of their Outpost listing, on/after the
-- scheduled time. Restricted to the listing's own seller.
create or replace function public.confirm_outpost(listing_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.listings
    set outpost_confirmed = true,
        outpost_confirmed_at = now()
  where id = listing_id
    and seller_id = auth.uid()
    and is_outpost = true
    and outpost_confirmed = false
    and (outpost_scheduled_at is null or now() >= outpost_scheduled_at);
end;
$$;

-- ── RPC: seller's interested-buyers list ────────────────────────
-- One row per unique buyer who has messaged about a listing, oldest first.
create or replace function public.get_interested_buyers(p_listing_id uuid)
returns table (
  buyer_id uuid,
  buyer_name text,
  buyer_avatar_url text,
  conversation_id uuid,
  first_message_at timestamptz
) language sql security definer set search_path = public as $$
  select
    c.buyer_id,
    p.display_name,
    p.avatar_url,
    c.id,
    c.created_at
  from public.conversations c
  join public.profiles p on p.id = c.buyer_id
  where c.listing_id = p_listing_id
    and c.seller_id = auth.uid()
  order by c.created_at asc;
$$;

-- Batched count version — one query for every listing on the seller's
-- My Garage screen instead of one RPC call per card.
create or replace function public.get_interested_counts(p_listing_ids uuid[])
returns table (
  listing_id uuid,
  interested_count bigint
) language sql security definer set search_path = public as $$
  select listing_id, count(distinct buyer_id)
  from public.conversations
  where listing_id = any(p_listing_ids)
    and seller_id = auth.uid()
  group by listing_id;
$$;

-- ── Trigger: notify savers when an Outpost confirms ─────────────
-- Fires only on the false -> true transition. Calls the notify-outpost-confirmed
-- Edge Function (deploy with --no-verify-jwt so this server-to-server call
-- doesn't need a user JWT) which pushes to everyone in listing_saves.
create extension if not exists pg_net;

create or replace function public.notify_outpost_confirmed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.outpost_confirmed = true and coalesce(old.outpost_confirmed, false) = false then
    perform net.http_post(
      url := 'https://uraixvdffarhezhopngt.functions.supabase.co/notify-outpost-confirmed',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object('listing_id', new.id)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists on_outpost_confirmed on public.listings;
create trigger on_outpost_confirmed
  after update on public.listings
  for each row execute procedure public.notify_outpost_confirmed();

-- No RLS policy changes needed beyond the above — existing
-- "listings: owner update" already covers the new columns.
