-- Branches that are imported as names only.
--
-- A chain is easier to enter in two passes: every branch name first, then the
-- Google Maps link for each one by hand. The second pass is what produces the
-- coordinates, so between the passes a branch legitimately has none — and a
-- placeholder pin is worse than no pin, because nothing downstream can tell a
-- guess from a real location.
--
-- So the coordinates become nullable and the address optional, and a branch
-- without coordinates is simply skipped by anything that needs a location
-- (the map, "nearest branch") until its link is added.

alter table branches alter column lat drop not null;
alter table branches alter column lng drop not null;
alter table branches alter column address drop not null;
alter table branches alter column address set default '';

-- Rows written before this point never had nulls, so nothing needs backfilling.
