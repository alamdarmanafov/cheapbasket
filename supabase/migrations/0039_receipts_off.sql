-- Receipt scanning off by default.
--
-- A receipt photo carries the total, the time, the branch and sometimes the
-- tail of a card number, and it goes to a vision model to be read. A price
-- suggestion from the scanner is one product and one number. The app hides
-- the receipt entry points while this is false, and the server refuses
-- uploads; flipping it to true turns the feature back on without a build.
update app_settings set value = value || '{"enabled": false}'::jsonb, updated_at = now()
 where key = 'receipts' and not (value ? 'enabled');
insert into app_settings (key, value) values ('receipts', '{"free_per_day": 3, "enabled": false}') on conflict (key) do nothing;
