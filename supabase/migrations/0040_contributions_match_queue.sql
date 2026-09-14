-- 1. A shopper may read their own suggestions, so the app can show what
--    became of them. Nobody else reads the queue; the service role bypasses.
alter table pending_products enable row level security;
drop policy if exists "own suggestions" on pending_products;
create policy "own suggestions" on pending_products for select using (auth.uid() = suggested_by);

-- 2. Matches the batch finder was not sure about: the admin decides.
--
-- The nightly pass over every store's feed links a product itself when the
-- barcode is identical or the names all but are; the middle band lands here,
-- one row per (store, feed item, our product), with what the feed said, so
-- the admin sees both spellings side by side and answers yes or no.
create table if not exists match_queue (
  id          uuid primary key default gen_random_uuid(),
  store_id    text not null references stores(id) on delete cascade,
  ext_id      text not null,
  product_id  text not null references products(id) on delete cascade,
  feed_name   text not null,
  feed_price  numeric(10,2),
  feed_regular numeric(10,2),
  feed_barcode text,
  score       numeric(4,3) not null,
  status      text not null default 'open',      -- open | accepted | rejected
  created_at  timestamptz default now(),
  decided_at  timestamptz,
  unique (store_id, ext_id, product_id)
);
create index if not exists match_queue_open_idx on match_queue (status, store_id, score desc);
alter table match_queue enable row level security;
-- No policies: service role only.

-- 3. Where the batch pass is: one store per run, round-robin.
insert into app_settings (key, value) values ('autolink', '{"auto_min": 0.85, "queue_min": 0.6, "cursor": null}') on conflict (key) do nothing;
