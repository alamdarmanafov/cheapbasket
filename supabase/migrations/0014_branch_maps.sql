-- Google Maps link of the branch (opens the exact place page from the app) + phone.
alter table branches add column if not exists maps_url text;
alter table branches add column if not exists phone text;
