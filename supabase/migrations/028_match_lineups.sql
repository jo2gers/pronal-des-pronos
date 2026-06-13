-- 028: Formations & lineups from ESPN's summary rosters, stored per match.
--   lineups       : { home: {formation, starters[], subs[], bench[]}, away: {...} }
--   espn_game_id  : re-added (dropped in 026) so the lineups sync fetches the
--                   summary endpoint without re-resolving the id every tick.
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS lineups jsonb,
  ADD COLUMN IF NOT EXISTS espn_game_id text;
