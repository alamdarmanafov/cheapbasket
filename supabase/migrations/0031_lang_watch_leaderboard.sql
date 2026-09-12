-- The reader's language on the profile, so a push arrives in it; a monthly
-- contributors' board; nothing new for per-product alerts — that table has
-- existed since 0003 and the app finally uses it.

-- 1. Language. Written by the app whenever it is changed or first learned.
alter table profiles add column if not exists lang text not null default 'az';
grant insert (lang) on public.profiles to authenticated;
grant update (lang) on public.profiles to authenticated;

-- 2. Who added the most this month. Names are shortened to a first name and
--    an initial: a board is public to every signed-in user, a full name is not
--    theirs to see. Points counted are the earned kinds only — a redemption is
--    a debit and a referral received is the other person's doing.
create or replace function public.top_contributors(p_limit int default 10)
returns table (rank int, name text, points int, me boolean)
language sql security definer set search_path = public stable as $$
  with month as (
    select user_id, sum(delta)::int as pts
      from points_ledger
     where delta > 0
       and reason in ('suggestion', 'trip', 'referral_sent')
       and created_at >= date_trunc('month', now())
     group by user_id
  ),
  named as (
    select m.user_id, m.pts,
           coalesce(
             nullif(trim(split_part(coalesce(p.display_name, ''), ' ', 1)) ||
                    case when split_part(coalesce(p.display_name, ''), ' ', 2) <> '' then ' ' || left(split_part(p.display_name, ' ', 2), 1) || '.' else '' end, ''),
             'İstifadəçi'
           ) as name
      from month m
      left join profiles p on p.user_id = m.user_id
  )
  select row_number() over (order by pts desc, user_id)::int as rank, name, pts as points, user_id = auth.uid() as me
    from named
   order by pts desc, user_id
   limit greatest(1, least(coalesce(p_limit, 10), 50));
$$;
revoke all on function public.top_contributors(int) from public;
grant execute on function public.top_contributors(int) to authenticated;
