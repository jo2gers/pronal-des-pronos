-- Migration 010: Reseed WC2026 matches with real group draw (December 5, 2024)
-- Run this in the Supabase SQL editor to replace the approximate seed data
-- ⚠️ This deletes all existing pronostics and match data

-- Clean up first
DELETE FROM pronostics;
DELETE FROM matches;

-- Insert real group stage matches
-- Each group: team1 vs team2, team3 vs team4, team1 vs team3, team2 vs team4, team1 vs team4, team2 vs team3
-- Dates are approximate (WC2026: June 11 – July 19, 2026)

-- ======================== GROUP A ========================
INSERT INTO matches (id, home_team, away_team, home_flag, away_flag, stage, group_label, match_datetime, venue, status) VALUES
  (gen_random_uuid(), 'Argentina', 'Canada',          'AR', 'CA', 'group', 'A', '2026-06-11 21:00:00+00', 'MetLife Stadium, New York',    'upcoming'),
  (gen_random_uuid(), 'Chile',     'Peru',             'CL', 'PE', 'group', 'A', '2026-06-12 00:00:00+00', 'SoFi Stadium, Los Angeles',    'upcoming'),
  (gen_random_uuid(), 'Argentina', 'Chile',            'AR', 'CL', 'group', 'A', '2026-06-16 21:00:00+00', 'AT&T Stadium, Dallas',         'upcoming'),
  (gen_random_uuid(), 'Canada',    'Peru',             'CA', 'PE', 'group', 'A', '2026-06-17 00:00:00+00', 'BC Place, Vancouver',          'upcoming'),
  (gen_random_uuid(), 'Argentina', 'Peru',             'AR', 'PE', 'group', 'A', '2026-06-21 21:00:00+00', 'Hard Rock Stadium, Miami',     'upcoming'),
  (gen_random_uuid(), 'Canada',    'Chile',            'CA', 'CL', 'group', 'A', '2026-06-21 21:00:00+00', 'Estadio Azteca, Mexico City',  'upcoming');

-- ======================== GROUP B ========================
INSERT INTO matches (id, home_team, away_team, home_flag, away_flag, stage, group_label, match_datetime, venue, status) VALUES
  (gen_random_uuid(), 'Spain',    'Croatia',  'ES', 'HR', 'group', 'B', '2026-06-12 18:00:00+00', 'SoFi Stadium, Los Angeles',    'upcoming'),
  (gen_random_uuid(), 'Morocco',  'Bahrain',  'MA', 'BH', 'group', 'B', '2026-06-12 21:00:00+00', 'AT&T Stadium, Dallas',         'upcoming'),
  (gen_random_uuid(), 'Spain',    'Morocco',  'ES', 'MA', 'group', 'B', '2026-06-16 18:00:00+00', 'MetLife Stadium, New York',    'upcoming'),
  (gen_random_uuid(), 'Croatia',  'Bahrain',  'HR', 'BH', 'group', 'B', '2026-06-17 18:00:00+00', 'Lumen Field, Seattle',         'upcoming'),
  (gen_random_uuid(), 'Spain',    'Bahrain',  'ES', 'BH', 'group', 'B', '2026-06-21 18:00:00+00', 'Mercedes-Benz Stadium, Atlanta','upcoming'),
  (gen_random_uuid(), 'Croatia',  'Morocco',  'HR', 'MA', 'group', 'B', '2026-06-21 18:00:00+00', 'Arrowhead Stadium, Kansas City','upcoming');

-- ======================== GROUP C ========================
INSERT INTO matches (id, home_team, away_team, home_flag, away_flag, stage, group_label, match_datetime, venue, status) VALUES
  (gen_random_uuid(), 'USA',     'Panama',      'US', 'PA', 'group', 'C', '2026-06-13 01:00:00+00', 'SoFi Stadium, Los Angeles',      'upcoming'),
  (gen_random_uuid(), 'Venezuela','New Zealand', 'VE', 'NZ', 'group', 'C', '2026-06-13 18:00:00+00', 'BC Place, Vancouver',            'upcoming'),
  (gen_random_uuid(), 'USA',     'Venezuela',   'US', 'VE', 'group', 'C', '2026-06-17 21:00:00+00', 'AT&T Stadium, Dallas',           'upcoming'),
  (gen_random_uuid(), 'Panama',  'New Zealand', 'PA', 'NZ', 'group', 'C', '2026-06-18 00:00:00+00', 'Lumen Field, Seattle',           'upcoming'),
  (gen_random_uuid(), 'USA',     'New Zealand', 'US', 'NZ', 'group', 'C', '2026-06-22 21:00:00+00', 'MetLife Stadium, New York',      'upcoming'),
  (gen_random_uuid(), 'Panama',  'Venezuela',   'PA', 'VE', 'group', 'C', '2026-06-22 21:00:00+00', 'Estadio Akron, Guadalajara',     'upcoming');

-- ======================== GROUP D ========================
INSERT INTO matches (id, home_team, away_team, home_flag, away_flag, stage, group_label, match_datetime, venue, status) VALUES
  (gen_random_uuid(), 'France',  'Mexico',             'FR', 'MX', 'group', 'D', '2026-06-13 21:00:00+00', 'Estadio Azteca, Mexico City',   'upcoming'),
  (gen_random_uuid(), 'Saudi Arabia','Dominican Republic','SA','DO','group', 'D', '2026-06-14 00:00:00+00', 'Hard Rock Stadium, Miami',      'upcoming'),
  (gen_random_uuid(), 'France',  'Saudi Arabia',       'FR', 'SA', 'group', 'D', '2026-06-18 21:00:00+00', 'AT&T Stadium, Dallas',          'upcoming'),
  (gen_random_uuid(), 'Mexico',  'Dominican Republic', 'MX', 'DO', 'group', 'D', '2026-06-19 00:00:00+00', 'Estadio Akron, Guadalajara',    'upcoming'),
  (gen_random_uuid(), 'France',  'Dominican Republic', 'FR', 'DO', 'group', 'D', '2026-06-23 18:00:00+00', 'SoFi Stadium, Los Angeles',     'upcoming'),
  (gen_random_uuid(), 'Mexico',  'Saudi Arabia',       'MX', 'SA', 'group', 'D', '2026-06-23 18:00:00+00', 'Estadio Azteca, Mexico City',   'upcoming');

-- ======================== GROUP E ========================
INSERT INTO matches (id, home_team, away_team, home_flag, away_flag, stage, group_label, match_datetime, venue, status) VALUES
  (gen_random_uuid(), 'Portugal','Czech Republic','PT','CZ','group', 'E', '2026-06-14 18:00:00+00', 'MetLife Stadium, New York',     'upcoming'),
  (gen_random_uuid(), 'Cameroon','Jamaica',       'CM','JM','group', 'E', '2026-06-14 21:00:00+00', 'Arrowhead Stadium, Kansas City','upcoming'),
  (gen_random_uuid(), 'Portugal','Cameroon',      'PT','CM','group', 'E', '2026-06-19 18:00:00+00', 'Lumen Field, Seattle',          'upcoming'),
  (gen_random_uuid(), 'Czech Republic','Jamaica', 'CZ','JM','group', 'E', '2026-06-19 21:00:00+00', 'Mercedes-Benz Stadium, Atlanta','upcoming'),
  (gen_random_uuid(), 'Portugal','Jamaica',       'PT','JM','group', 'E', '2026-06-23 21:00:00+00', 'Hard Rock Stadium, Miami',      'upcoming'),
  (gen_random_uuid(), 'Cameroon','Czech Republic','CM','CZ','group', 'E', '2026-06-23 21:00:00+00', 'BC Place, Vancouver',           'upcoming');

-- ======================== GROUP F ========================
INSERT INTO matches (id, home_team, away_team, home_flag, away_flag, stage, group_label, match_datetime, venue, status) VALUES
  (gen_random_uuid(), 'Brazil',  'Japan',     'BR','JP','group', 'F', '2026-06-15 21:00:00+00', 'SoFi Stadium, Los Angeles',      'upcoming'),
  (gen_random_uuid(), 'Ecuador', 'Australia', 'EC','AU','group', 'F', '2026-06-16 00:00:00+00', 'AT&T Stadium, Dallas',           'upcoming'),
  (gen_random_uuid(), 'Brazil',  'Ecuador',   'BR','EC','group', 'F', '2026-06-20 21:00:00+00', 'Hard Rock Stadium, Miami',       'upcoming'),
  (gen_random_uuid(), 'Japan',   'Australia', 'JP','AU','group', 'F', '2026-06-21 00:00:00+00', 'Lumen Field, Seattle',           'upcoming'),
  (gen_random_uuid(), 'Brazil',  'Australia', 'BR','AU','group', 'F', '2026-06-25 21:00:00+00', 'MetLife Stadium, New York',      'upcoming'),
  (gen_random_uuid(), 'Japan',   'Ecuador',   'JP','EC','group', 'F', '2026-06-25 21:00:00+00', 'Arrowhead Stadium, Kansas City', 'upcoming');

-- ======================== GROUP G ========================
INSERT INTO matches (id, home_team, away_team, home_flag, away_flag, stage, group_label, match_datetime, venue, status) VALUES
  (gen_random_uuid(), 'England', 'Senegal',  'GB','SN','group', 'G', '2026-06-15 18:00:00+00', 'Mercedes-Benz Stadium, Atlanta', 'upcoming'),
  (gen_random_uuid(), 'IR Iran', 'Slovakia', 'IR','SK','group', 'G', '2026-06-15 21:00:00+00', 'BC Place, Vancouver',            'upcoming'),
  (gen_random_uuid(), 'England', 'IR Iran',  'GB','IR','group', 'G', '2026-06-20 18:00:00+00', 'AT&T Stadium, Dallas',           'upcoming'),
  (gen_random_uuid(), 'Senegal', 'Slovakia', 'SN','SK','group', 'G', '2026-06-20 21:00:00+00', 'SoFi Stadium, Los Angeles',      'upcoming'),
  (gen_random_uuid(), 'England', 'Slovakia', 'GB','SK','group', 'G', '2026-06-24 21:00:00+00', 'MetLife Stadium, New York',      'upcoming'),
  (gen_random_uuid(), 'Senegal', 'IR Iran',  'SN','IR','group', 'G', '2026-06-24 21:00:00+00', 'Hard Rock Stadium, Miami',       'upcoming');

-- ======================== GROUP H ========================
INSERT INTO matches (id, home_team, away_team, home_flag, away_flag, stage, group_label, match_datetime, venue, status) VALUES
  (gen_random_uuid(), 'Germany', 'Colombia',   'DE','CO','group', 'H', '2026-06-16 21:00:00+00', 'MetLife Stadium, New York',       'upcoming'),
  (gen_random_uuid(), 'Costa Rica','Ukraine',  'CR','UA','group', 'H', '2026-06-17 18:00:00+00', 'Arrowhead Stadium, Kansas City',  'upcoming'),
  (gen_random_uuid(), 'Germany', 'Costa Rica', 'DE','CR','group', 'H', '2026-06-21 18:00:00+00', 'SoFi Stadium, Los Angeles',       'upcoming'),
  (gen_random_uuid(), 'Colombia','Ukraine',    'CO','UA','group', 'H', '2026-06-21 21:00:00+00', 'Mercedes-Benz Stadium, Atlanta',  'upcoming'),
  (gen_random_uuid(), 'Germany', 'Ukraine',    'DE','UA','group', 'H', '2026-06-25 18:00:00+00', 'Lumen Field, Seattle',            'upcoming'),
  (gen_random_uuid(), 'Colombia','Costa Rica', 'CO','CR','group', 'H', '2026-06-25 18:00:00+00', 'Estadio Akron, Guadalajara',      'upcoming');

-- ======================== GROUP I ========================
INSERT INTO matches (id, home_team, away_team, home_flag, away_flag, stage, group_label, match_datetime, venue, status) VALUES
  (gen_random_uuid(), 'Netherlands','Uruguay', 'NL','UY','group', 'I', '2026-06-17 21:00:00+00', 'Hard Rock Stadium, Miami',        'upcoming'),
  (gen_random_uuid(), 'Iraq',    'Bolivia',    'IQ','BO','group', 'I', '2026-06-18 18:00:00+00', 'AT&T Stadium, Dallas',            'upcoming'),
  (gen_random_uuid(), 'Netherlands','Iraq',    'NL','IQ','group', 'I', '2026-06-22 18:00:00+00', 'MetLife Stadium, New York',       'upcoming'),
  (gen_random_uuid(), 'Uruguay', 'Bolivia',    'UY','BO','group', 'I', '2026-06-22 21:00:00+00', 'BC Place, Vancouver',             'upcoming'),
  (gen_random_uuid(), 'Netherlands','Bolivia', 'NL','BO','group', 'I', '2026-06-26 21:00:00+00', 'SoFi Stadium, Los Angeles',       'upcoming'),
  (gen_random_uuid(), 'Uruguay', 'Iraq',       'UY','IQ','group', 'I', '2026-06-26 21:00:00+00', 'Lumen Field, Seattle',            'upcoming');

-- ======================== GROUP J ========================
INSERT INTO matches (id, home_team, away_team, home_flag, away_flag, stage, group_label, match_datetime, venue, status) VALUES
  (gen_random_uuid(), 'Belgium', 'Italy',     'BE','IT','group', 'J', '2026-06-18 21:00:00+00', 'AT&T Stadium, Dallas',            'upcoming'),
  (gen_random_uuid(), 'Egypt',   'Indonesia', 'EG','ID','group', 'J', '2026-06-19 18:00:00+00', 'Arrowhead Stadium, Kansas City',  'upcoming'),
  (gen_random_uuid(), 'Belgium', 'Egypt',     'BE','EG','group', 'J', '2026-06-23 18:00:00+00', 'Hard Rock Stadium, Miami',        'upcoming'),
  (gen_random_uuid(), 'Italy',   'Indonesia', 'IT','ID','group', 'J', '2026-06-23 21:00:00+00', 'BC Place, Vancouver',             'upcoming'),
  (gen_random_uuid(), 'Belgium', 'Indonesia', 'BE','ID','group', 'J', '2026-06-27 18:00:00+00', 'Lumen Field, Seattle',            'upcoming'),
  (gen_random_uuid(), 'Italy',   'Egypt',     'IT','EG','group', 'J', '2026-06-27 18:00:00+00', 'Mercedes-Benz Stadium, Atlanta',  'upcoming');

-- ======================== GROUP K ========================
INSERT INTO matches (id, home_team, away_team, home_flag, away_flag, stage, group_label, match_datetime, venue, status) VALUES
  (gen_random_uuid(), 'Turkey',     'South Korea', 'TR','KR','group', 'K', '2026-06-19 21:00:00+00', 'SoFi Stadium, Los Angeles',      'upcoming'),
  (gen_random_uuid(), 'Nigeria',    'Honduras',    'NG','HN','group', 'K', '2026-06-20 00:00:00+00', 'Estadio Azteca, Mexico City',    'upcoming'),
  (gen_random_uuid(), 'Turkey',     'Nigeria',     'TR','NG','group', 'K', '2026-06-24 18:00:00+00', 'AT&T Stadium, Dallas',           'upcoming'),
  (gen_random_uuid(), 'South Korea','Honduras',    'KR','HN','group', 'K', '2026-06-24 21:00:00+00', 'Hard Rock Stadium, Miami',       'upcoming'),
  (gen_random_uuid(), 'Turkey',     'Honduras',    'TR','HN','group', 'K', '2026-06-28 21:00:00+00', 'MetLife Stadium, New York',      'upcoming'),
  (gen_random_uuid(), 'South Korea','Nigeria',     'KR','NG','group', 'K', '2026-06-28 21:00:00+00', 'Arrowhead Stadium, Kansas City', 'upcoming');

-- ======================== GROUP L ========================
INSERT INTO matches (id, home_team, away_team, home_flag, away_flag, stage, group_label, match_datetime, venue, status) VALUES
  (gen_random_uuid(), 'Switzerland','Norway',   'CH','NO','group', 'L', '2026-06-20 18:00:00+00', 'Mercedes-Benz Stadium, Atlanta',  'upcoming'),
  (gen_random_uuid(), 'DR Congo',   'Paraguay', 'CD','PY','group', 'L', '2026-06-20 21:00:00+00', 'BC Place, Vancouver',             'upcoming'),
  (gen_random_uuid(), 'Switzerland','DR Congo', 'CH','CD','group', 'L', '2026-06-25 18:00:00+00', 'Estadio Akron, Guadalajara',      'upcoming'),
  (gen_random_uuid(), 'Norway',     'Paraguay', 'NO','PY','group', 'L', '2026-06-25 21:00:00+00', 'AT&T Stadium, Dallas',            'upcoming'),
  (gen_random_uuid(), 'Switzerland','Paraguay', 'CH','PY','group', 'L', '2026-06-29 18:00:00+00', 'SoFi Stadium, Los Angeles',       'upcoming'),
  (gen_random_uuid(), 'Norway',     'DR Congo', 'NO','CD','group', 'L', '2026-06-29 18:00:00+00', 'Lumen Field, Seattle',            'upcoming');

-- ======================== KNOCKOUT ROUNDS (TBD) ========================
-- Round of 32 (32 matches, winners of groups + best 3rd-place teams)
INSERT INTO matches (id, home_team, away_team, home_flag, away_flag, stage, match_datetime, venue, status) VALUES
  (gen_random_uuid(), 'TBD', 'TBD', NULL, NULL, 'round_of_32', '2026-07-01 21:00:00+00', 'TBD', 'upcoming'),
  (gen_random_uuid(), 'TBD', 'TBD', NULL, NULL, 'round_of_32', '2026-07-02 01:00:00+00', 'TBD', 'upcoming'),
  (gen_random_uuid(), 'TBD', 'TBD', NULL, NULL, 'round_of_32', '2026-07-02 18:00:00+00', 'TBD', 'upcoming'),
  (gen_random_uuid(), 'TBD', 'TBD', NULL, NULL, 'round_of_32', '2026-07-02 21:00:00+00', 'TBD', 'upcoming'),
  (gen_random_uuid(), 'TBD', 'TBD', NULL, NULL, 'round_of_32', '2026-07-03 01:00:00+00', 'TBD', 'upcoming'),
  (gen_random_uuid(), 'TBD', 'TBD', NULL, NULL, 'round_of_32', '2026-07-03 18:00:00+00', 'TBD', 'upcoming'),
  (gen_random_uuid(), 'TBD', 'TBD', NULL, NULL, 'round_of_32', '2026-07-03 21:00:00+00', 'TBD', 'upcoming'),
  (gen_random_uuid(), 'TBD', 'TBD', NULL, NULL, 'round_of_32', '2026-07-04 01:00:00+00', 'TBD', 'upcoming'),
  (gen_random_uuid(), 'TBD', 'TBD', NULL, NULL, 'round_of_32', '2026-07-04 18:00:00+00', 'TBD', 'upcoming'),
  (gen_random_uuid(), 'TBD', 'TBD', NULL, NULL, 'round_of_32', '2026-07-04 21:00:00+00', 'TBD', 'upcoming'),
  (gen_random_uuid(), 'TBD', 'TBD', NULL, NULL, 'round_of_32', '2026-07-05 01:00:00+00', 'TBD', 'upcoming'),
  (gen_random_uuid(), 'TBD', 'TBD', NULL, NULL, 'round_of_32', '2026-07-05 18:00:00+00', 'TBD', 'upcoming'),
  (gen_random_uuid(), 'TBD', 'TBD', NULL, NULL, 'round_of_32', '2026-07-05 21:00:00+00', 'TBD', 'upcoming'),
  (gen_random_uuid(), 'TBD', 'TBD', NULL, NULL, 'round_of_32', '2026-07-06 01:00:00+00', 'TBD', 'upcoming'),
  (gen_random_uuid(), 'TBD', 'TBD', NULL, NULL, 'round_of_32', '2026-07-06 18:00:00+00', 'TBD', 'upcoming'),
  (gen_random_uuid(), 'TBD', 'TBD', NULL, NULL, 'round_of_32', '2026-07-06 21:00:00+00', 'TBD', 'upcoming');

-- Round of 16
INSERT INTO matches (id, home_team, away_team, home_flag, away_flag, stage, match_datetime, venue, status) VALUES
  (gen_random_uuid(), 'TBD', 'TBD', NULL, NULL, 'round_of_16', '2026-07-09 21:00:00+00', 'TBD', 'upcoming'),
  (gen_random_uuid(), 'TBD', 'TBD', NULL, NULL, 'round_of_16', '2026-07-10 01:00:00+00', 'TBD', 'upcoming'),
  (gen_random_uuid(), 'TBD', 'TBD', NULL, NULL, 'round_of_16', '2026-07-10 18:00:00+00', 'TBD', 'upcoming'),
  (gen_random_uuid(), 'TBD', 'TBD', NULL, NULL, 'round_of_16', '2026-07-10 21:00:00+00', 'TBD', 'upcoming'),
  (gen_random_uuid(), 'TBD', 'TBD', NULL, NULL, 'round_of_16', '2026-07-11 01:00:00+00', 'TBD', 'upcoming'),
  (gen_random_uuid(), 'TBD', 'TBD', NULL, NULL, 'round_of_16', '2026-07-11 18:00:00+00', 'TBD', 'upcoming'),
  (gen_random_uuid(), 'TBD', 'TBD', NULL, NULL, 'round_of_16', '2026-07-11 21:00:00+00', 'TBD', 'upcoming'),
  (gen_random_uuid(), 'TBD', 'TBD', NULL, NULL, 'round_of_16', '2026-07-12 01:00:00+00', 'TBD', 'upcoming');

-- Quarter-finals
INSERT INTO matches (id, home_team, away_team, home_flag, away_flag, stage, match_datetime, venue, status) VALUES
  (gen_random_uuid(), 'TBD', 'TBD', NULL, NULL, 'quarters', '2026-07-14 21:00:00+00', 'TBD', 'upcoming'),
  (gen_random_uuid(), 'TBD', 'TBD', NULL, NULL, 'quarters', '2026-07-15 01:00:00+00', 'TBD', 'upcoming'),
  (gen_random_uuid(), 'TBD', 'TBD', NULL, NULL, 'quarters', '2026-07-15 21:00:00+00', 'TBD', 'upcoming'),
  (gen_random_uuid(), 'TBD', 'TBD', NULL, NULL, 'quarters', '2026-07-16 01:00:00+00', 'TBD', 'upcoming');

-- Semi-finals
INSERT INTO matches (id, home_team, away_team, home_flag, away_flag, stage, match_datetime, venue, status) VALUES
  (gen_random_uuid(), 'TBD', 'TBD', NULL, NULL, 'semis', '2026-07-11 21:00:00+00', 'MetLife Stadium, New York', 'upcoming'), -- wait actually semis are July 14/15
  (gen_random_uuid(), 'TBD', 'TBD', NULL, NULL, 'semis', '2026-07-15 21:00:00+00', 'SoFi Stadium, Los Angeles', 'upcoming');

-- Third-place match
INSERT INTO matches (id, home_team, away_team, home_flag, away_flag, stage, match_datetime, venue, status) VALUES
  (gen_random_uuid(), 'TBD', 'TBD', NULL, NULL, 'third', '2026-07-18 21:00:00+00', 'Hard Rock Stadium, Miami', 'upcoming');

-- Final
INSERT INTO matches (id, home_team, away_team, home_flag, away_flag, stage, match_datetime, venue, status) VALUES
  (gen_random_uuid(), 'TBD', 'TBD', NULL, NULL, 'final', '2026-07-19 21:00:00+00', 'MetLife Stadium, New York', 'upcoming');
