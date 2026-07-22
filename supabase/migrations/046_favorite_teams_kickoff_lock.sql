-- 046: enforce the club-pick lock in the DB against the competition kickoff.
--
-- The migration-044 policies gated UPDATE on `locked_at IS NULL`, but nothing
-- ever populates favorite_teams.locked_at (no trigger, no cron, no app write),
-- so the lock was dormant: a direct PostgREST call with a user JWT could insert
-- or change a favourite club AFTER the season started and passively farm the
-- club bonus. The server action (/[comp]/team ?/pick) already blocks the app
-- path via competition.starts_at; this closes the direct-API path too.
--
-- Gate INSERT + UPDATE on the competition not having started
-- (starts_at IS NULL = not scheduled yet, or now() < starts_at). competitions
-- is public-read (RLS "public read", qual=true), so the subquery resolves for
-- authenticated callers. Bonus accrual (scoreMatch) runs with the service-role
-- client, which bypasses RLS, so post-kickoff accrual is unaffected.
--
-- favorite_teams.locked_at is now vestigial (kept, harmless).
--
-- SECOND, bigger hole (audit P0): the 'authenticated' role held table-level
-- INSERT/UPDATE, so a user could PATCH their own row's bonus_points to any value
-- and top the public leaderboard (total = prono_points + bonus_points). Column
-- grants below restrict user writes to the pick columns only (user_id,
-- competition_id, team); bonus_points + locked_at become writable ONLY by the
-- service-role scoring path (service_role is not revoked, and bypasses RLS).

-- Restrict which COLUMNS a logged-in user may write. Omitted columns
-- (bonus_points, locked_at) fall back to their DEFAULT on insert and cannot be
-- named on update at all.
revoke insert, update on public.favorite_teams from anon, authenticated;
grant insert (user_id, competition_id, team) on public.favorite_teams to authenticated;
grant update (team) on public.favorite_teams to authenticated;

drop policy if exists "update own (until locked)" on public.favorite_teams;
drop policy if exists "upsert own (until locked)" on public.favorite_teams;

create policy "insert own (before kickoff)" on public.favorite_teams
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.competitions c
      where c.id = favorite_teams.competition_id
        and (c.starts_at is null or now() < c.starts_at)
    )
  );

create policy "update own (before kickoff)" on public.favorite_teams
  for update to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.competitions c
      where c.id = favorite_teams.competition_id
        and (c.starts_at is null or now() < c.starts_at)
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.competitions c
      where c.id = favorite_teams.competition_id
        and (c.starts_at is null or now() < c.starts_at)
    )
  );
