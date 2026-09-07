-- Saved Wolt sources for automatic price sync + log of instant price-drop pushes.
create table if not exists import_sources (
  id          uuid primary key default gen_random_uuid(),
  store_id    text not null references stores(id) on delete cascade,
  url         text not null,
  name        text,
  enabled     boolean not null default true,
  last_run_at timestamptz,
  last_result jsonb,
  created_at  timestamptz default now(),
  unique (store_id, url)
);
alter table import_sources enable row level security;

create table if not exists price_alert_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  product_id text not null,
  store_id   text not null,
  new_price  numeric(10,2),
  sent_at    timestamptz default now()
);
create index if not exists price_alert_log_idx on price_alert_log (user_id, product_id, store_id, sent_at desc);
alter table price_alert_log enable row level security;

insert into app_settings (key, value) values ('alerts', '{"enabled": true, "plus_only": true, "min_percent": 3}') on conflict (key) do nothing;
