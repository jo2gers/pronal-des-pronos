-- Migration 017: per-match last-sync timestamp for the live-score poller.
-- The poller uses this to apply an elapsed-time-aware cooldown:
--   <45 min from kickoff: don't poll (no info expected pre-HT)
--   45-90 min: poll at most once / 60 min (catches the HT score)
--   90+ min: poll every 5 min until ended (catches FT)
-- Without this column the function would either over-poll or rely on
-- in-process state that doesn't survive Vercel cold starts.
ALTER TABLE matches ADD COLUMN IF NOT EXISTS last_score_sync_at TIMESTAMPTZ;
