-- Receipts as a price source, price reports, and a Plus bonus for inviting.

-- 1. Receipts. The shopper photographs the till receipt after shopping; the
--    app reads it, they confirm the lines, and the admin approves. Approval
--    writes the prices for that store and pays points — the shopper is the
--    price source for every store we do not scrape.
create table if not exists receipts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  store_id    text references stores(id) on delete set null,
  total       numeric(10,2),
  items       jsonb not null default '[]',    -- [{ product_id, name, price, qty, matched }]
  status      text not null default 'pending', -- pending | approved | rejected
  points      int not null default 0,
  note        text,
  created_at  timestamptz default now(),
  reviewed_at timestamptz
);
create index if not exists receipts_status_idx on receipts (status, created_at desc);
create index if not exists receipts_user_idx on receipts (user_id, created_at desc);
alter table receipts enable row level security;
drop policy if exists "own receipts" on receipts;
create policy "own receipts" on receipts for select using (auth.uid() = user_id);

-- 2. "This price is wrong." One tap on the product page; the admin sees them
--    next to the receipts.
create table if not exists price_reports (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  product_id text not null references products(id) on delete cascade,
  store_id   text references stores(id) on delete cascade,
  reason     text not null,                    -- outdated | wrong | missing
  note       text,
  resolved   boolean not null default false,
  created_at timestamptz default now()
);
create index if not exists price_reports_open_idx on price_reports (resolved, created_at desc);
alter table price_reports enable row level security;
drop policy if exists "own price reports" on price_reports;
create policy "own price reports" on price_reports for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3. Settings, merged into the existing rows.
update app_settings
   set value = value
     || jsonb_build_object('receipt_item', 2, 'receipt_min', 5, 'receipt_max', 40, 'referral_plus_at', 3, 'referral_plus_days', 7),
       updated_at = now()
 where key = 'points' and not (value ? 'receipt_item');
insert into app_settings (key, value) values ('receipts', '{"free_per_day": 3}') on conflict (key) do nothing;

-- 4. Points for an approved receipt: per matched line, within a floor and a
--    ceiling, once per receipt. Service role only.
create or replace function public.award_receipt_points(p_receipt uuid)
returns int language plpgsql security definer set search_path = public as $$
declare r receipts%rowtype; n int; pts int;
begin
  select * into r from receipts where id = p_receipt;
  if r.id is null or r.status <> 'approved' or r.points > 0 then return 0; end if;
  select count(*) into n from jsonb_array_elements(r.items) it where (it->>'product_id') is not null and (it->>'product_id') <> '';
  if n = 0 then return 0; end if;
  pts := least(points_setting('receipt_max', 40), greatest(points_setting('receipt_min', 5), n * points_setting('receipt_item', 2)));
  perform add_points(r.user_id, pts, 'receipt', r.id::text);
  update receipts set points = pts where id = p_receipt;
  return pts;
end $$;
revoke all on function public.award_receipt_points(uuid) from public, anon, authenticated;
grant execute on function public.award_receipt_points(uuid) to service_role;

-- 5. Plus days as a gift, no points debited — the invite bonus.
create or replace function public.grant_plus_days(p_user uuid, p_days int, p_note text)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare base timestamptz; new_exp timestamptz;
begin
  select greatest(now(), coalesce(plan_expires_at, now())) into base from profiles where user_id = p_user and plan = 'plus';
  new_exp := coalesce(base, now()) + make_interval(days => p_days);
  update profiles
     set plan = 'plus', plan_expires_at = new_exp, updated_at = now(),
         plan_source = case when plan = 'plus' and plan_source in ('apple', 'google') and coalesce(plan_expires_at, now()) > now() then plan_source else 'points' end,
         plan_note = case when plan = 'plus' and plan_source in ('apple', 'google') and coalesce(plan_expires_at, now()) > now() then plan_note else p_note end
   where user_id = p_user;
  return new_exp;
end $$;
revoke all on function public.grant_plus_days(uuid, int, text) from public, anon, authenticated;

-- 6. Every Nth friend who joins earns the inviter a week of Plus outright,
--    on top of the points. Counted on the ledger, so it survives any change
--    to what a referral is worth.
create or replace function public.apply_referral(p_code text) returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); owner uuid; pts int := points_setting('referral', 100); mine profiles%rowtype;
        every int := points_setting('referral_plus_at', 3); bonus_days int := points_setting('referral_plus_days', 7); sent int; bonus int := 0;
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
  select count(*) into sent from points_ledger where user_id = owner and reason = 'referral_sent';
  if every > 0 and sent % every = 0 then
    perform grant_plus_days(owner, bonus_days, 'Dəvət bonusu');
    insert into points_ledger (user_id, delta, reason, ref) values (owner, 0, 'referral_bonus', bonus_days::text);
    bonus := bonus_days;
  end if;
  return jsonb_build_object('points', pts, 'owner_bonus_days', bonus);
end $$;
grant execute on function public.apply_referral(text) to authenticated;

-- 7. Receipts count on the board too.
create or replace function public.top_contributors(p_limit int default 10)
returns table (rank int, name text, points int, me boolean)
language sql security definer set search_path = public stable as $$
  with month as (
    select user_id, sum(delta)::int as pts
      from points_ledger
     where delta > 0
       and reason in ('suggestion', 'trip', 'referral_sent', 'receipt')
       and created_at >= date_trunc('month', now())
     group by user_id
  ),
  named as (
    select m.user_id, m.pts,
           coalesce(
             nullif(trim(split_part(coalesce(p.display_name, ''), ' ', 1)) ||
                    case when split_part(coalesce(p.display_name, ''), ' ', 2) <> '' then ' ' || left(split_part(p.display_name, ' ', 2), 1) || '.' else '' end, ''),
             'İstifadəçi'
           ) as name
      from month m
      left join profiles p on p.user_id = m.user_id
  )
  select row_number() over (order by pts desc, user_id)::int as rank, name, pts as points, user_id = auth.uid() as me
    from named
   order by pts desc, user_id
   limit greatest(1, least(coalesce(p_limit, 10), 50));
$$;
