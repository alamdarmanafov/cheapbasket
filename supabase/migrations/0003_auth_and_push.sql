-- Profiles are created automatically when a user signs up (email, Apple or Google).
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'))
  on conflict (user_id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Expo push tokens, one row per device
create table if not exists push_tokens (
  token       text primary key,
  user_id     uuid references auth.users(id) on delete cascade,
  platform    text,
  created_at  timestamptz default now()
);
create index if not exists push_tokens_user_idx on push_tokens (user_id);
alter table push_tokens enable row level security;
create policy "own push tokens" on push_tokens for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Price-drop alerts: which products a user wants to be notified about (defaults to basket items)
create table if not exists price_alerts (
  user_id     uuid references auth.users(id) on delete cascade,
  product_id  text references products(id) on delete cascade,
  created_at  timestamptz default now(),
  primary key (user_id, product_id)
);
alter table price_alerts enable row level security;
create policy "own price alerts" on price_alerts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
