-- Promo codes (Plus for N days), usage analytics events, and the redeem RPC.

create table if not exists promo_codes (
  code        text primary key,
  days        int  not null check (days > 0),
  max_uses    int,
  used        int  not null default 0,
  expires_at  timestamptz,
  active      boolean not null default true,
  note        text,
  created_at  timestamptz default now()
);
create table if not exists promo_redemptions (
  id         uuid primary key default gen_random_uuid(),
  code       text not null references promo_codes(code) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  unique (code, user_id)
);
alter table promo_codes enable row level security;
alter table promo_redemptions enable row level security;

-- App calls this with the user's session; validates and extends Plus atomically.
create or replace function public.redeem_promo(p_code text) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c promo_codes%rowtype;
  uid uuid := auth.uid();
  base timestamptz;
  new_exp timestamptz;
begin
  if uid is null then raise exception 'Giriş tələb olunur'; end if;
  select * into c from promo_codes where upper(code) = upper(trim(p_code)) for update;
  if not found or not c.active then raise exception 'Kod tapılmadı'; end if;
  if c.expires_at is not null and c.expires_at < now() then raise exception 'Kodun müddəti bitib'; end if;
  if c.max_uses is not null and c.used >= c.max_uses then raise exception 'Kodun limiti dolub'; end if;
  if exists (select 1 from promo_redemptions r where r.code = c.code and r.user_id = uid) then raise exception 'Bu kodu artıq istifadə etmisən'; end if;

  select greatest(now(), coalesce(plan_expires_at, now())) into base from profiles where user_id = uid and plan = 'plus';
  new_exp := coalesce(base, now()) + make_interval(days => c.days);
  insert into profiles (user_id, plan, plan_expires_at, plan_source, plan_note, updated_at)
    values (uid, 'plus', new_exp, 'promo', 'Promo: ' || c.code, now())
  on conflict (user_id) do update set plan = 'plus', plan_expires_at = new_exp, plan_source = 'promo', plan_note = 'Promo: ' || c.code, updated_at = now();
  insert into promo_redemptions (code, user_id) values (c.code, uid);
  update promo_codes set used = used + 1 where code = c.code;
  return jsonb_build_object('days', c.days, 'expires_at', new_exp);
end $$;
revoke all on function public.redeem_promo(text) from public;
grant execute on function public.redeem_promo(text) to authenticated;

-- Lightweight product analytics written by the app (no personal data beyond the user id).
create table if not exists events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid,
  kind       text not null,          -- app_open | search | scan | photo | basket_add | compare | map_open | plus_view | promo
  meta       jsonb,
  created_at timestamptz default now()
);
create index if not exists events_kind_idx on events (kind, created_at desc);
create index if not exists events_user_idx on events (user_id, created_at desc);
alter table events enable row level security;
drop policy if exists "app writes events" on events;
create policy "app writes events" on events for insert to anon, authenticated with check (user_id is null or user_id = auth.uid());
