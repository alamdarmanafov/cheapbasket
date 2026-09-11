-- Product suggestions from the scanner, points for approved ones, and points
-- that turn into Plus on their own.
--
-- The scanner's "not found" was a dead end: the user held a product we did not
-- list and had no way to tell us. Now they can queue it; the admin reviews it in
-- the pending page and, once it becomes a product, the suggester earns points.
-- Points convert into Plus days by tier, automatically, so the reward is felt in
-- the profile rather than sitting as a number.

-- 1. Who suggested a pending product (null for scraped / imported rows).
alter table pending_products add column if not exists suggested_by uuid references auth.users(id) on delete set null;
alter table pending_products add column if not exists suggested_at timestamptz;
create index if not exists pending_products_suggested_idx on pending_products (suggested_by) where suggested_by is not null;

-- 2. Settings: what a suggestion is worth, and the redemption tiers.
--    Merged into the existing 'points' row so the older keys keep working.
update app_settings
   set value = value
     || jsonb_build_object('suggestion', 10)
     || jsonb_build_object('plus_tiers', '[{"points":100,"days":7},{"points":200,"days":30},{"points":350,"days":90}]'::jsonb),
       updated_at = now()
 where key = 'points'
   and not (value ? 'plus_tiers');
insert into app_settings (key, value)
values ('points', '{"referral": 100, "trip": 10, "plus_cost": 300, "plus_days": 7, "trip_cooldown_hours": 6, "suggestion": 10, "plus_tiers": [{"points":100,"days":7},{"points":200,"days":30},{"points":350,"days":90}]}')
on conflict (key) do nothing;

-- 3. The user queues a barcode from the scanner.
--    Security definer so it works whatever RLS the (hand-created) pending table
--    has; the checks are the function's own.
create or replace function public.suggest_product(p_barcode text, p_name text, p_store_id text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  code text := regexp_replace(coalesce(p_barcode, ''), '\D', '', 'g');
  nm text := left(btrim(coalesce(p_name, '')), 120);
  open_count int;
begin
  if uid is null then raise exception 'Giriş tələb olunur'; end if;
  if length(code) < 8 or length(code) > 14 then raise exception 'Barkod düzgün deyil'; end if;
  if length(nm) < 2 then raise exception 'Məhsulun adını yaz'; end if;

  -- Already sold: nothing to suggest. (The app checks too, but the catalogue
  -- on the phone can be a few minutes behind.)
  if exists (select 1 from products where barcode = code) then
    return jsonb_build_object('status', 'exists');
  end if;
  if exists (select 1 from pending_products where barcode = code) then
    return jsonb_build_object('status', 'pending');
  end if;

  -- Points make a queue worth flooding. Thirty open suggestions is more than
  -- anyone fills in one shop visit; past that the admin clears the backlog first.
  select count(*) into open_count from pending_products where suggested_by = uid;
  if open_count >= 30 then raise exception 'Gözləyən təkliflərin çoxdur — admin yoxlayandan sonra davam et'; end if;

  insert into pending_products (id, name, brand, barcode, size, category, store_id, source_name, suggested_by, suggested_at)
  values ('sug-' || code, nm, '', code, '', null, nullif(p_store_id, ''), 'İstifadəçi təklifi', uid, now())
  on conflict (id) do nothing;
  return jsonb_build_object('status', 'queued');
end $$;
revoke all on function public.suggest_product(text, text, text) from public;
grant execute on function public.suggest_product(text, text, text) to authenticated;

-- 4. Points for an approved suggestion. Called by the admin API (service role)
--    once the pending row has become a product; once per barcode per user, so
--    re-approving or a retried request cannot pay twice.
create or replace function public.award_suggestion_points(p_user uuid, p_barcode text)
returns int language plpgsql security definer set search_path = public as $$
declare pts int := points_setting('suggestion', 10);
begin
  if p_user is null or coalesce(p_barcode, '') = '' then return 0; end if;
  if exists (select 1 from points_ledger where user_id = p_user and reason = 'suggestion' and ref = p_barcode) then return 0; end if;
  perform add_points(p_user, pts, 'suggestion', p_barcode);
  return pts;
end $$;
revoke all on function public.award_suggestion_points(uuid, text) from public, anon, authenticated;
grant execute on function public.award_suggestion_points(uuid, text) to service_role;

-- 5. Tiers. The largest one the balance affords wins: 350 points is three
--    months, which is a far better rate than 100 points three times over.
create or replace function public.best_plus_tier(have int)
returns table (cost int, days int) language sql stable as $$
  select (t->>'points')::int, (t->>'days')::int
    from app_settings, jsonb_array_elements(value->'plus_tiers') t
   where key = 'points' and (t->>'points')::int <= have
   order by (t->>'points')::int desc
   limit 1;
$$;

-- Applies one tier to a profile: extends an existing Plus, or starts one now.
create or replace function public.apply_plus_tier(p_user uuid, p_cost int, p_days int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare base timestamptz; new_exp timestamptz;
begin
  select greatest(now(), coalesce(plan_expires_at, now())) into base from profiles where user_id = p_user and plan = 'plus';
  new_exp := coalesce(base, now()) + make_interval(days => p_days);
  -- A running store subscription keeps its source: the store's own renewal
  -- notices are matched on it, and relabelling the row would make the next
  -- one look like a plan we no longer track.
  update profiles
     set plan = 'plus', plan_expires_at = new_exp, updated_at = now(),
         plan_source = case when plan = 'plus' and plan_source in ('apple', 'google') and coalesce(plan_expires_at, now()) > now() then plan_source else 'points' end,
         plan_note = case when plan = 'plus' and plan_source in ('apple', 'google') and coalesce(plan_expires_at, now()) > now() then plan_note else 'Xal ilə' end
   where user_id = p_user;
  perform add_points(p_user, -p_cost, 'plus_redeem', p_days::text);
  return jsonb_build_object('days', p_days, 'cost', p_cost, 'expires_at', new_exp);
end $$;
revoke all on function public.apply_plus_tier(uuid, int, int) from public, anon, authenticated;

-- 6. Automatic redemption, for the signed-in user.
--
--    Points are spent only when Plus is *needed*. While any Plus is running —
--    paid, promo, or an earlier tier — the balance grows untouched; the moment
--    there is no Plus, the best tier the balance affords kicks in. Two reasons.
--    Someone paying through the App Store already has every feature, and burning
--    their points on days they would not use is a loss dressed up as a gift. And
--    spending at 100 the instant it is reached would mean nobody ever holds 350:
--    the three-month tier would exist on paper only. Letting the balance ride
--    through a week of Plus is what makes the better tiers reachable.
--    The app calls this on every profile load and the earning functions call it
--    after a credit, so a lapse or a crossing shows in the profile right away.
create or replace function public.auto_redeem_points()
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return null; end if;
  return auto_redeem_points_for(uid);
end $$;
grant execute on function public.auto_redeem_points() to authenticated;

create or replace function public.auto_redeem_points_for(p_user uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare have int; exp timestamptz; pl text; tier record;
begin
  select points, plan_expires_at, plan into have, exp, pl from profiles where user_id = p_user;
  if have is null then return null; end if;
  -- Plus is running, whatever paid for it: the points wait.
  if pl = 'plus' and (exp is null or exp > now()) then return null; end if;
  select * into tier from best_plus_tier(have);
  if tier.cost is null then return null; end if;
  return apply_plus_tier(p_user, tier.cost, tier.days);
end $$;
revoke all on function public.auto_redeem_points_for(uuid) from public, anon, authenticated;

-- 7. The manual button on the points screen: same tiers, but the user asked, so
--    it extends even a running subscription.
create or replace function public.redeem_points_for_plus()
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); have int; tier record; min_cost int;
begin
  if uid is null then raise exception 'Giriş tələb olunur'; end if;
  select points into have from profiles where user_id = uid;
  select * into tier from best_plus_tier(coalesce(have, 0));
  if tier.cost is null then
    select min((t->>'points')::int) into min_cost from app_settings, jsonb_array_elements(value->'plus_tiers') t where key = 'points';
    raise exception 'Kifayət qədər xal yoxdur (% lazımdır)', coalesce(min_cost, 100);
  end if;
  return apply_plus_tier(uid, tier.cost, tier.days);
end $$;
grant execute on function public.redeem_points_for_plus() to authenticated;

-- 8. Earning credits the balance and then lets the tier check run, so a
--    referral or a shopping trip that crosses a line turns into Plus right there.
create or replace function public.add_points(uid uuid, d int, why text, r text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (user_id, points) values (uid, greatest(0, d))
  on conflict (user_id) do update set points = greatest(0, profiles.points + d), updated_at = now();
  insert into points_ledger (user_id, delta, reason, ref) values (uid, d, why, r);
  -- Only on a credit: a redemption also goes through here, and re-checking
  -- after the debit is how a balance that still clears a tier would be spent
  -- twice in one call.
  if d > 0 then perform auto_redeem_points_for(uid); end if;
end $$;
revoke all on function public.add_points(uuid, int, text, text) from public, anon, authenticated;
