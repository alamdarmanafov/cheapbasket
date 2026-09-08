-- 1. Popups in four languages
--
-- Azerbaijani stays in the base columns (title/body/cta_label) so every reader
-- keeps working unchanged; the other languages live in one jsonb keyed by
-- language code. A missing language — or a field left blank in it — falls back
-- to Azerbaijani in the app, so a half-translated popup still shows something.
--
--   {"en": {"title": "…", "body": "…", "cta_label": "…"}, "tr": {…}, "ru": {…}}
alter table popups add column if not exists translations jsonb not null default '{}'::jsonb;

-- 2. Referral codes are issued at signup, not on first visit to the screen
--
-- my_referral_code() minted the code lazily, so a user who never opened the
-- points screen had none, and anything that wanted to show the code up front
-- (the profile row) had nothing to show. Generating it with the profile makes
-- the column reliably non-null.
--
-- The generator deliberately avoids gen_random_bytes(): that lives in pgcrypto,
-- which Supabase installs into the `extensions` schema, so a function pinned to
-- `search_path = public` cannot see it — the reason 0017's my_referral_code()
-- raised 42883 and never issued a single code. gen_random_uuid() is core
-- Postgres and needs no extension.
create or replace function public.gen_referral_code() returns text language plpgsql security definer set search_path = public as $$
declare c text;
begin
  loop
    -- Six hex characters, with 0 and 1 mapped away from the glyphs they get
    -- confused with (0/O, 1/I/l) when a code is read aloud or off a screenshot.
    c := translate(upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)), '01', 'GH');
    exit when not exists (select 1 from profiles where referral_code = c);
  end loop;
  return c;
end $$;
revoke all on function public.gen_referral_code() from public;

create or replace function public.profiles_set_referral_code() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.referral_code is null then new.referral_code := public.gen_referral_code(); end if;
  return new;
end $$;

drop trigger if exists profiles_referral_code on profiles;
create trigger profiles_referral_code before insert or update on profiles
  for each row when (new.referral_code is null) execute function public.profiles_set_referral_code();

-- Existing accounts that never opened the points screen.
update profiles set referral_code = public.gen_referral_code() where referral_code is null;

-- Still callable — the app reads the code straight off the profile now, but the
-- RPC stays as the guaranteed-non-null path for anyone on an older build.
create or replace function public.my_referral_code() returns text language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); c text;
begin
  if uid is null then raise exception 'Giriş tələb olunur'; end if;
  select referral_code into c from profiles where user_id = uid;
  if c is null then
    c := public.gen_referral_code();
    insert into profiles (user_id, referral_code) values (uid, c)
      on conflict (user_id) do update set referral_code = coalesce(profiles.referral_code, c);
    select referral_code into c from profiles where user_id = uid;
  end if;
  return c;
end $$;
grant execute on function public.my_referral_code() to authenticated;
