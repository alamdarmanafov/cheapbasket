-- "There is a Bravo right here and it is not on your map."
--
-- A shopper standing at a store can hand us its location: the chain (or a
-- new store's name), the branch name, the address the phone read back, and
-- the coordinates. It waits here; the admin makes it a branch (and a store,
-- if new) and pays the points. Nothing reaches `branches` on its own.

create table if not exists branch_suggestions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  store_id    text references stores(id) on delete set null,   -- null = a chain we do not list yet
  store_name  text,                                             -- the chain's name when store_id is null
  name        text,                                             -- branch name, optional
  address     text,
  lat         double precision not null,
  lng         double precision not null,
  note        text,
  status      text not null default 'pending',                  -- pending | approved | rejected
  branch_id   text,                                             -- the branch it became
  points      int not null default 0,
  created_at  timestamptz default now(),
  decided_at  timestamptz
);
create index if not exists branch_suggestions_status_idx on branch_suggestions (status, created_at desc);
alter table branch_suggestions enable row level security;
drop policy if exists "own branch suggestions" on branch_suggestions;
create policy "own branch suggestions" on branch_suggestions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Five a day per person: a walk past ten shops is not ten suggestions.
create or replace function public.branch_suggestions_guard() returns trigger language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if new.user_id is distinct from auth.uid() then raise exception 'Giriş tələb olunur'; end if;
  if new.store_id is null and coalesce(trim(new.store_name), '') = '' then raise exception 'Marketi seç və ya adını yaz'; end if;
  if new.lat is null or new.lng is null or abs(new.lat) > 90 or abs(new.lng) > 180 then raise exception 'Yer təyin olunmayıb'; end if;
  select count(*) into n from branch_suggestions where user_id = new.user_id and created_at > now() - interval '24 hours';
  if n >= 5 then raise exception 'Gündə 5 filial təklifi. Sabah davam et.'; end if;
  new.status := 'pending'; new.branch_id := null; new.points := 0; new.decided_at := null;
  return new;
end $$;
drop trigger if exists branch_suggestions_guard on branch_suggestions;
create trigger branch_suggestions_guard before insert on branch_suggestions for each row execute function public.branch_suggestions_guard();

update app_settings set value = value || jsonb_build_object('branch', coalesce(value->'branch', '5'::jsonb)) where key = 'points';

-- Paid once per suggestion when the admin makes it a branch.
create or replace function public.award_branch_points(p_user uuid, p_ref text)
returns int language plpgsql security definer set search_path = public as $$
declare pts int := points_setting('branch', 5);
begin
  if p_user is null or coalesce(p_ref, '') = '' or pts <= 0 then return 0; end if;
  if exists (select 1 from points_ledger where user_id = p_user and reason = 'branch' and ref = p_ref) then return 0; end if;
  perform add_points(p_user, pts, 'branch', p_ref);
  return pts;
end $$;
revoke all on function public.award_branch_points(uuid, text) from public, anon, authenticated;
grant execute on function public.award_branch_points(uuid, text) to service_role;
