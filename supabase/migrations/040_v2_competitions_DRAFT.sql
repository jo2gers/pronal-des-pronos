-- 040 (V2 DRAFT — DO NOT APPLY until the V2 launch; lives on the
-- v2-next-season branch only. The live DB is the WC2026 archive.)
--
-- Multi-competition foundation: Premier League + Champions League 2026-27 as
-- two parallel games on the same accounts. Everything match-scoped gains a
-- competition_id; the WC2026 archive rows get a backfilled 'wc-2026'
-- competition so old pages keep working unchanged.

create table public.competitions (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,          -- 'wc-2026' | 'pl-2026-27' | 'ucl-2026-27'
  name_fr     text not null,
  name_en     text not null,
  format      text not null check (format in ('tournament', 'league', 'league_then_knockout')),
  espn_league text,                          -- 'fifa.world' | 'eng.1' | 'uefa.champions'
  active      boolean not null default false,
  starts_at   timestamptz,
  ends_at     timestamptz
);

alter table public.competitions enable row level security;
create policy "public read" on public.competitions for select using (true);

-- Seed: the archive + the two 2026-27 competitions (inactive until launch).
insert into public.competitions (slug, name_fr, name_en, format, espn_league, active) values
  ('wc-2026',    'Coupe du Monde 2026',   'World Cup 2026',      'tournament',            'fifa.world',     false),
  ('pl-2026-27', 'Premier League',        'Premier League',      'league',                'eng.1',          true),
  ('ucl-2026-27','Ligue des Champions',   'Champions League',    'league_then_knockout',  'uefa.champions', true);

-- Scope matches (backfill the archive) + leagues (a friends-league lives in
-- one competition).
alter table public.matches add column competition_id uuid references public.competitions(id);
update public.matches set competition_id = (select id from public.competitions where slug = 'wc-2026');
alter table public.matches alter column competition_id set not null;
create index matches_competition_idx on public.matches (competition_id, match_datetime);

alter table public.leagues add column competition_id uuid references public.competitions(id);

-- Favourite team becomes per-competition (Arsenal in PL, Real in UCL...).
-- profiles.favorite_team stays as the WC2026 archive value.
create table public.favorite_teams (
  user_id        uuid not null references public.profiles(id) on delete cascade,
  competition_id uuid not null references public.competitions(id) on delete cascade,
  team           text not null,
  locked_at      timestamptz,
  primary key (user_id, competition_id)
);
alter table public.favorite_teams enable row level security;
create policy "read all" on public.favorite_teams for select using (true);
create policy "upsert own (until locked)" on public.favorite_teams
  for insert to authenticated with check (user_id = auth.uid());

-- Winner odds (team-bonus multipliers) per competition; wc_winner_odds stays
-- as the archive table.
create table public.competition_winner_odds (
  competition_id uuid not null references public.competitions(id) on delete cascade,
  team_name_en   text not null,
  team_name_fr   text not null,
  odds           numeric not null,
  multiplier     numeric generated always as (round(ln(odds), 1)) stored,
  primary key (competition_id, team_name_en)
);
alter table public.competition_winner_odds enable row level security;
create policy "public read" on public.competition_winner_odds for select using (true);

-- V2 scoring: the per-scoreline exact-score multipliers (Poisson/Dixon-Coles
-- from the frozen 1X2 odds — see src/lib/server/scorelines.ts) are frozen at
-- the pick lock alongside the odds.
alter table public.matches add column scoreline_multipliers jsonb; -- {"2-1": 2.5, ...} frozen at lock
alter table public.pronostics add column exact_multiplier numeric;  -- the frozen mult for the predicted score

-- NOTE (not in this migration): user_pronostic_stats view gains competition_id
-- (join via matches) so each competition has its own leaderboard.
