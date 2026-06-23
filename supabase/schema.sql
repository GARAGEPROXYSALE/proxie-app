-- ============================================================
-- PROXIE — Complete Supabase Schema
-- Run this entire file in the Supabase SQL editor
-- Project: uraixvdffarhezhopngt
-- ============================================================

-- ── Extensions ──────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "postgis" schema extensions;

-- ── profiles ────────────────────────────────────────────────
-- Extends auth.users. Created automatically via trigger on sign-up.
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text,
  avatar_url    text,
  bio           text default '',
  building      text,
  status        text default 'Active',
  rating        numeric(3,1) default 5.0,
  sales         int default 0,
  seller_type   text default 'individual' check (seller_type in ('individual','store')),
  store_id      uuid,
  member_since  timestamptz default now(),
  push_token    text,
  push_token_updated_at timestamptz,
  created_at    timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "profiles: public read"    on public.profiles for select using (true);
create policy "profiles: own write"      on public.profiles for update using (auth.uid() = id);
create policy "profiles: own insert"     on public.profiles for insert with check (auth.uid() = id);

-- Auto-create profile on sign-up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, member_since)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)), now())
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── stores ──────────────────────────────────────────────────
create table if not exists public.stores (
  id          uuid primary key default uuid_generate_v4(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  name        text not null,
  description text default '',
  logo_url    text,
  banner_url  text,
  rating      numeric(3,1) default 5.0,
  sales       int default 0,
  created_at  timestamptz default now()
);
alter table public.stores enable row level security;
create policy "stores: public read"   on public.stores for select using (true);
create policy "stores: owner write"   on public.stores for all using (auth.uid() = owner_id);

-- ── listings ────────────────────────────────────────────────
create table if not exists public.listings (
  id                  uuid primary key default uuid_generate_v4(),
  seller_id           uuid not null references public.profiles(id) on delete cascade,
  title               text not null,
  price               numeric(10,2) not null default 0,
  description         text default '',
  category            text not null default 'Other',
  photos              text[] default '{}',
  latitude            double precision,
  longitude           double precision,
  address             text,
  status              text default 'active' check (status in ('active','sold','expired','picked_up')),
  is_boosted          boolean default false,
  boosted_radius_miles numeric(5,2),
  is_promoted         boolean default false,
  repost_of           uuid references public.listings(id),
  repost_count        int default 0,
  impression_count    int default 0,
  tap_count           int default 0,
  seller_type         text default 'individual' check (seller_type in ('individual','store')),
  store_id            uuid references public.stores(id),
  expires_at          timestamptz default (now() + interval '7 days'),
  availability_type   text default 'anytime' check (availability_type in ('anytime','scheduled')),
  schedule            jsonb default '[]'::jsonb,
  created_at          timestamptz default now()
);
alter table public.listings enable row level security;
create policy "listings: public read"         on public.listings for select using (true);
create policy "listings: owner insert"        on public.listings for insert with check (auth.uid() = seller_id);
create policy "listings: owner update"        on public.listings for update using (auth.uid() = seller_id);
create policy "listings: owner delete"        on public.listings for delete using (auth.uid() = seller_id);

create index if not exists listings_seller_id_idx  on public.listings(seller_id);
create index if not exists listings_status_idx     on public.listings(status);
create index if not exists listings_created_at_idx on public.listings(created_at desc);
create index if not exists listings_expires_at_idx on public.listings(expires_at);

-- ── conversations ────────────────────────────────────────────
create table if not exists public.conversations (
  id                    uuid primary key default uuid_generate_v4(),
  listing_id            uuid references public.listings(id) on delete set null,
  buyer_id              uuid not null references public.profiles(id) on delete cascade,
  seller_id             uuid not null references public.profiles(id) on delete cascade,
  last_message_preview  text default '',
  last_message_at       timestamptz default now(),
  buyer_archived        boolean default false,
  seller_archived       boolean default false,
  buyer_pinned          boolean default false,
  seller_pinned         boolean default false,
  timer_expires_at      timestamptz,
  timer_extended_count  int default 0,
  created_at            timestamptz default now(),
  unique(listing_id, buyer_id, seller_id)
);
alter table public.conversations enable row level security;
create policy "conversations: participants read"
  on public.conversations for select
  using (auth.uid() = buyer_id or auth.uid() = seller_id);
create policy "conversations: buyer create"
  on public.conversations for insert
  with check (auth.uid() = buyer_id);
create policy "conversations: participants update"
  on public.conversations for update
  using (auth.uid() = buyer_id or auth.uid() = seller_id);

create index if not exists conv_buyer_idx  on public.conversations(buyer_id);
create index if not exists conv_seller_idx on public.conversations(seller_id);

-- ── messages ────────────────────────────────────────────────
-- Drop and recreate if schema differs from old structure
create table if not exists public.messages (
  id              uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null references public.profiles(id) on delete cascade,
  body            text not null default '',
  type            text default 'text' check (type in ('text','offer','meetup','image')),
  offer_price     numeric(10,2),
  meetup_date     text,
  meetup_time     text,
  meetup_location text,
  read_at         timestamptz,
  created_at      timestamptz default now()
);
alter table public.messages enable row level security;
create policy "messages: participants read"
  on public.messages for select
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
    )
  );
create policy "messages: sender insert"
  on public.messages for insert
  with check (auth.uid() = sender_id);

create index if not exists messages_conv_idx     on public.messages(conversation_id);
create index if not exists messages_created_idx  on public.messages(created_at);

-- Update conversation preview on new message
create or replace function public.update_conversation_on_message()
returns trigger language plpgsql security definer as $$
begin
  update public.conversations
    set last_message_preview = left(new.body, 120),
        last_message_at = new.created_at
  where id = new.conversation_id;
  return new;
end;
$$;
drop trigger if exists on_new_message on public.messages;
create trigger on_new_message
  after insert on public.messages
  for each row execute procedure public.update_conversation_on_message();

-- ── collections (saved folders) ─────────────────────────────
create table if not exists public.collections (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  name       text not null,
  emoji      text default '📁',
  created_at timestamptz default now()
);
alter table public.collections enable row level security;
create policy "collections: own only" on public.collections for all using (auth.uid() = user_id);

-- ── saved_listings ───────────────────────────────────────────
create table if not exists public.saved_listings (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  listing_id    uuid not null references public.listings(id) on delete cascade,
  collection_id uuid references public.collections(id) on delete set null,
  created_at    timestamptz default now(),
  unique(user_id, listing_id, collection_id)
);
alter table public.saved_listings enable row level security;
create policy "saved_listings: own only" on public.saved_listings for all using (auth.uid() = user_id);

create index if not exists saved_user_idx on public.saved_listings(user_id);

-- ── wishlist_entries ─────────────────────────────────────────
create table if not exists public.wishlist_entries (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  categories      text[] default '{}',
  max_price       numeric(10,2),
  radius_miles    numeric(5,2) default 5,
  keywords        text default '',
  created_at      timestamptz default now()
);
alter table public.wishlist_entries enable row level security;
create policy "wishlist: own only" on public.wishlist_entries for all using (auth.uid() = user_id);

-- ── blocked_users ────────────────────────────────────────────
create table if not exists public.blocked_users (
  blocker_id  uuid not null references public.profiles(id) on delete cascade,
  blocked_id  uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz default now(),
  primary key (blocker_id, blocked_id)
);
alter table public.blocked_users enable row level security;
create policy "blocked_users: own only" on public.blocked_users for all using (auth.uid() = blocker_id);

-- ── RPC helpers ──────────────────────────────────────────────

-- Increment listing views (tap_count)
create or replace function public.increment_views(listing_id uuid)
returns void language sql security definer as $$
  update public.listings set tap_count = tap_count + 1 where id = listing_id;
$$;

-- Increment impression count (called by feed rendering)
create or replace function public.increment_impressions(listing_id uuid)
returns void language sql security definer as $$
  update public.listings set impression_count = impression_count + 1 where id = listing_id;
$$;

-- Mark listing sold
create or replace function public.mark_listing_sold(listing_id uuid)
returns void language sql security definer as $$
  update public.listings set status = 'sold' where id = listing_id and seller_id = auth.uid();
$$;

-- Expire listings older than 7 days (called by a cron or manually)
create or replace function public.expire_old_listings()
returns void language sql security definer as $$
  update public.listings
    set status = 'expired'
  where status = 'active'
    and expires_at < now();
$$;

-- Repost: mark original expired, insert fresh clone
create or replace function public.repost_listing(original_id uuid)
returns uuid language plpgsql security definer as $$
declare
  orig public.listings%rowtype;
  new_id uuid;
begin
  select * into orig from public.listings where id = original_id and seller_id = auth.uid();
  if not found then
    raise exception 'listing not found or not owned by user';
  end if;
  -- Mark original expired
  update public.listings set status = 'expired' where id = original_id;
  -- Insert repost
  insert into public.listings (
    seller_id, title, price, description, category, photos,
    latitude, longitude, address, seller_type, store_id,
    is_boosted, boosted_radius_miles, is_promoted,
    repost_of, repost_count, expires_at
  ) values (
    orig.seller_id, orig.title, orig.price, orig.description, orig.category, orig.photos,
    orig.latitude, orig.longitude, orig.address, orig.seller_type, orig.store_id,
    orig.is_boosted, orig.boosted_radius_miles, orig.is_promoted,
    original_id, coalesce(orig.repost_count,0) + 1, now() + interval '7 days'
  ) returning id into new_id;
  return new_id;
end;
$$;

-- ── Storage buckets ──────────────────────────────────────────
-- Run these separately in the Supabase dashboard Storage section,
-- or via the storage API. Buckets needed:
--   listing-photos  (public)
--   avatars         (public)
--
-- SQL equivalent (requires service role):
insert into storage.buckets (id, name, public)
  values ('listing-photos', 'listing-photos', true)
  on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
  values ('avatars', 'avatars', true)
  on conflict (id) do nothing;

-- Storage policies
create policy "listing-photos: public read"
  on storage.objects for select
  using (bucket_id = 'listing-photos');

create policy "listing-photos: auth upload"
  on storage.objects for insert
  with check (bucket_id = 'listing-photos' and auth.role() = 'authenticated');

create policy "listing-photos: owner delete"
  on storage.objects for delete
  using (bucket_id = 'listing-photos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "avatars: public read"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars: auth upload"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.role() = 'authenticated');

create policy "avatars: owner delete"
  on storage.objects for delete
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
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
