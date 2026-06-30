-- ============================================================
-- PROXIE — extend listing expiry from 7 days to 30 days
-- Run in Supabase SQL editor (project: uraixvdffarhezhopngt)
-- ============================================================

-- Change the column default so all new listings expire in 30 days
alter table public.listings
  alter column expires_at set default (now() + interval '30 days');

-- Update the repost_listing() function to use 30 days
create or replace function public.repost_listing(original_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  new_id uuid;
  orig record;
begin
  select * into orig from public.listings where id = original_id;
  if not found then raise exception 'Listing not found'; end if;
  if orig.seller_id <> auth.uid() then raise exception 'Not your listing'; end if;

  update public.listings set status = 'expired', active = false where id = original_id;

  insert into public.listings (
    seller_id, title, price, description, category, photos,
    latitude, longitude, address, seller_type, store_id,
    is_boosted, boosted_radius_miles, is_promoted,
    repost_of, repost_count, expires_at
  ) values (
    orig.seller_id, orig.title, orig.price, orig.description, orig.category, orig.photos,
    orig.latitude, orig.longitude, orig.address, orig.seller_type, orig.store_id,
    orig.is_boosted, orig.boosted_radius_miles, orig.is_promoted,
    original_id, coalesce(orig.repost_count,0) + 1, now() + interval '30 days'
  ) returning id into new_id;
  return new_id;
end;
$$;

-- Extend all currently active listings that were created under the old 7-day window.
-- Sets their expiry to 30 days from when they were originally posted.
update public.listings
set expires_at = created_at + interval '30 days'
where status = 'active'
  and expires_at < created_at + interval '30 days';
