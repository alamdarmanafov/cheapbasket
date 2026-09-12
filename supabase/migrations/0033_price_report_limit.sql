-- A ceiling on price reports. The app writes them straight through RLS, so
-- the table enforces the limit itself rather than trusting the caller: a
-- trigger, not an RPC, so it holds however the row arrives.
update app_settings set value = value || jsonb_build_object('price_reports_per_day', 20), updated_at = now()
 where key = 'points' and not (value ? 'price_reports_per_day');

create or replace function public.price_reports_guard() returns trigger language plpgsql security definer set search_path = public as $$
declare per_day int := points_setting('price_reports_per_day', 20); today int;
begin
  select count(*) into today from price_reports where user_id = new.user_id and created_at > now() - interval '24 hours';
  if today >= per_day then raise exception 'Günlük limit: % şikayət. Sabah davam et.', per_day; end if;
  if new.reason not in ('outdated', 'wrong', 'missing') then raise exception 'Səbəb düzgün deyil'; end if;
  new.note := left(coalesce(new.note, ''), 300);
  return new;
end $$;
drop trigger if exists price_reports_guard on price_reports;
create trigger price_reports_guard before insert on price_reports for each row execute function public.price_reports_guard();
