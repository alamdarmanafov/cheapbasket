-- Folding one product into another.
--
-- The same milk imported once from each store's feed is three rows with one
-- price each, which the app then cannot compare. The admin's duplicate finder
-- pairs them up; this does the folding, so that nothing that pointed at the
-- dropped row is lost: prices (the newer wins where both stores had one),
-- history, baskets, alerts, saved lists, receipts and reports.
--
-- Service role only. Safe to call again for a pair that no longer exists.
create or replace function public.merge_products(p_keep text, p_drop text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare k products%rowtype; d products%rowtype; moved int := 0;
begin
  if p_keep = p_drop then raise exception 'Eyni məhsul'; end if;
  select * into k from products where id = p_keep;
  select * into d from products where id = p_drop;
  if k.id is null then raise exception 'Saxlanılacaq məhsul tapılmadı: %', p_keep; end if;
  if d.id is null then return jsonb_build_object('merged', false, 'reason', 'drop missing'); end if;

  -- prices: where only the dropped row has the store, move it; where both
  -- have it, keep whichever was updated last.
  delete from prices p using prices q
   where p.product_id = p_drop and q.product_id = p_keep and q.store_id = p.store_id
     and coalesce(q.updated_at, 'epoch') >= coalesce(p.updated_at, 'epoch');
  delete from prices q using prices p
   where q.product_id = p_keep and p.product_id = p_drop and p.store_id = q.store_id;
  update prices set product_id = p_keep where product_id = p_drop;
  get diagnostics moved = row_count;

  update price_history set product_id = p_keep where product_id = p_drop;

  -- baskets: one holding both keeps the larger quantity.
  update basket_items b set qty = greatest(b.qty, o.qty)
    from basket_items o
   where b.product_id = p_keep and o.product_id = p_drop and o.basket_id = b.basket_id;
  delete from basket_items o using basket_items b
   where o.product_id = p_drop and b.product_id = p_keep and b.basket_id = o.basket_id;
  update basket_items set product_id = p_keep where product_id = p_drop;

  delete from price_alerts o using price_alerts b
   where o.product_id = p_drop and b.product_id = p_keep and b.user_id = o.user_id;
  update price_alerts set product_id = p_keep where product_id = p_drop;
  if to_regclass('public.price_alert_log') is not null then
    update price_alert_log set product_id = p_keep where product_id = p_drop;
  end if;

  if to_regclass('public.saved_baskets') is not null then
    update saved_baskets l
       set items = (select coalesce(jsonb_agg(case when it->>'id' = p_drop then jsonb_set(it, '{id}', to_jsonb(p_keep)) else it end), '[]'::jsonb)
                      from jsonb_array_elements(l.items) it)
     where l.items::text like '%"' || p_drop || '"%';
  end if;
  if to_regclass('public.receipts') is not null then
    update receipts r
       set items = (select coalesce(jsonb_agg(case when it->>'product_id' = p_drop then jsonb_set(it, '{product_id}', to_jsonb(p_keep)) else it end), '[]'::jsonb)
                      from jsonb_array_elements(r.items) it)
     where r.items::text like '%"' || p_drop || '"%';
  end if;
  if to_regclass('public.price_reports') is not null then
    update price_reports set product_id = p_keep where product_id = p_drop;
  end if;

  -- What the survivor lacked and the other had.
  update products set
    barcode   = coalesce(barcode, d.barcode),
    image_url = coalesce(image_url, d.image_url),
    category  = coalesce(nullif(category, ''), d.category)
   where id = p_keep;

  delete from products where id = p_drop;
  return jsonb_build_object('merged', true, 'prices_moved', moved);
end $$;
revoke all on function public.merge_products(text, text) from public, anon, authenticated;
grant execute on function public.merge_products(text, text) to service_role;
