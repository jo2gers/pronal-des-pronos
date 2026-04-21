-- Migration 011: Add external_id to matches for Odds API event ID tracking
ALTER TABLE matches ADD COLUMN IF NOT EXISTS external_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS matches_external_id_idx ON matches (external_id) WHERE external_id IS NOT NULL;
