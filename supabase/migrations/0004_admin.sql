-- Admin panel access. Add an admin with:
--   insert into admins (user_id) select id from auth.users where email = 'you@example.com';
create table if not exists admins (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  created_at  timestamptz default now()
);
alter table admins enable row level security;
drop policy if exists "admins see admins" on admins;
create policy "admins see admins" on admins for select using (auth.uid() = user_id);

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;

-- Catalog write access for admins (public read policies already exist)
create policy "admin write stores"   on stores   for all using (is_admin()) with check (is_admin());
drop policy if exists "admin write products" on products;
create policy "admin write products" on products for all using (is_admin()) with check (is_admin());
create policy "admin write prices"   on prices   for all using (is_admin()) with check (is_admin());
create policy "admin write history"  on price_history for all using (is_admin()) with check (is_admin());
drop policy if exists "admin write branches" on branches;
create policy "admin write branches" on branches for all using (is_admin()) with check (is_admin());

-- Admins can read/update every profile (plan management) and read push tokens (send notifications)
create policy "admin read profiles"   on profiles    for select using (is_admin());
drop policy if exists "admin update profiles" on profiles;
create policy "admin update profiles" on profiles    for update using (is_admin()) with check (is_admin());
drop policy if exists "admin read push tokens" on push_tokens;
create policy "admin read push tokens" on push_tokens for select using (is_admin());
create policy "admin read baskets"    on baskets      for select using (is_admin());
drop policy if exists "admin read basket items" on basket_items;
create policy "admin read basket items" on basket_items for select using (is_admin());

-- Emails for the users page (auth.users is not readable from the client)
create or replace view admin_users with (security_invoker = false) as
select u.id, u.email, u.created_at, u.last_sign_in_at,
       coalesce(u.raw_app_meta_data->>'provider', 'email') as provider,
       p.display_name, coalesce(p.plan, 'free') as plan, p.city
from auth.users u left join profiles p on p.user_id = u.id;
revoke all on admin_users from anon, authenticated;
grant select on admin_users to authenticated;

create or replace function public.admin_users_list() returns setof admin_users language sql stable security definer set search_path = public as $$
  select * from admin_users where is_admin();
$$;
