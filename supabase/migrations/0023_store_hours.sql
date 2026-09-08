-- Opening hours belong to the store, not to each branch.
--
-- Every branch of a chain keeps the same hours here, so entering them once per
-- store removes the per-branch busywork and, unlike the bulk-apply button on the
-- branches page, covers branches added later without anyone remembering to
-- re-run it. A branch may still override: its own value wins when set, and the
-- store's is used when it is empty.
alter table stores add column if not exists open_from   text;    -- '08:00'
alter table stores add column if not exists open_until  text;    -- '23:00'
alter table stores add column if not exists always_open boolean not null default false;
