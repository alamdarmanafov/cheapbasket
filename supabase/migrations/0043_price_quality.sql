-- Price quality: where a price came from, who confirmed it, and a guard
-- against the one wrong number that breaks a comparison. Plus the two
-- inboxes that feed the admin queue: shoppers asking for a price, and a
-- store handing over its own list.
--
-- 1. prices.source / prices.confirmations, kept by triggers.
-- 2. price_quarantine: a price far off its history is parked, not written.
-- 3. price_requests: "what does this cost at Bravo?" — pushed to shoppers of
--    that store; their answers arrive as price_reports as before.
-- 4. partner_uploads: a store's list, uploaded with its own link, waits here.

-- ---------------------------------------------------------------- 1. source
alter table prices add column if not exists source text;             -- feed | csv | user | partner | admin | receipt
alter table prices add column if not exists confirmations int not null default 0;
alter table price_history add column if not exists source text;

-- A price change resets its confirmations; the history keeps the source.
create or replace function log_price_change() returns trigger language plpgsql as $$
begin
  if new.price is not null and (tg_op = 'INSERT' or new.price is distinct from old.price) then
    insert into price_history (product_id, store_id, price, source) values (new.product_id, new.store_id, new.price, new.source);
    if tg_op = 'UPDATE' then new.confirmations := 0; end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

-- A report naming the price that is already on file confirms it.
create or replace function public.price_reports_confirm() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.price is null or new.store_id is null then return new; end if;
  update prices set confirmations = confirmations + 1, updated_at = now()
   where product_id = new.product_id and store_id = new.store_id
     and price is not null and abs(price - new.price) < 0.005
     and not exists (
       select 1 from price_reports r
        where r.product_id = new.product_id and r.store_id = new.store_id and r.user_id = new.user_id
          and r.id <> new.id and abs(coalesce(r.price, -1) - new.price) < 0.005 and r.created_at > now() - interval '30 days');
  return new;
end $$;
drop trigger if exists price_reports_confirm on price_reports;
create trigger price_reports_confirm after insert on price_reports for each row execute function public.price_reports_confirm();
create index if not exists price_reports_product_idx on price_reports (product_id, store_id, created_at desc);

-- apply_price_report writes a user price and stamps it so. The admin's
-- click has seen the number and goes through (p_force); the auto-confirm
-- trigger has not, so its write still meets the anomaly guard below.
drop function if exists public.apply_price_report(uuid);
create or replace function public.apply_price_report(p_report uuid, p_force boolean default true)
returns int language plpgsql security definer set search_path = public as $$
declare r price_reports%rowtype; pts int; today int;
begin
  select * into r from price_reports where id = p_report for update;
  if r.id is null or r.resolved then return 0; end if;
  if r.price is not null and r.store_id is not null then
    if p_force then perform set_config('app.force_price', '1', true); end if;
    insert into prices (product_id, store_id, price, source, updated_at)
    values (r.product_id, r.store_id, r.price, 'user', now())
    on conflict (product_id, store_id) do update set price = excluded.price, source = 'user', updated_at = now();
    perform set_config('app.force_price', '', true);
  end if;
  pts := points_setting('price_report', 2);
  select count(*) into today from price_reports
   where user_id = r.user_id and points > 0 and created_at > now() - interval '24 hours';
  if today >= points_setting('price_reports_max_per_day', 10) then pts := 0; end if;
  if pts > 0 then perform add_points(r.user_id, pts, 'price_report', r.id::text); end if;
  update price_reports set resolved = true, outcome = 'applied', points = pts where id = p_report;
  return pts;
end $$;
revoke all on function public.apply_price_report(uuid, boolean) from public, anon, authenticated;
grant execute on function public.apply_price_report(uuid, boolean) to service_role;

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
    perform apply_price_report(other.id, false);
    perform apply_price_report(new.id, false);
  end if;
  return new;
end $$;

-- The app reads source and confirmations per store off the view.
create or replace view product_prices with (security_invoker = true) as
select
  p.id, p.barcode, p.name, p.brand, p.size, p.category,
  p.emoji, p.tint, p.image_url, p.rating,
  jsonb_object_agg(s.id,
    case
      when pr.discount_price is not null
       and pr.discount_price < pr.price
       and (pr.discount_starts is null or pr.discount_starts <= current_date)
       and (pr.discount_ends   is null or pr.discount_ends   >= current_date)
      then pr.discount_price
      else pr.price
    end
  ) filter (where s.id is not null and pr.price is not null) as prices,
  max(pr.updated_at) as updated_at,
  jsonb_object_agg(s.id, pr.price)
    filter (
      where s.id is not null
        and pr.discount_price is not null and pr.discount_price < pr.price
        and (pr.discount_starts is null or pr.discount_starts <= current_date)
        and (pr.discount_ends   is null or pr.discount_ends   >= current_date)
    ) as regular_prices,
  jsonb_object_agg(s.id, pr.discount_ends::text)
    filter (
      where s.id is not null
        and pr.discount_price is not null
        and pr.discount_ends is not null
        and (pr.discount_starts is null or pr.discount_starts <= current_date)
        and pr.discount_ends >= current_date
    ) as discount_ends,
  jsonb_object_agg(s.id, pr.discount_starts::text)
    filter (
      where s.id is not null
        and pr.discount_price is not null
        and pr.discount_starts is not null
    ) as discount_starts,
  jsonb_object_agg(s.id, pr.source) filter (where s.id is not null and pr.source is not null) as sources,
  jsonb_object_agg(s.id, pr.confirmations) filter (where s.id is not null and pr.confirmations > 0) as confirmations,
  jsonb_object_agg(s.id, pr.updated_at) filter (where s.id is not null and pr.price is not null) as updated_by_store
from products p
cross join stores s
left join prices pr on pr.product_id = p.id and pr.store_id = s.id
group by p.id;
grant select on product_prices to authenticated;

-- ------------------------------------------------------------ 2. quarantine
create table if not exists price_quarantine (
  id             uuid primary key default gen_random_uuid(),
  product_id     text not null references products(id) on delete cascade,
  store_id       text not null references stores(id) on delete cascade,
  old_price      numeric(10,2),
  new_price      numeric(10,2) not null,
  discount_price numeric(10,2),
  reference      numeric(10,2) not null,       -- what the history said it should be near
  source         text,
  status         text not null default 'open', -- open | accepted | rejected
  created_at     timestamptz default now(),
  decided_at     timestamptz
);
create unique index if not exists price_quarantine_open_idx on price_quarantine (product_id, store_id) where status = 'open';
create index if not exists price_quarantine_status_idx on price_quarantine (status, created_at desc);
alter table price_quarantine enable row level security;

insert into app_settings (key, value) values ('quality', '{"anomaly_pct": 50, "history_days": 90}') on conflict (key) do nothing;

/*
 * A price more than anomaly_pct off the median of its last history_days of
 * history (two readings at least; the price on file when there is none) is
 * not written: it waits in price_quarantine for a look. Every writer goes
 * through this — feeds, CSV, reports, receipts, the admin's own edit — and
 * the admin releases a row with apply_quarantine(), which sets app.force_price
 * for the one write it makes.
 */
create or replace function public.price_anomaly_guard() returns trigger language plpgsql security definer set search_path = public as $$
declare ref numeric; n int; pct int; days int; cur numeric;
begin
  if new.price is null then return new; end if;
  if coalesce(current_setting('app.force_price', true), '') = '1' then return new; end if;
  -- An upsert arrives as INSERT before the conflict is seen: read the row on file.
  if tg_op = 'UPDATE' then cur := old.price;
  else select price into cur from prices where product_id = new.product_id and store_id = new.store_id; end if;
  if cur is not null and new.price = cur then return new; end if;
  pct := coalesce((select (value->>'anomaly_pct')::int from app_settings where key = 'quality'), 50);
  days := coalesce((select (value->>'history_days')::int from app_settings where key = 'quality'), 90);
  if pct <= 0 then return new; end if;
  select percentile_cont(0.5) within group (order by price), count(*) into ref, n
    from price_history
   where product_id = new.product_id and store_id = new.store_id and recorded_at > now() - (days || ' days')::interval;
  if n < 2 then
    if cur is not null then ref := cur; else return new; end if;
  end if;
  if ref is null or ref <= 0 then return new; end if;
  if new.price > ref * (1 + pct / 100.0) or new.price < ref * (1 - pct / 100.0) then
    insert into price_quarantine (product_id, store_id, old_price, new_price, discount_price, reference, source)
    values (new.product_id, new.store_id, cur, new.price, new.discount_price, round(ref, 2), new.source)
    on conflict (product_id, store_id) where status = 'open'
    do update set new_price = excluded.new_price, discount_price = excluded.discount_price, source = excluded.source, created_at = now();
    return null;  -- skips the write; the admin decides
  end if;
  return new;
end $$;
drop trigger if exists price_anomaly_guard on prices;
create trigger price_anomaly_guard before insert or update on prices for each row execute function public.price_anomaly_guard();

create or replace function public.apply_quarantine(p_id uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare q price_quarantine%rowtype;
begin
  select * into q from price_quarantine where id = p_id and status = 'open' for update;
  if q.id is null then return; end if;
  if p_accept then
    perform set_config('app.force_price', '1', true);
    insert into prices (product_id, store_id, price, discount_price, source, updated_at)
    values (q.product_id, q.store_id, q.new_price, q.discount_price, coalesce(q.source, 'admin'), now())
    on conflict (product_id, store_id) do update set price = excluded.price, discount_price = excluded.discount_price, source = excluded.source, updated_at = now();
    perform set_config('app.force_price', '', true);
  end if;
  update price_quarantine set status = case when p_accept then 'accepted' else 'rejected' end, decided_at = now() where id = p_id;
end $$;
revoke all on function public.apply_quarantine(uuid, boolean) from public, anon, authenticated;
grant execute on function public.apply_quarantine(uuid, boolean) to service_role;

-- --------------------------------------------------------- 3. price requests
create table if not exists price_requests (
  id          uuid primary key default gen_random_uuid(),
  product_id  text not null references products(id) on delete cascade,
  store_id    text not null references stores(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  status      text not null default 'open',   -- open | answered
  created_at  timestamptz default now(),
  notified_at timestamptz,
  notified    int not null default 0,
  answered_at timestamptz
);
create unique index if not exists price_requests_one_open_idx on price_requests (product_id, store_id, user_id) where status = 'open';
create index if not exists price_requests_open_idx on price_requests (status, notified_at, created_at);
alter table price_requests enable row level security;
drop policy if exists "own price requests" on price_requests;
create policy "own price requests" on price_requests for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- A priced report for that product and store answers every open request for it.
create or replace function public.price_requests_answer() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.price is null or new.store_id is null then return new; end if;
  update price_requests set status = 'answered', answered_at = now()
   where product_id = new.product_id and store_id = new.store_id and status = 'open' and user_id <> new.user_id;
  return new;
end $$;
drop trigger if exists price_requests_answer on price_reports;
create trigger price_requests_answer after insert on price_reports for each row execute function public.price_requests_answer();

-- A request asked from the product page opens the price sheet on the store.
insert into app_settings (key, value) values ('requests', '{"max_per_user_per_day": 5, "push_per_request": 30, "push_per_user_per_run": 3}') on conflict (key) do nothing;

-- ---------------------------------------------------------- 4. partner uploads
alter table stores add column if not exists partner_token text unique;
create table if not exists partner_uploads (
  id          uuid primary key default gen_random_uuid(),
  store_id    text not null references stores(id) on delete cascade,
  filename    text,
  note        text,
  rows        jsonb not null,                 -- [{barcode, name, size, price}]
  row_count   int not null default 0,
  status      text not null default 'pending', -- pending | applied | rejected
  applied     int not null default 0,
  created_at  timestamptz default now(),
  decided_at  timestamptz
);
create index if not exists partner_uploads_status_idx on partner_uploads (status, created_at desc);
alter table partner_uploads enable row level security;

-- ------------------------------------------------- 5. website product index
-- The site lists product names for search engines: id, name, brand, size,
-- category — no prices, no barcodes. Prices stay behind public_product(),
-- one product per call, as before.
create or replace function public.public_product_index()
returns table (id text, name text, brand text, size text, category text)
language sql security definer set search_path = public stable as $$
  select p.id, p.name, p.brand, p.size, p.category
    from products p
   where exists (select 1 from prices pr where pr.product_id = p.id and pr.price is not null)
   order by p.category, p.brand, p.name;
$$;
revoke all on function public.public_product_index() from public;
grant execute on function public.public_product_index() to anon, authenticated;
