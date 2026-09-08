-- Closes the gaps a signed-in user could reach directly through PostgREST.
-- The publishable key ships inside the app binary, so anything the `authenticated`
-- role is allowed to write is effectively a public API — RLS decides *which rows*
-- a user may touch, never *which columns*. Column privileges do that.

-- 1. profiles: a user owns their name and preferences, nothing else
--
-- "own profile ... for all" let anyone PATCH their own row, and the row carries
-- plan, plan_expires_at, points and blocked. One HTTP request bought lifetime
-- Plus, unlimited points, or lifted a ban. Those columns are written only by the
-- IAP webhook, the admin panel and the security-definer points functions — all
-- of which run as the service role or the function owner and are unaffected by
-- the grants below.
revoke insert, update on public.profiles from anon, authenticated;
grant insert (user_id, display_name, city, favorite_stores, digest_enabled, updated_at) on public.profiles to authenticated;
grant update (display_name, city, favorite_stores, digest_enabled, updated_at) on public.profiles to authenticated;

-- 2. One store subscription belongs to one account
--
-- Enforced in the API too, but a unique index is the guarantee: two profiles can
-- never point at the same Apple original transaction or Google purchase token,
-- however the write arrives.
drop index if exists profiles_apple_otid_idx;
drop index if exists profiles_google_token_idx;
create unique index if not exists profiles_apple_otid_key  on public.profiles (apple_original_transaction_id) where apple_original_transaction_id is not null;
create unique index if not exists profiles_google_token_key on public.profiles (google_purchase_token)        where google_purchase_token        is not null;

-- 3. Referral payouts are capped and earned, not just claimed
--
-- Signups are auto-confirmed, so throwaway accounts are free to make and each
-- one paid the referrer 100 points — 300 points is a week of Plus, so three
-- fake accounts bought it. A cap alone only slows that down, so the payout now
-- lands when the invited account does something real (records a shopping trip)
-- rather than at the moment a code is typed. Caps still bound the damage if
-- someone automates real-looking trips. All three knobs live in
-- app_settings.points and need no migration to change:
--   {"referral_max": 25, "referral_max_per_day": 3, "referral_require_trip": 1}
-- Setting referral_require_trip to 0 restores the old instant payout.

/** Pays the referrer for one invitee, once, within the caps. Returns true if paid. */
create or replace function public.pay_referrer(p_owner uuid, p_invitee uuid) returns boolean language plpgsql security definer set search_path = public as $$
declare
  pts int := points_setting('referral', 100);
  cap_total int := points_setting('referral_max', 25);
  cap_day   int := points_setting('referral_max_per_day', 3);
  sent_total int; sent_today int;
begin
  if p_owner is null or p_invitee is null or p_owner = p_invitee then return false; end if;
  -- Once per invitee, however many times this is reached.
  if exists (select 1 from points_ledger where user_id = p_owner and reason = 'referral_sent' and ref = p_invitee::text) then
    return false;
  end if;
  select count(*), count(*) filter (where created_at > now() - interval '1 day')
    into sent_total, sent_today
    from points_ledger where user_id = p_owner and reason = 'referral_sent';
  if (cap_total > 0 and sent_total >= cap_total) or (cap_day > 0 and sent_today >= cap_day) then return false; end if;
  perform add_points(p_owner, pts, 'referral_sent', p_invitee::text);
  return true;
end $$;
revoke all on function public.pay_referrer(uuid, uuid) from public;

create or replace function public.apply_referral(p_code text) returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); owner uuid; pts int := points_setting('referral', 100); mine profiles%rowtype;
begin
  if uid is null then raise exception 'Giriş tələb olunur'; end if;
  select * into mine from profiles where user_id = uid;
  if mine.referred_by is not null then raise exception 'Dəvət kodu artıq istifadə olunub'; end if;
  select user_id into owner from profiles where referral_code = upper(trim(p_code));
  if owner is null then raise exception 'Kod tapılmadı'; end if;
  if owner = uid then raise exception 'Öz kodunu istifadə edə bilməzsən'; end if;
  insert into profiles (user_id, referred_by) values (uid, owner) on conflict (user_id) do update set referred_by = owner, updated_at = now();
  -- The invitee is a real person walking through the app, so they are paid now.
  perform add_points(uid, pts, 'referral_received', upper(trim(p_code)));
  -- The referrer is paid on the invitee's first recorded trip (see record_trip).
  if points_setting('referral_require_trip', 1) = 0 then perform pay_referrer(owner, uid); end if;
  return jsonb_build_object('points', pts);
end $$;
grant execute on function public.apply_referral(text) to authenticated;

/** Unchanged except for the referral payout at the end. */
create or replace function public.record_trip(p_store_id text, p_branch_id text, p_total numeric, p_saving numeric, p_items int) returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); pts int := points_setting('trip', 10); cool int := points_setting('trip_cooldown_hours', 6); earned int := 0; ref_owner uuid;
begin
  if uid is null then raise exception 'Giriş tələb olunur'; end if;
  insert into trips (user_id, store_id, branch_id, total, saving, items) values (uid, p_store_id, p_branch_id, coalesce(p_total, 0), coalesce(p_saving, 0), coalesce(p_items, 0));
  if not exists (select 1 from points_ledger where user_id = uid and reason = 'trip' and created_at > now() - make_interval(hours => cool)) then
    perform add_points(uid, pts, 'trip', p_store_id);
    earned := pts;
  end if;
  -- First real use by an invited account releases the referrer's reward.
  select referred_by into ref_owner from profiles where user_id = uid;
  if ref_owner is not null then perform pay_referrer(ref_owner, uid); end if;
  return jsonb_build_object('points_earned', earned);
end $$;
grant execute on function public.record_trip(text, text, numeric, numeric, int) to authenticated;

-- 4. The saved-list limit is a paywall, so the database enforces it
--
-- 0017 noted "Free: 1, Plus: unlimited — enforced in the app", which means the
-- limit was a dialog a direct API call walked straight past. Existing rows are
-- left alone; only new inserts are checked.
create or replace function public.saved_baskets_free_limit() returns trigger language plpgsql security definer set search_path = public as $$
declare lim int := points_setting('free_lists', 1); n int; plus boolean;
begin
  select (plan = 'plus' and (plan_expires_at is null or plan_expires_at > now())) into plus from profiles where user_id = new.user_id;
  if coalesce(plus, false) or lim <= 0 then return new; end if;
  select count(*) into n from saved_baskets where user_id = new.user_id;
  if n >= lim then
    raise exception 'Pulsuz planda % siyahı saxlamaq olur. Limitsiz siyahı üçün Plus.', lim using errcode = '23514';
  end if;
  return new;
end $$;

drop trigger if exists saved_baskets_limit on saved_baskets;
create trigger saved_baskets_limit before insert on saved_baskets
  for each row execute function public.saved_baskets_free_limit();
