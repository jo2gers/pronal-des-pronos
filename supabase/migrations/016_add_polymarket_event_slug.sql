-- Migration 016: add Polymarket event slug for live-score sync.
-- Lookups via the gamma-api use this slug
-- (e.g. https://gamma-api.polymarket.com/events?slug=lal-val-ray-2026-05-14).
ALTER TABLE matches ADD COLUMN IF NOT EXISTS polymarket_event_slug TEXT;
CREATE INDEX IF NOT EXISTS matches_polymarket_event_slug_idx
  ON matches (polymarket_event_slug) WHERE polymarket_event_slug IS NOT NULL;
