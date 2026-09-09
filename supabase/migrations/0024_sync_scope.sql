-- Choose what a source pulls: products, prices, or both.
--
-- A sync did all of it at once — queued unmatched items as pending products and
-- upserted prices for matched ones. That is wrong for two common cases: a store
-- whose catalogue is already complete and only needs prices refreshed, and a
-- store being seeded for the first time whose prices are not trusted yet.
-- Existing sources keep doing both, which is what they did before.
alter table import_sources add column if not exists sync_products boolean not null default true;
alter table import_sources add column if not exists sync_prices   boolean not null default true;
