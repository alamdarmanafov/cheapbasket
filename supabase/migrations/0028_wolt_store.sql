-- Wolt Market as a store of its own.
--
-- Wolt is where most of our prices come from, but until now only as a window
-- onto other chains (Bravo on Wolt, Araz on Wolt). Wolt Market is a grocery in
-- its own right, with its own shelf and its own prices, so it takes a row like
-- any other chain. Once this exists the sync page can attach its venues
-- (Sinxron → "Wolt Market" → mənbə əlavə et) and its prices join the
-- comparison. Logo and hours are left for the admin panel; the app shows the
-- coloured initial until a logo is set.
insert into stores (id, name, color, initial)
values ('wolt', 'Wolt Market', '#009DE0', 'W')
on conflict (id) do nothing;
