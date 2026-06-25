-- Migration 032: correct the Round-of-32 bracket pairings to the OFFICIAL
-- FIFA World Cup 2026 bracket.
--
-- The original bracket_template wired a naive placeholder bracket (pair slot 1
-- with 2, 3 with 4, … and drop the 8 best thirds into fixed rank slots T1-T8).
-- That does NOT match FIFA's published 2026 bracket, so the app showed the wrong
-- knockout opponents — e.g. it had "1E vs 2B" (Germany vs Canada) when the
-- official Round of 32 Match 73 is "2A vs 2B" (South Africa vs Canada).
--
-- The official R32 pairings (FIFA match numbers 73-88), verified against
-- Wikipedia / FIFA.com / ESPN, mapped onto our existing slot_codes so that the
-- R16→Final feed (W_R32-1 + W_R32-2 → R16-1, etc.) stays correct without change
-- (the slot tree is isomorphic to the official bracket):
--
--   slot    official match   pairing
--   R32-1   M74              1E vs 3rd
--   R32-2   M77              1I vs 3rd
--   R32-3   M73              2A vs 2B
--   R32-4   M75              1F vs 2C
--   R32-5   M83              2K vs 2L
--   R32-6   M84              1H vs 2J
--   R32-7   M81              1D vs 3rd
--   R32-8   M82              1G vs 3rd
--   R32-9   M76              1C vs 2F
--   R32-10  M78              2E vs 2I
--   R32-11  M79              1A vs 3rd
--   R32-12  M80              1L vs 3rd
--   R32-13  M86              1J vs 2H
--   R32-14  M88              2D vs 2G
--   R32-15  M85              1B vs 3rd
--   R32-16  M87              1K vs 3rd
--
-- The 8 third-place slots' away side is parked on a placeholder token (TH<match>)
-- that resolve_source does not yet handle, so those slots stay TBD until the
-- official Annex C third-place assignment is implemented in a follow-up
-- migration. (The old T1-T8 fixed-rank mechanism was wrong and is retired here.)

update bracket_template set home_source = 'W_E', away_source = 'TH74' where slot_code = 'R32-1';
update bracket_template set home_source = 'W_I', away_source = 'TH77' where slot_code = 'R32-2';
update bracket_template set home_source = 'R_A', away_source = 'R_B'  where slot_code = 'R32-3';
update bracket_template set home_source = 'W_F', away_source = 'R_C'  where slot_code = 'R32-4';
update bracket_template set home_source = 'R_K', away_source = 'R_L'  where slot_code = 'R32-5';
update bracket_template set home_source = 'W_H', away_source = 'R_J'  where slot_code = 'R32-6';
update bracket_template set home_source = 'W_D', away_source = 'TH81' where slot_code = 'R32-7';
update bracket_template set home_source = 'W_G', away_source = 'TH82' where slot_code = 'R32-8';
update bracket_template set home_source = 'W_C', away_source = 'R_F'  where slot_code = 'R32-9';
update bracket_template set home_source = 'R_E', away_source = 'R_I'  where slot_code = 'R32-10';
update bracket_template set home_source = 'W_A', away_source = 'TH79' where slot_code = 'R32-11';
update bracket_template set home_source = 'W_L', away_source = 'TH80' where slot_code = 'R32-12';
update bracket_template set home_source = 'W_J', away_source = 'R_H'  where slot_code = 'R32-13';
update bracket_template set home_source = 'R_D', away_source = 'R_G'  where slot_code = 'R32-14';
update bracket_template set home_source = 'W_B', away_source = 'TH85' where slot_code = 'R32-15';
update bracket_template set home_source = 'W_K', away_source = 'TH87' where slot_code = 'R32-16';

-- Mirror the corrected sources onto the live R32 match rows and clear any teams
-- the old (wrong) template had filled in, so resolve_bracket() refills them from
-- the corrected sources + current group standings. Knockout matches are unplayed
-- (status 'upcoming', no scores) and pronostics are keyed by match_id (they store
-- predicted scores, not opponent names), so resetting team names loses nothing.
update matches m
set home_source = bt.home_source,
    away_source = bt.away_source,
    home_team = 'TBD', away_team = 'TBD',
    home_flag = null,  away_flag = null
from bracket_template bt
where m.slot_code = bt.slot_code and bt.stage = 'round_of_32';
