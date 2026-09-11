-- One barcode, one spelling — in the database as well as in the code.
--
-- A GS1 barcode (GTIN) is the same number at 8, 12, 13 or 14 digits: the
-- shorter forms are the longer ones with the leading zeros taken off. Wolt
-- Market's feed carries the 14-digit form ("0" + EAN-13), the phone reads the
-- 13 off the packet, and a plain compare called them different products. The
-- rule here is the one the app and the admin panel now share: right-align,
-- drop the zeros, keep the shortest standard length — but only when the check
-- digit says it really is a GTIN. A shop's own internal code keeps its zeros.

create or replace function public.gtin_normalize(raw text)
returns text language plpgsql immutable as $$
declare
  d text := regexp_replace(coalesce(raw, ''), '\D', '', 'g');
  stripped text;
  len int;
  canon text;
  sum int := 0;
  w int := 3;
  i int;
begin
  if d = '' then return null; end if;
  stripped := ltrim(d, '0');
  -- Shorter than an EAN-8 was never printed as a barcode; a check digit passes
  -- one number in ten by chance, so short internal codes stay out of it.
  if length(d) < 8 or stripped = '' or length(stripped) > 14 then return d; end if;
  len := case when length(stripped) <= 8 then 8 when length(stripped) <= 12 then 12 when length(stripped) = 13 then 13 else 14 end;
  canon := lpad(stripped, len, '0');
  -- Weights 3,1,3,1… from the right, excluding the check digit itself.
  for i in reverse (length(canon) - 1)..1 loop
    sum := sum + substr(canon, i, 1)::int * w;
    w := 4 - w;
  end loop;
  if (10 - (sum % 10)) % 10 = substr(canon, length(canon), 1)::int then return canon; end if;
  return d;
end $$;

-- Existing rows. Barcodes are unique, so of every set of rows that spell the
-- same code differently exactly one may take the canonical form: the one that
-- already has it, or failing that the first by id. The others keep their old
-- spelling — they are duplicates for the admin's duplicate finder, not
-- something a migration should merge blind. (Rewriting all of them, guarded
-- only against a canonical row that already exists, tripped the constraint
-- the moment two zero-padded spellings of one code met, and rolled the whole
-- file back.)
with candidates as (
  select p.id, gtin_normalize(p.barcode) as canon,
         row_number() over (partition by gtin_normalize(p.barcode) order by p.id) as rn
    from products p
   where p.barcode is not null
     and gtin_normalize(p.barcode) is distinct from p.barcode
)
update products p
   set barcode = c.canon
  from candidates c
 where c.id = p.id
   and c.rn = 1
   and not exists (select 1 from products q where q.barcode = c.canon and q.id <> p.id);

update pending_products p
   set barcode = gtin_normalize(p.barcode)
 where p.barcode is not null
   and gtin_normalize(p.barcode) is distinct from p.barcode;

-- A suggestion arrives in whatever form the scanner read; stored canonical, and
-- matched against the catalogue in every spelling.
create or replace function public.suggest_product(p_barcode text, p_name text, p_store_id text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  code text := gtin_normalize(p_barcode);
  nm text := left(btrim(coalesce(p_name, '')), 120);
  per_day int := points_setting('suggestions_per_day', 30);
  today int;
begin
  if uid is null then raise exception 'Giriş tələb olunur'; end if;
  if code is null or length(code) < 8 or length(code) > 14 then raise exception 'Barkod düzgün deyil'; end if;
  if length(nm) < 2 then raise exception 'Məhsulun adını yaz'; end if;

  if exists (select 1 from products where gtin_normalize(barcode) = code) then
    return jsonb_build_object('status', 'exists');
  end if;
  if exists (select 1 from pending_products where gtin_normalize(barcode) = code) then
    return jsonb_build_object('status', 'pending');
  end if;

  select count(*) into today from suggestion_log where user_id = uid and created_at > now() - interval '24 hours';
  if today >= per_day then raise exception 'Günlük limit: % təklif. Sabah davam et.', per_day; end if;

  insert into pending_products (id, name, brand, barcode, size, category, store_id, source_name, suggested_by, suggested_at)
  values ('sug-' || code, nm, '', code, '', null, nullif(p_store_id, ''), 'İstifadəçi təklifi', uid, now())
  on conflict (id) do nothing;
  insert into suggestion_log (user_id, barcode) values (uid, code);
  return jsonb_build_object('status', 'queued', 'left', per_day - today - 1);
end $$;
revoke all on function public.suggest_product(text, text, text) from public;
grant execute on function public.suggest_product(text, text, text) to authenticated;
