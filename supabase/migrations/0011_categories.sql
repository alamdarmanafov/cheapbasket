-- Product categories managed in the admin panel (can be imported from Wolt once, then edited).
create table if not exists categories (
  id     text primary key,
  name   text not null unique,
  emoji  text,
  sort   int default 0
);
alter table categories enable row level security;
drop policy if exists "public read categories" on categories;
create policy "public read categories" on categories for select using (true);

insert into categories (id, name, emoji, sort) values
  ('sud-mehsullari', 'Süd məhsulları', '🥛', 0),
  ('yumurta', 'Yumurta', '🥚', 1),
  ('qida', 'Qida', '🍝', 2),
  ('ickiler', 'İçkilər', '🧃', 3),
  ('et', 'Ət', '🥩', 4),
  ('meyve-terevez', 'Meyvə-tərəvəz', '🍎', 5),
  ('corek', 'Çörək', '🍞', 6),
  ('sirniyyat', 'Şirniyyat', '🍫', 7),
  ('ev-ve-gigiyena', 'Ev və gigiyena', '🧴', 8)
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'categories') then
    execute 'alter publication supabase_realtime add table categories';
  end if;
end $$;
