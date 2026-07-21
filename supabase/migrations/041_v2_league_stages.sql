-- 041: V2 stage values + fixture-sync idempotency.
--
-- League-format competitions need stage='league' (PL matchdays, UCL league
-- phase) and 'playoff' (UCL knockout play-offs before the R16). The existing
-- knockout names (round_of_16..final) are reused by the UCL KO tree.
alter table public.matches drop constraint matches_stage_check;
alter table public.matches add constraint matches_stage_check
  check (stage = any (array[
    'group', 'league', 'playoff',
    'round_of_32', 'round_of_16', 'quarters', 'semis', 'third', 'final'
  ]::text[]));

-- ESPN event ids are globally unique; a partial unique index lets the fixture
-- sync upsert on espn_game_id (reschedules update in place, no duplicates).
create unique index matches_espn_game_id_key
  on public.matches (espn_game_id) where espn_game_id is not null;
