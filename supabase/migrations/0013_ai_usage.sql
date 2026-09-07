-- Per-user AI usage log (photo identification). Written only by the server (service role); Free users get a daily quota.
create table if not exists ai_usage (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null,            -- 'photo'
  created_at timestamptz default now()
);
create index if not exists ai_usage_idx on ai_usage (user_id, kind, created_at desc);
alter table ai_usage enable row level security;

-- Daily free quota for photo identification (Plus is unlimited). Editable in Supabase → app_settings.
insert into app_settings (key, value) values ('photo', '{"free_per_day": 1}') on conflict (key) do nothing;
