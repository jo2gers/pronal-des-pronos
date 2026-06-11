-- 024: Match timeline (goals + cards) from ESPN's public scoreboard API.
-- Array of { minute, type: goal|og|pen|yellow|red, side: home|away, player }.
-- Written by syncLiveScores during the match; persists after FT.
ALTER TABLE matches ADD COLUMN IF NOT EXISTS live_events jsonb;
