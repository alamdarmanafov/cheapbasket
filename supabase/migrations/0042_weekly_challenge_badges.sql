-- Weekly challenge and badges.
--
-- 1. "Write three prices this week, +10": a bonus paid by trigger on the
--    third priced report of the week (Baku time, Monday start), once per
--    week, three different product/store pairs. Tunables in app_settings
--    'points': weekly_target (3), weekly_bonus (10); 0 disables it.
-- 2. my_challenge(): where the signed-in person stands this week.
-- 3. my_stats(): the counts the app turns into badges. Only the caller's own.

update app_settings
   set value = value || jsonb_build_object('weekly_target', coalesce(value->'weekly_target', '3'::jsonb), 'weekly_bonus', coalesce(value->'weekly_bonus', '10'::jsonb))
 where key = 'points';

-- Monday 00:00 Baku, as a key like 2026-W37 and as the instant it began.
create or replace function public.baku_week_start(ts timestamptz default now()) returns timestamptz language sql immutable as $$
  select (date_trunc('week', (ts at time zone 'Asia/Baku')) at time zone 'Asia/Baku');
$$;
create or replace function public.baku_week_key(ts timestamptz default now()) returns text language sql immutable as $$
  select to_char(ts at time zone 'Asia/Baku', 'IYYY-"W"IW');
$$;

create or replace function public.price_reports_weekly_bonus() returns trigger language plpgsql security definer set search_path = public as $$
declare target int; bonus int; done int; wk text;
begin
  if new.price is null or new.store_id is null or new.user_id is null then return new; end if;
  target := points_setting('weekly_target', 3);
  bonus := points_setting('weekly_bonus', 10);
  if target <= 0 or bonus <= 0 then return new; end if;
  wk := baku_week_key(now());
  if exists (select 1 from points_ledger where user_id = new.user_id and reason = 'weekly_bonus' and ref = wk) then return new; end if;
  select count(distinct (product_id, store_id)) into done
    from price_reports
   where user_id = new.user_id and price is not null and store_id is not null
     and created_at >= baku_week_start(now());
  if done >= target then perform add_points(new.user_id, bonus, 'weekly_bonus', wk); end if;
  return new;
end $$;
drop trigger if exists price_reports_weekly_bonus on price_reports;
create trigger price_reports_weekly_bonus after insert on price_reports for each row execute function public.price_reports_weekly_bonus();

create or replace function public.my_challenge()
returns table (done int, target int, bonus int, claimed boolean, week_ends timestamptz)
language sql security definer set search_path = public stable as $$
  select
    (select count(distinct (product_id, store_id))::int from price_reports
      where user_id = auth.uid() and price is not null and store_id is not null and created_at >= baku_week_start(now())) as done,
    points_setting('weekly_target', 3) as target,
    points_setting('weekly_bonus', 10) as bonus,
    exists (select 1 from points_ledger where user_id = auth.uid() and reason = 'weekly_bonus' and ref = baku_week_key(now())) as claimed,
    baku_week_start(now()) + interval '7 days' as week_ends;
$$;
revoke all on function public.my_challenge() from public, anon;
grant execute on function public.my_challenge() to authenticated;

create or replace function public.my_stats()
returns table (scans int, reports int, reports_applied int, trips int, referrals int, suggestions int, weeks int)
language sql security definer set search_path = public stable as $$
  select
    (select count(*)::int from events where user_id = auth.uid() and kind = 'scan') as scans,
    (select count(*)::int from price_reports where user_id = auth.uid() and price is not null) as reports,
    (select count(*)::int from price_reports where user_id = auth.uid() and outcome = 'applied') as reports_applied,
    (select count(*)::int from trips where user_id = auth.uid()) as trips,
    (select count(*)::int from profiles where referred_by = auth.uid()) as referrals,
    (select count(*)::int from points_ledger where user_id = auth.uid() and reason = 'suggestion') as suggestions,
    (select count(*)::int from points_ledger where user_id = auth.uid() and reason = 'weekly_bonus') as weeks;
$$;
revoke all on function public.my_stats() from public, anon;
grant execute on function public.my_stats() to authenticated;

-- The leaderboard counts the bonus too.
create or replace function public.top_contributors(p_limit int default 10)
returns table (rank int, name text, points int, me boolean)
language sql security definer set search_path = public stable as $$
  with month as (
    select user_id, sum(delta)::int as pts
      from points_ledger
     where delta > 0
       and reason in ('suggestion', 'trip', 'referral_sent', 'receipt', 'price_report', 'weekly_bonus')
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
