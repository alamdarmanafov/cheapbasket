-- A suggestion without a barcode: the search screen's "can't find it" path.
--
-- The scanner always has a code; a search that comes up empty only has the
-- words the shopper typed. Those are enough for the admin to find the product,
-- so they queue too, under an id made from the name. The barcode stays
-- optional in the same function — same limits, same reward.

create or replace function public.suggest_slug(raw text)
returns text language sql immutable as $$
  select trim(both '-' from regexp_replace(
    translate(lower(coalesce(raw, '')), 'əığşçöüё', 'eigscoue'),
    '[^a-z0-9а-я]+', '-', 'g'));
$$;

create or replace function public.suggest_product(p_barcode text, p_name text, p_store_id text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  code text := gtin_normalize(p_barcode);
  nm text := left(btrim(coalesce(p_name, '')), 120);
  sid text;
  per_day int := points_setting('suggestions_per_day', 30);
  today int;
begin
  if uid is null then raise exception 'Giriş tələb olunur'; end if;
  if code is not null and (length(code) < 8 or length(code) > 14) then raise exception 'Barkod düzgün deyil'; end if;
  if length(nm) < 2 then raise exception 'Məhsulun adını yaz'; end if;

  if code is not null then
    if exists (select 1 from products where gtin_normalize(barcode) = code) then
      return jsonb_build_object('status', 'exists');
    end if;
    if exists (select 1 from pending_products where gtin_normalize(barcode) = code) then
      return jsonb_build_object('status', 'pending');
    end if;
    sid := 'sug-' || code;
  else
    sid := 'sug-' || suggest_slug(nm);
    if length(sid) < 6 then raise exception 'Məhsulun adını yaz'; end if;
    if exists (select 1 from pending_products where id = sid) then
      return jsonb_build_object('status', 'pending');
    end if;
  end if;

  select count(*) into today from suggestion_log where user_id = uid and created_at > now() - interval '24 hours';
  if today >= per_day then raise exception 'Günlük limit: % təklif. Sabah davam et.', per_day; end if;

  insert into pending_products (id, name, brand, barcode, size, category, store_id, source_name, suggested_by, suggested_at)
  values (sid, nm, '', code, '', null, nullif(p_store_id, ''), 'İstifadəçi təklifi', uid, now())
  on conflict (id) do nothing;
  insert into suggestion_log (user_id, barcode) values (uid, coalesce(code, sid));
  return jsonb_build_object('status', 'queued', 'left', per_day - today - 1);
end $$;
revoke all on function public.suggest_product(text, text, text) from public;
grant execute on function public.suggest_product(text, text, text) to authenticated;
