-- 026: Revert 025 — the post-match video highlights feature was removed.
-- These columns held only ESPN-derived data (no user picks).
ALTER TABLE matches
  DROP COLUMN IF EXISTS espn_game_id,
  DROP COLUMN IF EXISTS espn_videos,
  DROP COLUMN IF EXISTS espn_videos_synced_at;
