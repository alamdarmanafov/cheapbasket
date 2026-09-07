-- Cheap Basket — core schema
create extension if not exists "pgcrypto";

create table if not exists stores (
  id          text primary key,            -- 'araz' | 'bravo' | 'neptun' | 'bazarstore'
  name        text not null,
  color       text not null,
  initial     text not null
);

create table if not exists products (
  id          text primary key,            -- slug, e.g. 'sutas-sud-1l'
  barcode     text unique,
  name        text not null,
  brand       text not null,
  size        text not null,
  category    text not null,
  emoji       text,
  tint        text,
  image_url   text,
  rating      numeric(2,1),
  created_at  timestamptz default now()
);
create index if not exists products_barcode_idx on products (barcode);

-- Current price per product per store (null/absent row = unavailable)
create table if not exists prices (
  product_id  text references products(id) on delete cascade,
  store_id    text references stores(id) on delete cascade,
  price       numeric(10,2),
  updated_at  timestamptz default now(),
  primary key (product_id, store_id)
);

-- Price history (append-only); a trigger copies each price change here
create table if not exists price_history (
  id          uuid primary key default gen_random_uuid(),
  product_id  text references products(id) on delete cascade,
  store_id    text references stores(id) on delete cascade,
  price       numeric(10,2) not null,
  recorded_at timestamptz default now()
);
create index if not exists price_history_idx on price_history (product_id, store_id, recorded_at desc);

create or replace function log_price_change() returns trigger language plpgsql as $$
begin
  if new.price is not null and (tg_op = 'INSERT' or new.price is distinct from old.price) then
    insert into price_history (product_id, store_id, price) values (new.product_id, new.store_id, new.price);
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists prices_log on prices;
create trigger prices_log before insert or update on prices for each row execute function log_price_change();

create table if not exists branches (
  id          text primary key,
  store_id    text references stores(id) on delete cascade,
  name        text not null,
  address     text not null,
  lat         double precision not null,
  lng         double precision not null,
  open_until  text
);

-- Per-user baskets (auth.users); one basket on Free, unlimited on Plus
create table if not exists baskets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  name        text default 'Səbətim',
  created_at  timestamptz default now()
);
create table if not exists basket_items (
  basket_id   uuid references baskets(id) on delete cascade,
  product_id  text references products(id) on delete cascade,
  qty         int not null default 1 check (qty > 0),
  primary key (basket_id, product_id)
);

create table if not exists profiles (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  plan        text not null default 'free' check (plan in ('free','plus')),
  city        text,
  favorite_stores text[] default '{araz,bravo,neptun,bazarstore}'
);

-- Row level security: catalog is public read; baskets/profiles are private
alter table stores enable row level security;
alter table products enable row level security;
alter table prices enable row level security;
alter table price_history enable row level security;
alter table branches enable row level security;
alter table baskets enable row level security;
alter table basket_items enable row level security;
alter table profiles enable row level security;

create policy "public read stores"    on stores        for select using (true);
create policy "public read products"  on products      for select using (true);
create policy "public read prices"    on prices        for select using (true);
create policy "public read history"   on price_history for select using (true);
create policy "public read branches"  on branches      for select using (true);

drop policy if exists "own baskets" on baskets;
create policy "own baskets" on baskets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own basket items" on basket_items;
create policy "own basket items" on basket_items for all
  using (exists (select 1 from baskets b where b.id = basket_id and b.user_id = auth.uid()))
  with check (exists (select 1 from baskets b where b.id = basket_id and b.user_id = auth.uid()));
drop policy if exists "own profile" on profiles;
create policy "own profile" on profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- One view the app reads: product + all store prices + freshness.
-- security_invoker: the view runs with the querying user's RLS, not the creator's.
create or replace view product_prices with (security_invoker = true) as
select p.id, p.barcode, p.name, p.brand, p.size, p.category, p.emoji, p.tint, p.image_url, p.rating,
       jsonb_object_agg(s.id, pr.price) filter (where s.id is not null) as prices,
       max(pr.updated_at) as updated_at
from products p
cross join stores s
left join prices pr on pr.product_id = p.id and pr.store_id = s.id
group by p.id;
