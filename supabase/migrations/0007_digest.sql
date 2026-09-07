-- AI discount digest: price drops, per-user digest log, settings.
alter table profiles add column if not exists digest_enabled boolean not null default true;

-- Latest price per (product, store) vs the previous recorded one → drop amount / percent.
create or replace view price_drops with (security_invoker = true) as
with ranked as (
  select product_id, store_id, price, recorded_at,
         row_number() over (partition by product_id, store_id order by recorded_at desc) as rn
  from price_history
)
select cur.product_id, cur.store_id, cur.price as new_price, prev.price as old_price,
       (prev.price - cur.price) as drop_amount,
       round(((prev.price - cur.price) / nullif(prev.price, 0)) * 100, 1) as drop_percent,
       cur.recorded_at as changed_at,
       p.name, p.brand, p.size, p.emoji, s.name as store_name
from ranked cur
join ranked prev on prev.product_id = cur.product_id and prev.store_id = cur.store_id and prev.rn = 2
join products p on p.id = cur.product_id
join stores s on s.id = cur.store_id
where cur.rn = 1 and cur.price < prev.price;

create table if not exists digest_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  kind        text not null default 'digest',
  title       text,
  body        text,
  sent_at     timestamptz default now()
);
create index if not exists digest_log_user_idx on digest_log (user_id, sent_at desc);
alter table digest_log enable row level security;
drop policy if exists "own digest log" on digest_log;
create policy "own digest log" on digest_log for select using (auth.uid() = user_id);

-- Key/value settings edited from the admin panel (public read: the app shows the schedule).
create table if not exists app_settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz default now()
);
alter table app_settings enable row level security;
drop policy if exists "public read settings" on app_settings;
create policy "public read settings" on app_settings for select using (true);
insert into app_settings (key, value) values
  ('digest', '{"enabled": true, "free_days": [1, 11, 21], "hour_baku": 9, "max_items": 5, "lookback_free_days": 10}')
on conflict (key) do nothing;
