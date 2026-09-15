-- CRITICAL: `admin_users` (auth.users emails, last sign-in, plan, city,
-- device count for every account) was granted `select` to `authenticated`
-- in 0006 — any signed-in app user could read it directly through
-- PostgREST (/rest/v1/admin_users), bypassing the admin_users_list()
-- function's is_admin() check entirely. Nothing legitimate reads the view
-- itself: the admin panel goes through its own service-role gateway,
-- which ignores table grants, and admin_users_list() is the only
-- supported client-facing path.
revoke select on admin_users from authenticated, anon;

-- The RPC already filters to admins internally (`where is_admin()`, so a
-- non-admin caller just gets zero rows), but there's no reason for a
-- signed-out client to call it at all — narrow it to signed-in users only.
revoke execute on function public.admin_users_list() from public;
grant execute on function public.admin_users_list() to authenticated;
