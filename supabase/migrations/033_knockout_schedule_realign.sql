-- Migration 033: align every knockout slot's kickoff + venue to the OFFICIAL
-- FIFA World Cup 2026 schedule.
--
-- Migration 032 corrected WHICH positions play in each slot_code, but the slots
-- still carried their old (placeholder) dates/venues, so the right fixtures were
-- landing on the wrong dates (e.g. South Africa–Canada showed 29 Jun instead of
-- the real 28 Jun at SoFi Stadium). This sets each slot's match_datetime (UTC),
-- stadium, city and country from the official schedule (matches 73–104), using
-- the same slot_code → official-match mapping established in 032.
--
-- Source: Wikipedia "2026 FIFA World Cup knockout stage" (kickoff times + venues),
-- cross-checked against the published Match 73 fixture (SoFi Stadium, Inglewood,
-- 28 Jun, 12:00 PDT = 19:00 UTC).

update matches m set
  match_datetime = v.dt,
  venue         = v.stadium,
  venue_city    = v.city,
  venue_country = v.country
from (values
  -- Round of 32
  ('R32-1',  timestamptz '2026-06-29 20:30:00+00', 'Gillette Stadium',       'Foxborough',      'USA'),    -- M74
  ('R32-2',  timestamptz '2026-06-30 21:00:00+00', 'MetLife Stadium',        'East Rutherford', 'USA'),    -- M77
  ('R32-3',  timestamptz '2026-06-28 19:00:00+00', 'SoFi Stadium',           'Inglewood',       'USA'),    -- M73 South Africa–Canada
  ('R32-4',  timestamptz '2026-06-30 00:00:00+00', 'Estadio BBVA',           'Guadalupe',       'Mexico'), -- M75
  ('R32-5',  timestamptz '2026-07-02 23:00:00+00', 'BMO Field',              'Toronto',         'Canada'), -- M83
  ('R32-6',  timestamptz '2026-07-02 19:00:00+00', 'SoFi Stadium',           'Inglewood',       'USA'),    -- M84
  ('R32-7',  timestamptz '2026-07-02 00:00:00+00', 'Levi''s Stadium',        'Santa Clara',     'USA'),    -- M81
  ('R32-8',  timestamptz '2026-07-01 20:00:00+00', 'Lumen Field',            'Seattle',         'USA'),    -- M82
  ('R32-9',  timestamptz '2026-06-29 17:00:00+00', 'NRG Stadium',            'Houston',         'USA'),    -- M76
  ('R32-10', timestamptz '2026-06-30 17:00:00+00', 'AT&T Stadium',           'Arlington',       'USA'),    -- M78
  ('R32-11', timestamptz '2026-07-01 00:00:00+00', 'Estadio Azteca',         'Mexico City',     'Mexico'), -- M79
  ('R32-12', timestamptz '2026-07-01 16:00:00+00', 'Mercedes-Benz Stadium',  'Atlanta',         'USA'),    -- M80
  ('R32-13', timestamptz '2026-07-03 22:00:00+00', 'Hard Rock Stadium',      'Miami Gardens',   'USA'),    -- M86
  ('R32-14', timestamptz '2026-07-03 18:00:00+00', 'AT&T Stadium',           'Arlington',       'USA'),    -- M88
  ('R32-15', timestamptz '2026-07-03 03:00:00+00', 'BC Place',               'Vancouver',       'Canada'), -- M85
  ('R32-16', timestamptz '2026-07-04 01:30:00+00', 'Arrowhead Stadium',      'Kansas City',     'USA'),    -- M87
  -- Round of 16
  ('R16-1',  timestamptz '2026-07-04 21:00:00+00', 'Lincoln Financial Field','Philadelphia',    'USA'),    -- M89
  ('R16-2',  timestamptz '2026-07-04 17:00:00+00', 'NRG Stadium',            'Houston',         'USA'),    -- M90
  ('R16-3',  timestamptz '2026-07-06 19:00:00+00', 'AT&T Stadium',           'Arlington',       'USA'),    -- M93
  ('R16-4',  timestamptz '2026-07-07 00:00:00+00', 'Lumen Field',            'Seattle',         'USA'),    -- M94
  ('R16-5',  timestamptz '2026-07-05 20:00:00+00', 'MetLife Stadium',        'East Rutherford', 'USA'),    -- M91
  ('R16-6',  timestamptz '2026-07-05 23:00:00+00', 'Estadio Azteca',         'Mexico City',     'Mexico'), -- M92
  ('R16-7',  timestamptz '2026-07-07 16:00:00+00', 'Mercedes-Benz Stadium',  'Atlanta',         'USA'),    -- M95
  ('R16-8',  timestamptz '2026-07-07 20:00:00+00', 'BC Place',               'Vancouver',       'Canada'), -- M96
  -- Quarter-finals
  ('QF-1',   timestamptz '2026-07-09 20:00:00+00', 'Gillette Stadium',       'Foxborough',      'USA'),    -- M97
  ('QF-2',   timestamptz '2026-07-10 19:00:00+00', 'SoFi Stadium',           'Inglewood',       'USA'),    -- M98
  ('QF-3',   timestamptz '2026-07-11 21:00:00+00', 'Hard Rock Stadium',      'Miami Gardens',   'USA'),    -- M99
  ('QF-4',   timestamptz '2026-07-12 01:00:00+00', 'Arrowhead Stadium',      'Kansas City',     'USA'),    -- M100
  -- Semi-finals
  ('SF-1',   timestamptz '2026-07-14 19:00:00+00', 'AT&T Stadium',           'Arlington',       'USA'),    -- M101
  ('SF-2',   timestamptz '2026-07-15 19:00:00+00', 'Mercedes-Benz Stadium',  'Atlanta',         'USA'),    -- M102
  -- Third-place + Final
  ('THIRD',  timestamptz '2026-07-18 21:00:00+00', 'Hard Rock Stadium',      'Miami Gardens',   'USA'),    -- M103
  ('FINAL',  timestamptz '2026-07-19 19:00:00+00', 'MetLife Stadium',        'East Rutherford', 'USA')     -- M104
) as v(slot, dt, stadium, city, country)
where m.slot_code = v.slot;
