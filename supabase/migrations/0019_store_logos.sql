-- Store logos: an optional image shown in place of the coloured initial badge.
-- Managed from the admin panel (Marketlər → Logo URL); the app falls back to the
-- initial whenever this is null, so it is safe to leave empty per store.
alter table stores add column if not exists logo_url text;
