-- Discount validity window: optional start/end dates for each discounted price row.
-- The view automatically stops showing the discount once discount_ends passes — no cron job needed.
alter table prices
  add column if not exists discount_starts date,
  add column if not exists discount_ends   date;

-- Rebuild product_prices to respect the date window.
create or replace view product_prices with (security_invoker = true) as
select
  p.id, p.barcode, p.name, p.brand, p.size, p.category,
  p.emoji, p.tint, p.image_url, p.rating,

  -- Effective price: apply discount only while the window is active.
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

  -- Crossed-out regular price — only while discount is active.
  jsonb_object_agg(s.id, pr.price)
    filter (
      where s.id is not null
        and pr.discount_price is not null and pr.discount_price < pr.price
        and (pr.discount_starts is null or pr.discount_starts <= current_date)
        and (pr.discount_ends   is null or pr.discount_ends   >= current_date)
    ) as regular_prices,

  -- End date per store (ISO string) so the app can display "–27.09".
  jsonb_object_agg(s.id, pr.discount_ends::text)
    filter (
      where s.id is not null
        and pr.discount_price is not null
        and pr.discount_ends is not null
        and (pr.discount_starts is null or pr.discount_starts <= current_date)
        and pr.discount_ends >= current_date
    ) as discount_ends,

  -- Start date per store — shown when the promo hasn't begun yet.
  jsonb_object_agg(s.id, pr.discount_starts::text)
    filter (
      where s.id is not null
        and pr.discount_price is not null
        and pr.discount_starts is not null
    ) as discount_starts

from products p
cross join stores s
left join prices pr on pr.product_id = p.id and pr.store_id = s.id
group by p.id;
