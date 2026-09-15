-- Three tables let a signed-in user do more than the app ever asks for.
--
-- Each used a single "for all" policy scoped to `auth.uid() = user_id`,
-- meant to let someone see and add their own rows. "For all" covers
-- UPDATE and DELETE too, and nothing in the app calls either — every
-- write to the fields that matter (price_reports.resolved/outcome/points,
-- price_requests.status, branch_suggestions.status/branch_id/points) is
-- meant to happen only through the admin's service-role API, which
-- bypasses RLS regardless of what these policies say. As written, a
-- signed-in person could reach `/rest/v1/price_reports?id=eq.<their row>`
-- directly with their own access token and mark their own report
-- resolved/applied without an admin ever seeing it, or flip a
-- branch_suggestions row straight to `approved` — neither creates the
-- real side effect (a price on file, a branch on the map: those only
-- happen through the SQL functions and the admin route), but both let
-- someone quietly erase their own submission from the review queue, or
-- resurrect a rejected one without spending a new one of their daily
-- five, and price_reports.points feeding "Töhfələrim" could be set to
-- anything (it never touches the real balance in profiles.points).
--
-- Splitting into read + insert leaves every existing flow untouched —
-- the app only ever selects and inserts these three from the client —
-- and closes the update/delete path a person was never meant to have.

drop policy if exists "own price reports" on price_reports;
create policy "read own price reports" on price_reports for select using (auth.uid() = user_id);
create policy "insert own price reports" on price_reports for insert with check (auth.uid() = user_id);

drop policy if exists "own price requests" on price_requests;
create policy "read own price requests" on price_requests for select using (auth.uid() = user_id);
create policy "insert own price requests" on price_requests for insert with check (auth.uid() = user_id);

drop policy if exists "own branch suggestions" on branch_suggestions;
create policy "read own branch suggestions" on branch_suggestions for select using (auth.uid() = user_id);
create policy "insert own branch suggestions" on branch_suggestions for insert with check (auth.uid() = user_id);
