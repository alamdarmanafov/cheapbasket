-- One-off: merge products that exist twice, once as "0" + EAN-13 and once as
-- the EAN-13. Migration 0029 could give the canonical spelling to only one of
-- each pair; this folds the other into it and deletes it.
--
-- Safe to run more than once: a pair that is already merged is simply not
-- found. Run in the Supabase SQL editor after 0029.
--
-- For every pair: `keep` is the row that already carries the canonical
-- barcode; `drop` is the other. Everything that pointed at `drop` is pointed
-- at `keep`, and where both had a row for the same key the newer price wins.

create temp table dup_pairs as
select keep.id as keep_id, drop_.id as drop_id, keep.barcode as canon
  from products keep
  join products drop_
    on drop_.id <> keep.id
   and gtin_normalize(drop_.barcode) = keep.barcode
   and drop_.barcode <> keep.barcode
 where keep.barcode = gtin_normalize(keep.barcode);

-- Show what will happen before it happens.
select keep_id, drop_id from dup_pairs order by keep_id;

-- prices (pk product_id, store_id): where only `drop` has the store, move it;
-- where both have it, keep whichever was updated last.
delete from prices p
 using dup_pairs d, prices k
 where p.product_id = d.drop_id and k.product_id = d.keep_id and k.store_id = p.store_id
   and coalesce(k.updated_at, 'epoch') >= coalesce(p.updated_at, 'epoch');
delete from prices k
 using dup_pairs d, prices p
 where k.product_id = d.keep_id and p.product_id = d.drop_id and p.store_id = k.store_id;
update prices p set product_id = d.keep_id from dup_pairs d where p.product_id = d.drop_id;

-- history: append, nothing to collide with.
update price_history h set product_id = d.keep_id from dup_pairs d where h.product_id = d.drop_id;

-- baskets (pk basket_id, product_id): a basket holding both keeps the larger qty.
update basket_items b set qty = greatest(b.qty, o.qty)
  from dup_pairs d, basket_items o
 where b.product_id = d.keep_id and o.product_id = d.drop_id and o.basket_id = b.basket_id;
delete from basket_items o using dup_pairs d, basket_items b
 where o.product_id = d.drop_id and b.product_id = d.keep_id and b.basket_id = o.basket_id;
update basket_items b set product_id = d.keep_id from dup_pairs d where b.product_id = d.drop_id;

-- alerts (pk user_id, product_id) and their log.
delete from price_alerts o using dup_pairs d, price_alerts k
 where o.product_id = d.drop_id and k.product_id = d.keep_id and k.user_id = o.user_id;
update price_alerts a set product_id = d.keep_id from dup_pairs d where a.product_id = d.drop_id;
update price_alert_log l set product_id = d.keep_id from dup_pairs d where l.product_id = d.drop_id;

-- saved lists carry product ids inside a jsonb array.
update lists l
   set items = (
     select coalesce(jsonb_agg(case when it->>'id' = d.drop_id then jsonb_set(it, '{id}', to_jsonb(d.keep_id)) else it end), '[]'::jsonb)
       from jsonb_array_elements(l.items) it
   )
  from dup_pairs d
 where l.items::text like '%"' || d.drop_id || '"%';

-- Only now is the other row unreferenced.
delete from products p using dup_pairs d where p.id = d.drop_id;

select count(*) as merged from dup_pairs;
drop table dup_pairs;
