-- 049: favorite_teams perf hygiene.
--   (a) index the competition_id / team lookups (leaderboard bonus union,
--       scoreMatch accrual .eq(competition_id).eq(team), the admin recompute) —
--       the composite PK (user_id, competition_id) is ordered user_id-first so
--       it can't serve a competition_id-first filter.
--   (b) wrap auth.uid() as (select auth.uid()) in the RLS policies so Postgres
--       evaluates it ONCE per statement (initPlan) instead of once per row —
--       the documented Supabase RLS perf pattern. Predicates are otherwise
--       identical to migration 046.

create index if not exists idx_favorite_teams_comp_team
  on public.favorite_teams (competition_id, team);

drop policy if exists "insert own (before kickoff)" on public.favorite_teams;
drop policy if exists "update own (before kickoff)" on public.favorite_teams;

create policy "insert own (before kickoff)" on public.favorite_teams
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.competitions c
      where c.id = favorite_teams.competition_id
        and (c.starts_at is null or now() < c.starts_at)
    )
  );

create policy "update own (before kickoff)" on public.favorite_teams
  for update to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.competitions c
      where c.id = favorite_teams.competition_id
        and (c.starts_at is null or now() < c.starts_at)
    )
  )
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.competitions c
      where c.id = favorite_teams.competition_id
        and (c.starts_at is null or now() < c.starts_at)
    )
  );
