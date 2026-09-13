-- A store's own site search as a price source for the finder.
--
-- Not every chain is on Wolt. For those that sell online themselves, the
-- admin stores the search page with {q} where the words go, e.g.
-- https://araz.az/search?q={q}; "Marketlərdə tap" opens it with the product's
-- name and reads the results. The app never reads this column.
alter table stores add column if not exists search_url text;
