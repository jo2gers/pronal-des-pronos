-- 044: V2 favourite-club bonus infrastructure.
-- The winner-market slug is competition DATA (like the series id); the bonus
-- is stored PER COMPETITION on favorite_teams (profiles.team_bonus_points
-- stays the WC archive value); club picks are editable until the season
-- starts (starts_at) — belt via RLS on locked_at, braces in the action.
alter table public.competitions add column polymarket_winner_slug text;
update public.competitions
  set polymarket_winner_slug = 'epl-2027-champion-20260701200428749',
      starts_at = '2026-08-21T19:00:00Z'
  where slug = 'pl-2026-27';

alter table public.favorite_teams add column bonus_points numeric not null default 0;

create policy "update own (until locked)" on public.favorite_teams
  for update to authenticated
  using (user_id = auth.uid() and locked_at is null)
  with check (user_id = auth.uid());
