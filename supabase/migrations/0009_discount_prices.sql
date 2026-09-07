-- Regular price + optional discounted price per store.
-- `price` = the store's own (regular) price, `discount_price` = current promo price (null = no discount).
-- The app compares by the effective price (discount if set) and shows the regular price crossed out.
alter table prices add column if not exists discount_price numeric(10,2);

-- History logs the effective price so price_drops / charts reflect discounts.
create or replace function log_price_change() returns trigger language plpgsql as $$
declare
  eff numeric(10,2) := coalesce(new.discount_price, new.price);
  prev numeric(10,2) := case when tg_op = 'UPDATE' then coalesce(old.discount_price, old.price) else null end;
begin
  if eff is not null and (tg_op = 'INSERT' or eff is distinct from prev) then
    insert into price_history (product_id, store_id, price) values (new.product_id, new.store_id, eff);
  end if;
  new.updated_at := now();
  return new;
end $$;

-- product_prices: `prices` becomes the effective price; `regular_prices` lists the crossed-out price where a discount applies.
create or replace view product_prices with (security_invoker = true) as
select p.id, p.barcode, p.name, p.brand, p.size, p.category, p.emoji, p.tint, p.image_url, p.rating,
       jsonb_object_agg(s.id, coalesce(pr.discount_price, pr.price)) filter (where s.id is not null) as prices,
       max(pr.updated_at) as updated_at,
       jsonb_object_agg(s.id, pr.price) filter (where s.id is not null and pr.discount_price is not null and pr.discount_price < pr.price) as regular_prices
from products p
cross join stores s
left join prices pr on pr.product_id = p.id and pr.store_id = s.id
group by p.id;
