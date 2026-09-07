-- Subscriptions with an expiry, admin notes and blocking.
alter table profiles add column if not exists plan_expires_at timestamptz;
alter table profiles add column if not exists plan_note text;
alter table profiles add column if not exists blocked boolean not null default false;
alter table profiles add column if not exists updated_at timestamptz default now();

-- Effective plan: 'plus' only while not expired.
create or replace function public.effective_plan(p profiles) returns text language sql immutable as $$
  select case when p.plan = 'plus' and (p.plan_expires_at is null or p.plan_expires_at > now()) then 'plus' else 'free' end;
$$;

-- column set changed → drop and recreate (CREATE OR REPLACE cannot reorder columns)
drop view if exists admin_users;
create view admin_users with (security_invoker = false) as
select u.id, u.email, u.created_at, u.last_sign_in_at,
       coalesce(u.raw_app_meta_data->>'provider', 'email') as provider,
       p.display_name, coalesce(p.plan, 'free') as plan, p.plan_expires_at, p.plan_note, coalesce(p.blocked, false) as blocked, p.city,
       (select count(*) from push_tokens t where t.user_id = u.id) as devices
from auth.users u left join profiles p on p.user_id = u.id;
revoke all on admin_users from anon, authenticated;
grant select on admin_users to authenticated;

-- Users can delete their own account from the app (App Store requirement for Sign in with Apple).
create or replace function public.delete_own_account() returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;
