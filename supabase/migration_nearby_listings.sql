-- ============================================================
-- PROXIE — server-side radius filtering for the feed
-- Run this in the Supabase SQL editor (project: uraixvdffarhezhopngt)
-- ============================================================
--
-- Problem this fixes: fetchListings() pulls every active listing in the
-- whole table to every client, every load, then each phone does its own
-- distance math in JS. At any real scale that's a full-table query fired
-- by every concurrent user. The "postgis" extension has been enabled in
-- this schema since the start but was never actually used anywhere — this
-- is what it's for.
--
-- Nothing here drops or deletes any existing data. It only ADDS a column,
-- an index, a trigger, and a function. If Supabase's editor still shows a
-- "potential destructive operation" warning when you run this, read on —
-- explained at the bottom of this file.

-- ── geog column — a PostGIS point derived from lat/long, kept in sync
-- automatically by the trigger below whenever a row is inserted or updated.
alter table public.listings
  add column if not exists geog geography(Point, 4326);

create or replace function public.listings_set_geog()
returns trigger language plpgsql as $$
begin
  if new.latitude is not null and new.longitude is not null then
    new.geog := ST_SetSRID(ST_MakePoint(new.longitude, new.latitude), 4326)::geography;
  else
    new.geog := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_listings_set_geog on public.listings;
create trigger trg_listings_set_geog
  before insert or update on public.listings
  for each row execute procedure public.listings_set_geog();

-- Backfill geog for every listing that already has coordinates.
update public.listings
set geog = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
where latitude is not null and longitude is not null and geog is null;

-- Spatial index — this is what makes "give me everything within N miles"
-- a fast indexed lookup instead of a full-table scan.
create index if not exists listings_geog_idx on public.listings using gist (geog);

-- ── nearby_listings RPC — does the radius + category filter, the
-- distance calculation, AND the seller/store join all in one query, on the
-- database, instead of three round trips and a client-side full-table scan.
create or replace function public.nearby_listings(
  p_lat double precision,
  p_lon double precision,
  p_radius_miles double precision,
  p_category text default null,
  p_exclude_seller_id uuid default null
)
returns table (
  id uuid,
  seller_id uuid,
  title text,
  price numeric,
  description text,
  category text,
  photos text[],
  latitude double precision,
  longitude double precision,
  address text,
  status text,
  is_boosted boolean,
  boosted_radius_miles numeric,
  is_promoted boolean,
  repost_of uuid,
  repost_count int,
  impression_count int,
  tap_count int,
  seller_type text,
  store_id uuid,
  expires_at timestamptz,
  availability_type text,
  schedule jsonb,
  is_outpost boolean,
  outpost_scheduled_at timestamptz,
  outpost_confirmed boolean,
  outpost_confirmed_at timestamptz,
  outpost_fee_paid boolean,
  outpost_fee_amount numeric,
  created_at timestamptz,
  distance_miles double precision,
  seller_display_name text,
  seller_avatar_url text,
  seller_rating numeric,
  seller_sales int,
  seller_status text,
  seller_building text,
  seller_seller_type text,
  seller_store_id uuid,
  store_name text,
  store_logo_url text,
  store_rating numeric,
  store_sales int
) language sql stable as $$
  select
    l.id, l.seller_id, l.title, l.price, l.description, l.category, l.photos,
    l.latitude, l.longitude, l.address, l.status, l.is_boosted, l.boosted_radius_miles,
    l.is_promoted, l.repost_of, l.repost_count, l.impression_count, l.tap_count,
    l.seller_type, l.store_id, l.expires_at, l.availability_type, l.schedule,
    l.is_outpost, l.outpost_scheduled_at, l.outpost_confirmed, l.outpost_confirmed_at,
    l.outpost_fee_paid, l.outpost_fee_amount, l.created_at,
    ST_Distance(l.geog, ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography) / 1609.344 as distance_miles,
    p.display_name, p.avatar_url, p.rating, p.sales, p.status, p.building, p.seller_type, p.store_id,
    s.name, s.logo_url, s.rating, s.sales
  from public.listings l
  join public.profiles p on p.id = l.seller_id
  left join public.stores s on s.id = l.store_id
  where l.status = 'active'
    and l.expires_at > now()
    and (l.is_outpost = false or l.outpost_fee_paid = true)
    and l.geog is not null
    and ST_DWithin(l.geog, ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography, p_radius_miles * 1609.344)
    and (p_category is null or p_category = 'all' or lower(l.category) = lower(p_category))
    and (p_exclude_seller_id is null or l.seller_id <> p_exclude_seller_id)
  order by distance_miles asc
  limit 200;
$$;

-- ── About the "potential destructive operation" warning ───────────────
-- Supabase's SQL editor flags anything containing "DROP" or "CREATE OR
-- REPLACE FUNCTION" with a caution dialog, because changing a function's
-- signature technically requires Postgres to drop and recreate it under
-- the hood — the editor can't always tell that apart from a real DROP TABLE.
-- Nothing in this file drops a table or deletes a row. The only DROP is
-- "drop trigger if exists" immediately followed by recreating that same
-- trigger one line later, which is the standard safe pattern for trigger
-- migrations. Read the dialog's listed statements before confirming on any
-- migration, but this one is safe to run.
