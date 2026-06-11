-- 023: Real match clock from Polymarket: elapsed minute (text — can be
-- "45+2") and period code (1H / HT / 2H / ET / FT...). Written by
-- syncLiveScores on every poll while the match is live.
ALTER TABLE matches
	ADD COLUMN IF NOT EXISTS live_elapsed text,
	ADD COLUMN IF NOT EXISTS live_period text;
