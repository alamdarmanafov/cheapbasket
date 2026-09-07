-- Removes the demo catalog (seed.sql) so you can enter real products, prices and branches by hand.
-- Stores (Araz, Bravo, Neptun, Bazarstore) are kept — the app's store ids depend on them.
delete from price_history;
delete from prices;
delete from basket_items;
delete from price_alerts;
delete from products;
delete from branches;
