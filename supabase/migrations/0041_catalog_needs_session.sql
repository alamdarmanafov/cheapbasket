-- The catalogue is for the app, not for whoever holds the anon key.
--
-- The anon key ships inside the app, so anyone can pull it out and read the
-- REST API directly; until now that meant every product and price in one
-- sweep. From here the catalogue tables answer only a signed-in session:
-- the app opens an anonymous one on first launch (Supabase "Allow anonymous
-- sign-ins" must be ON in Authentication → Sign In / Up before this runs),
-- so a reader notices nothing, while a request has to carry a session that
-- can be counted and blocked.
--
-- Run this only after the build that opens the anonymous session is live:
-- an older build reads the catalogue with the bare key and would go blank.
--
-- Share links on the website read one product through public_product().

revoke select on products, prices, price_history, stores, branches, categories, banners, popups from anon;
revoke select on product_prices, price_drops from anon;
grant select on products, prices, price_history, stores, branches, categories, banners, popups to authenticated;
grant select on product_prices, price_drops to authenticated;

-- One product, its prices and the stores: what a shared link shows. Bounded
-- to one row per call, so it is not a way back to the whole table.
create or replace function public.public_product(p_id text)
returns jsonb language sql security definer set search_path = public stable as $$
  select jsonb_build_object(
    'product', (select to_jsonb(pp) from product_prices pp where pp.id = p_id),
    'stores', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'color', s.color, 'logo_url', s.logo_url) order by s.name), '[]'::jsonb) from stores s)
  );
$$;
revoke all on function public.public_product(text) from public;
grant execute on function public.public_product(text) to anon, authenticated;
