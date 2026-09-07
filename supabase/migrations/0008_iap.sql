-- In-app purchases: link store subscriptions to profiles and log store events.
alter table profiles add column if not exists plan_source text default 'manual';       -- manual | apple | google | promo
alter table profiles add column if not exists apple_original_transaction_id text;
alter table profiles add column if not exists google_purchase_token text;
alter table profiles add column if not exists plan_product_id text;
create index if not exists profiles_apple_otid_idx on profiles (apple_original_transaction_id);
create index if not exists profiles_google_token_idx on profiles (google_purchase_token);

create table if not exists iap_events (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid,
  platform      text not null,              -- apple | google
  event         text not null,              -- verify | DID_RENEW | EXPIRED | REFUND | ...
  product_id    text,
  transaction_id text,
  expires_at    timestamptz,
  raw           jsonb,
  created_at    timestamptz default now()
);
create index if not exists iap_events_created_idx on iap_events (created_at desc);
alter table iap_events enable row level security;
