-- Two things the app cannot do without.

-- 1. Saving a name and a city.
--
-- 0022 replaced the blanket write privilege on profiles with column grants, and
-- left user_id out of the UPDATE list on the reasoning that nobody should move a
-- row to another account. But the client saves with an upsert, and PostgREST
-- writes that as
--
--   insert into profiles (user_id, display_name, city, updated_at) values (…)
--   on conflict (user_id) do update set user_id = excluded.user_id, …
--
-- — the conflict key is assigned in the DO UPDATE like every other column. With
-- user_id ungranted the whole statement is refused, and the profile screen showed
-- "permission denied for table profiles" on every save.
--
-- Granting it is safe: the "own profile" policy checks auth.uid() = user_id on
-- both sides, so a row still cannot be moved to another account. plan, points
-- and the expiry columns stay ungranted, which is what 0022 was actually for.
grant update (user_id, display_name, city, favorite_stores, digest_enabled, updated_at)
  on public.profiles to authenticated;

-- 2. Sending feedback.
--
-- 0012 created this table, but it is missing from the live database — the support
-- screen fails with "Could not find the table 'public.feedback' in the schema
-- cache". Repeated here so a database that skipped that migration gets it; a
-- database that already has the table is unaffected.
create table if not exists public.feedback (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete set null,
  email      text,
  kind       text not null default 'question',   -- question | complaint | suggestion
  message    text not null,
  platform   text,
  status     text not null default 'new',        -- new | done
  admin_note text,
  created_at timestamptz default now()
);
alter table public.feedback enable row level security;
drop policy if exists "anyone can send feedback" on public.feedback;
create policy "anyone can send feedback" on public.feedback for insert with check (true);
