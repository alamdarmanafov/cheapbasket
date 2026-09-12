-- Shoppers fill the price gaps.
--
-- A product listed at one store and priced nowhere else is the catalogue's
-- weak spot, and the person standing in front of it at the other store is
-- the cheapest way to fix that. A price report may now carry the price
-- itself: "wrong, it is 2.49" or "add, it is 2.49 here". The admin applies
-- it with one click; two shoppers naming the same price apply it themselves.

-- 1. The price, what became of the report, and the points it earned.
alter table price_reports add column if not exists price   numeric(10,2);
alter table price_reports add column if not exists outcome text;          -- applied | dismissed
alter table price_reports add column if not exists points  int not null default 0;

update app_settings set value = value || jsonb_build_object('price_report', 2, 'price_reports_max_per_day', 10), updated_at = now()
 where key = 'points' and not (value ? 'price_report');

-- 2. The guard grows a reason ("add": the store sells it, we have no price)
--    and checks the price when one is given.
create or replace function public.price_reports_guard() returns trigger language plpgsql security definer set search_path = public as $$
declare per_day int := points_setting('price_reports_per_day', 20); today int;
begin
  select count(*) into today from price_reports where user_id = new.user_id and created_at > now() - interval '24 hours';
  if today >= per_day then raise exception 'Günlük limit: % bildiriş. Sabah davam et.', per_day; end if;
  if new.reason not in ('outdated', 'wrong', 'missing', 'add') then raise exception 'Səbəb düzgün deyil'; end if;
  if new.reason = 'add' and new.price is null then raise exception 'Qiyməti yaz'; end if;
  if new.reason = 'add' and new.store_id is null then raise exception 'Marketi seç'; end if;
  if new.price is not null and (new.price <= 0 or new.price >= 10000) then raise exception 'Qiymət düzgün deyil'; end if;
  if new.reason = 'missing' then new.price := null; end if;
  new.note := left(coalesce(new.note, ''), 300);
  new.resolved := false; new.outcome := null; new.points := 0;
  return new;
end $$;

-- 3. Applying a report: the price goes into the table, the reporter is paid
--    (once, within a daily ceiling), the report closes. Service role and the
--    auto-confirm trigger below.
create or replace function public.apply_price_report(p_report uuid)
returns int language plpgsql security definer set search_path = public as $$
declare r price_reports%rowtype; pts int; today int;
begin
  select * into r from price_reports where id = p_report for update;
  if r.id is null or r.resolved then return 0; end if;
  if r.price is not null and r.store_id is not null then
    insert into prices (product_id, store_id, price, updated_at)
    values (r.product_id, r.store_id, r.price, now())
    on conflict (product_id, store_id) do update set price = excluded.price, updated_at = now();
  end if;
  pts := points_setting('price_report', 2);
  -- Only so many paid reports a day: the eleventh still applies, unpaid.
  select count(*) into today from price_reports
   where user_id = r.user_id and points > 0 and created_at > now() - interval '24 hours';
  if today >= points_setting('price_reports_max_per_day', 10) then pts := 0; end if;
  if pts > 0 then perform add_points(r.user_id, pts, 'price_report', r.id::text); end if;
  update price_reports set resolved = true, outcome = 'applied', points = pts where id = p_report;
  return pts;
end $$;
revoke all on function public.apply_price_report(uuid) from public, anon, authenticated;
grant execute on function public.apply_price_report(uuid) to service_role;

-- 4. Two shoppers, same store, same price, two weeks: that is confirmation
--    enough. Both reports apply without waiting for the admin.
create or replace function public.price_reports_autoconfirm() returns trigger language plpgsql security definer set search_path = public as $$
declare other price_reports%rowtype;
begin
  if new.price is null or new.store_id is null then return new; end if;
  select * into other from price_reports
   where product_id = new.product_id and store_id = new.store_id and user_id <> new.user_id
     and price is not null and abs(price - new.price) < 0.005
     and not resolved and created_at > now() - interval '14 days'
   order by created_at desc limit 1;
  if other.id is not null then
    perform apply_price_report(other.id);
    perform apply_price_report(new.id);
  end if;
  return new;
end $$;
drop trigger if exists price_reports_autoconfirm on price_reports;
create trigger price_reports_autoconfirm after insert on price_reports for each row execute function public.price_reports_autoconfirm();

-- 5. The leaderboard counts it.
create or replace function public.top_contributors(p_limit int default 10)
returns table (rank int, name text, points int, me boolean)
language sql security definer set search_path = public stable as $$
  with month as (
    select user_id, sum(delta)::int as pts
      from points_ledger
     where delta > 0
       and reason in ('suggestion', 'trip', 'referral_sent', 'receipt', 'price_report')
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
