-- 029: Venue / host location from ESPN summary gameInfo.venue.
--   venue         : stadium full name (e.g. "Estadio Banorte") — existing column
--   venue_city    : "Mexico City", "Santa Clara, California"
--   venue_country : host country ("Mexico", "USA", "Canada")
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS venue_city text,
  ADD COLUMN IF NOT EXISTS venue_country text;
