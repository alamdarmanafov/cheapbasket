-- Announcement popups: campaigns and release notes, shown over the app and
-- managed from the admin panel. Same shape as banners, plus who should see one
-- and how often.
--
-- Frequency is enforced on the device rather than here: the app keeps its own
-- view log in AsyncStorage. That keeps the read path anonymous (no per-user
-- table, no write on every impression) at the cost of a reinstall resetting the
-- counters — an acceptable trade for an announcement.
create table if not exists popups (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  body        text not null,
  image_url   text,
  -- Button: label plus an in-app route (e.g. /plus, /deals) or an https:// link.
  cta_label   text,
  cta_link    text,
  -- 'all' | 'free' | 'plus' — free/plus target one side of the paywall, e.g. an
  -- upgrade offer that Plus subscribers should never be shown.
  audience    text not null default 'all' check (audience in ('all', 'free', 'plus')),
  -- 0 means unlimited for that window.
  max_per_day  int not null default 1,
  max_per_week int not null default 3,
  sort        int  default 0,
  active      boolean not null default true,
  starts_at   timestamptz,
  ends_at     timestamptz,
  created_at  timestamptz default now()
);

alter table popups enable row level security;
drop policy if exists "public read popups" on popups;
create policy "public read popups" on popups for select using (active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()));

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'popups') then
    execute 'alter publication supabase_realtime add table popups';
  end if;
end $$;
