-- Supermarket chains (real). Add or edit from the admin panel afterwards.
insert into stores (id, name, color, initial) values
  ('araz', 'Araz', '#0F9D58', 'A'),
  ('bravo', 'Bravo', '#E64A19', 'B'),
  ('neptun', 'Neptun', '#1E63D6', 'N'),
  ('bazarstore', 'Bazarstore', '#F59E0B', 'Bz')
on conflict (id) do update set name = excluded.name, color = excluded.color, initial = excluded.initial;
