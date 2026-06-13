-- 025: ESPN video highlights per finished match.
--   espn_game_id          : ESPN gameId, resolved from the dated scoreboard by team names
--   espn_videos           : slim array of { headline, duration, thumbnail, url } + page url
--   espn_videos_synced_at : throttle marker so finished matches aren't re-polled every minute
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS espn_game_id text,
  ADD COLUMN IF NOT EXISTS espn_videos jsonb,
  ADD COLUMN IF NOT EXISTS espn_videos_synced_at timestamptz;
