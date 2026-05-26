-- Migration 018: drop the top-scorer / meilleur-buteur feature.
--
-- The feature is gone from every UI surface and from the server logic
-- (see commit 594b64b). This migration removes the underlying schema so
-- the database matches the code:
--
--   - profiles.top_scorer (TEXT)               — user's pick
--   - profiles.top_scorer_bonus_points (NUMERIC) — accumulated bonus
--   - public.wc_top_scorers (TABLE)            — Polymarket-sourced odds
--
-- IRREVERSIBLE — drop the columns and the table outright. There is no
-- restore path; data is discarded.

ALTER TABLE profiles DROP COLUMN IF EXISTS top_scorer;
ALTER TABLE profiles DROP COLUMN IF EXISTS top_scorer_bonus_points;
DROP TABLE IF EXISTS wc_top_scorers;
