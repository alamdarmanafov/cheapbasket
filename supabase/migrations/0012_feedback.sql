-- In-app feedback / complaints ("Dəstək" in the profile). Read only via the admin panel (service role).
create table if not exists feedback (
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
alter table feedback enable row level security;
drop policy if exists "anyone can send feedback" on feedback;
create policy "anyone can send feedback" on feedback for insert with check (true);
