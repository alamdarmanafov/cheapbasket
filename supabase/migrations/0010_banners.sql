-- Promotional banners shown as a slider on the app home screen (managed in the admin panel).
create table if not exists banners (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  subtitle    text,
  image_url   text,
  bg_color    text default '#E53935',
  text_color  text default '#FFFFFF',
  -- in-app route (e.g. /deals, /plus, /product/<id>) or https:// link
  link        text,
  sort        int  default 0,
  active      boolean not null default true,
  starts_at   timestamptz,
  ends_at     timestamptz,
  created_at  timestamptz default now()
);
alter table banners enable row level security;
drop policy if exists "public read banners" on banners;
create policy "public read banners" on banners for select using (active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()));

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'banners') then
    execute 'alter publication supabase_realtime add table banners';
  end if;
end $$;
