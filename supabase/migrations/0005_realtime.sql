-- Live updates: the app subscribes to these tables so admin changes appear immediately.
do $$
declare t text;
begin
  foreach t in array array['stores','products','prices','branches'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = t) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $$;
