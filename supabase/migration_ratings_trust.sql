-- ============================================================
-- PROXIE — ratings table + trust signal columns
-- Run in Supabase SQL editor (project: uraixvdffarhezhopngt)
-- ============================================================

-- ratings table — one row per (listing, rater) pair
create table if not exists public.ratings (
  id          uuid primary key default uuid_generate_v4(),
  listing_id  uuid references public.listings(id) on delete set null,
  rater_id    uuid not null references public.profiles(id) on delete cascade,
  rated_id    uuid not null references public.profiles(id) on delete cascade,
  vote        text not null check (vote in ('up','down')),
  note        text default '',
  role        text not null check (role in ('seller','buyer')),
  created_at  timestamptz default now(),
  unique(listing_id, rater_id)
);
alter table public.ratings enable row level security;
create policy "ratings: public read"
  on public.ratings for select using (true);
create policy "ratings: own insert"
  on public.ratings for insert with check (auth.uid() = rater_id);

-- Trust signal columns on profiles
alter table public.profiles
  add column if not exists ratings_count    int default 0,
  add column if not exists phone_verified   boolean default false,
  add column if not exists avg_response_hours numeric(6,1);

-- Response tracking on conversations
alter table public.conversations
  add column if not exists first_seller_reply_at timestamptz;

-- Recompute a profile's rating + ratings_count from the ratings table.
-- Called after each new rating is submitted.
create or replace function public.refresh_profile_rating(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  r_count int;
  r_up    int;
begin
  select count(*), count(*) filter (where vote = 'up')
  into r_count, r_up
  from public.ratings
  where rated_id = p_user_id;

  update public.profiles set
    ratings_count = r_count,
    -- Maps 0–100% positive votes → 1.0–5.0 stars
    rating = case
      when r_count = 0 then 5.0
      else round((r_up::numeric / r_count * 4 + 1), 1)
    end
  where id = p_user_id;
end;
$$;
