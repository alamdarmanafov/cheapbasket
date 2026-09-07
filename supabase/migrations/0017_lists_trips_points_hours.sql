-- Saved shopping lists, recorded trips (savings history), points + referrals, branch opening hours.

-- 1. Saved lists (Free: 1, Plus: unlimited — enforced in the app)
create table if not exists saved_baskets (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  items      jsonb not null default '[]',   -- [{ "id": product_id, "qty": n }]
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table saved_baskets enable row level security;
drop policy if exists "own saved baskets" on saved_baskets;
create policy "own saved baskets" on saved_baskets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 2. Trips: recorded when the user taps "Marşruta bax" (savings statistics)
create table if not exists trips (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  store_id   text,
  branch_id  text,
  total      numeric(10,2) not null default 0,
  saving     numeric(10,2) not null default 0,
  items      int not null default 0,
  created_at timestamptz default now()
);
create index if not exists trips_user_idx on trips (user_id, created_at desc);
alter table trips enable row level security;
drop policy if exists "own trips" on trips;
create policy "own trips" on trips for select using (auth.uid() = user_id);

-- 3. Points + referrals
alter table profiles add column if not exists points int not null default 0;
alter table profiles add column if not exists referral_code text unique;
alter table profiles add column if not exists referred_by uuid;
create table if not exists points_ledger (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  delta      int not null,
  reason     text not null,     -- referral_sent | referral_received | trip | plus_redeem
  ref        text,
  created_at timestamptz default now()
);
create index if not exists points_ledger_idx on points_ledger (user_id, created_at desc);
alter table points_ledger enable row level security;
drop policy if exists "own points" on points_ledger;
create policy "own points" on points_ledger for select using (auth.uid() = user_id);
insert into app_settings (key, value) values ('points', '{"referral": 100, "trip": 10, "plus_cost": 300, "plus_days": 7, "trip_cooldown_hours": 6}') on conflict (key) do nothing;

create or replace function public.points_setting(k text, d int) returns int language sql stable as $$
  select coalesce((select (value->>k)::int from app_settings where key = 'points'), d);
$$;

create or replace function public.add_points(uid uuid, d int, why text, r text) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (user_id, points) values (uid, greatest(0, d)) on conflict (user_id) do update set points = greatest(0, profiles.points + d), updated_at = now();
  insert into points_ledger (user_id, delta, reason, ref) values (uid, d, why, r);
end $$;
revoke all on function public.add_points(uuid, int, text, text) from public;

/** My referral code (created on first call). */
create or replace function public.my_referral_code() returns text language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); c text;
begin
  if uid is null then raise exception 'Giriş tələb olunur'; end if;
  select referral_code into c from profiles where user_id = uid;
  if c is null then
    loop
      c := upper(substr(translate(encode(gen_random_bytes(6), 'base64'), '+/=0O1Il', 'ABCDEFGH'), 1, 6));
      exit when not exists (select 1 from profiles where referral_code = c);
    end loop;
    insert into profiles (user_id, referral_code) values (uid, c) on conflict (user_id) do update set referral_code = c;
  end if;
  return c;
end $$;
grant execute on function public.my_referral_code() to authenticated;

/** Enter a friend's code once: both sides get points. */
create or replace function public.apply_referral(p_code text) returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); owner uuid; pts int := points_setting('referral', 100); mine profiles%rowtype;
begin
  if uid is null then raise exception 'Giriş tələb olunur'; end if;
  select * into mine from profiles where user_id = uid;
  if mine.referred_by is not null then raise exception 'Dəvət kodu artıq istifadə olunub'; end if;
  select user_id into owner from profiles where referral_code = upper(trim(p_code));
  if owner is null then raise exception 'Kod tapılmadı'; end if;
  if owner = uid then raise exception 'Öz kodunu istifadə edə bilməzsən'; end if;
  insert into profiles (user_id, referred_by) values (uid, owner) on conflict (user_id) do update set referred_by = owner, updated_at = now();
  perform add_points(uid, pts, 'referral_received', upper(trim(p_code)));
  perform add_points(owner, pts, 'referral_sent', uid::text);
  return jsonb_build_object('points', pts);
end $$;
grant execute on function public.apply_referral(text) to authenticated;

/** Record a shopping trip; points once per cooldown window. */
create or replace function public.record_trip(p_store_id text, p_branch_id text, p_total numeric, p_saving numeric, p_items int) returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); pts int := points_setting('trip', 10); cool int := points_setting('trip_cooldown_hours', 6); earned int := 0;
begin
  if uid is null then raise exception 'Giriş tələb olunur'; end if;
  insert into trips (user_id, store_id, branch_id, total, saving, items) values (uid, p_store_id, p_branch_id, coalesce(p_total, 0), coalesce(p_saving, 0), coalesce(p_items, 0));
  if not exists (select 1 from points_ledger where user_id = uid and reason = 'trip' and created_at > now() - make_interval(hours => cool)) then
    perform add_points(uid, pts, 'trip', p_store_id);
    earned := pts;
  end if;
  return jsonb_build_object('points_earned', earned);
end $$;
grant execute on function public.record_trip(text, text, numeric, numeric, int) to authenticated;

/** Convert points into Plus days. */
create or replace function public.redeem_points_for_plus() returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); cost int := points_setting('plus_cost', 300); days int := points_setting('plus_days', 7); have int; base timestamptz; new_exp timestamptz;
begin
  if uid is null then raise exception 'Giriş tələb olunur'; end if;
  select points into have from profiles where user_id = uid;
  if coalesce(have, 0) < cost then raise exception 'Kifayət qədər xal yoxdur (% lazımdır)', cost; end if;
  select greatest(now(), coalesce(plan_expires_at, now())) into base from profiles where user_id = uid and plan = 'plus';
  new_exp := coalesce(base, now()) + make_interval(days => days);
  update profiles set plan = 'plus', plan_expires_at = new_exp, plan_source = 'points', plan_note = 'Xal ilə', updated_at = now() where user_id = uid;
  perform add_points(uid, -cost, 'plus_redeem', days::text);
  return jsonb_build_object('days', days, 'expires_at', new_exp);
end $$;
grant execute on function public.redeem_points_for_plus() to authenticated;

-- 4. Opening hours
alter table branches add column if not exists open_from text;          -- '08:00'
alter table branches add column if not exists always_open boolean not null default false;
