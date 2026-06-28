-- Migration 034: correct the Round-of-32 bracket to the ACTUAL published 2026
-- World Cup fixtures.
--
-- Migration 032 rewired R32 from a Wikipedia position-bracket that turned out to
-- be transcribed wrong, so several pairings were still incorrect (e.g. it had
-- USA vs Japan and Brazil vs a 3rd-place team; the real fixtures are USA vs
-- Bosnia and Brazil vs Japan). This migration anchors on the ACTUAL fixtures,
-- which are now published and triple-confirmed (Wikipedia + SI.com + Polymarket
-- markets). The app's group standings already match reality, so the fix is to
-- map each official match to a slot and set the correct source positions.
--
-- Official R32 (FIFA match no. → slot_code → fixture / positions; positions per
-- the live group standings):
--   M73 R32-1  South Africa(2A) v Canada(2B)
--   M75 R32-2  Netherlands(1F)  v Morocco(2D)
--   M74 R32-3  Germany(1E)      v Paraguay(3C)
--   M77 R32-4  France(1I)       v Sweden(3F)
--   M83 R32-5  Portugal(2L)     v Croatia(2K)
--   M84 R32-6  Spain(1G)        v Austria(2J)
--   M81 R32-7  United States(1C)v Bosnia(3B)
--   M82 R32-8  Belgium(1H)      v Senegal(3I)
--   M76 R32-9  Brazil(1D)       v Japan(2F)
--   M78 R32-10 Ivory Coast(2E)  v Norway(2I)
--   M79 R32-11 Mexico(1A)       v Ecuador(3E)
--   M80 R32-12 England(1K)      v DR Congo(3L)
--   M86 R32-13 Argentina(1J)    v Cape Verde(2G)
--   M88 R32-14 Australia(2C)    v Egypt(2H)
--   M85 R32-15 Switzerland(1B)  v Algeria(3J)
--   M87 R32-16 Colombia(1L)     v Ghana(3K)
-- This slot layout keeps the existing sequential R16→Final feed (W_R32-1 +
-- W_R32-2 → R16-1, …) exactly isomorphic to the official tree, so R16+ rows and
-- their migration-033 dates need no change.
--
-- Third-place teams are now known, so instead of the deferred Annex C algorithm
-- we wire each "vs 3rd" slot straight to the qualifying third's GROUP via a new
-- `3_<group>` source token (resolved below). The 8 qualifying thirds came from
-- groups B, C, E, F, I, J, K, L.

-- 1. Teach resolve_source about "3_<group>" = the 3rd-placed team of that group.
create or replace function public.resolve_source(p_src text)
 returns table(team text, flag text)
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_grp text;
  v_rank int;
begin
  if p_src is null then return; end if;

  if p_src ~ '^W_[A-L]$' then
    v_grp := substring(p_src from 3 for 1);
    if not public.is_group_complete(v_grp) then return; end if;
    return query
      select s.team, s.flag from public.compute_group_standings() s
      where s.group_label = v_grp and s.pos = 1;
    return;
  end if;

  if p_src ~ '^R_[A-L]$' then
    v_grp := substring(p_src from 3 for 1);
    if not public.is_group_complete(v_grp) then return; end if;
    return query
      select s.team, s.flag from public.compute_group_standings() s
      where s.group_label = v_grp and s.pos = 2;
    return;
  end if;

  -- 3rd-placed team of a specific group (Annex C assignment, hard-wired from the
  -- actual published R32 fixtures).
  if p_src ~ '^3_[A-L]$' then
    v_grp := substring(p_src from 3 for 1);
    if not public.is_group_complete(v_grp) then return; end if;
    return query
      select s.team, s.flag from public.compute_group_standings() s
      where s.group_label = v_grp and s.pos = 3;
    return;
  end if;

  if p_src ~ '^T[1-8]$' then
    if not public.is_group_phase_complete() then return; end if;
    v_rank := substring(p_src from 2)::int;
    return query
      select bt.team, bt.flag from public.compute_best_thirds() bt
      where bt.rank = v_rank;
    return;
  end if;

  if p_src like 'W_%' then
    return query select * from public.slot_winner(substring(p_src from 3));
    return;
  end if;

  if p_src like 'L_%' then
    return query select * from public.slot_loser(substring(p_src from 3));
    return;
  end if;
end;
$function$;

-- 2. Correct the R32 template sources.
update bracket_template set home_source = 'R_A', away_source = 'R_B' where slot_code = 'R32-1';
update bracket_template set home_source = 'W_F', away_source = 'R_D' where slot_code = 'R32-2';
update bracket_template set home_source = 'W_E', away_source = '3_C' where slot_code = 'R32-3';
update bracket_template set home_source = 'W_I', away_source = '3_F' where slot_code = 'R32-4';
update bracket_template set home_source = 'R_L', away_source = 'R_K' where slot_code = 'R32-5';
update bracket_template set home_source = 'W_G', away_source = 'R_J' where slot_code = 'R32-6';
update bracket_template set home_source = 'W_C', away_source = '3_B' where slot_code = 'R32-7';
update bracket_template set home_source = 'W_H', away_source = '3_I' where slot_code = 'R32-8';
update bracket_template set home_source = 'W_D', away_source = 'R_F' where slot_code = 'R32-9';
update bracket_template set home_source = 'R_E', away_source = 'R_I' where slot_code = 'R32-10';
update bracket_template set home_source = 'W_A', away_source = '3_E' where slot_code = 'R32-11';
update bracket_template set home_source = 'W_K', away_source = '3_L' where slot_code = 'R32-12';
update bracket_template set home_source = 'W_J', away_source = 'R_G' where slot_code = 'R32-13';
update bracket_template set home_source = 'R_C', away_source = 'R_H' where slot_code = 'R32-14';
update bracket_template set home_source = 'W_B', away_source = '3_J' where slot_code = 'R32-15';
update bracket_template set home_source = 'W_L', away_source = '3_K' where slot_code = 'R32-16';

-- 3. Push the corrected sources + correct kickoff/venue onto the live R32 rows
--    and clear the teams so resolve_bracket() refills them from standings.
update matches m set
  home_source = v.hs, away_source = v.as_,
  home_team = 'TBD', away_team = 'TBD', home_flag = null, away_flag = null,
  match_datetime = v.dt, venue = v.stadium, venue_city = v.city, venue_country = v.country
from (values
  ('R32-1',  'R_A', 'R_B', timestamptz '2026-06-28 19:00:00+00', 'SoFi Stadium',          'Inglewood',       'USA'),
  ('R32-2',  'W_F', 'R_D', timestamptz '2026-06-30 00:00:00+00', 'Estadio BBVA',          'Guadalupe',       'Mexico'),
  ('R32-3',  'W_E', '3_C', timestamptz '2026-06-29 20:30:00+00', 'Gillette Stadium',      'Foxborough',      'USA'),
  ('R32-4',  'W_I', '3_F', timestamptz '2026-06-30 21:00:00+00', 'MetLife Stadium',       'East Rutherford', 'USA'),
  ('R32-5',  'R_L', 'R_K', timestamptz '2026-07-02 23:00:00+00', 'BMO Field',             'Toronto',         'Canada'),
  ('R32-6',  'W_G', 'R_J', timestamptz '2026-07-02 19:00:00+00', 'SoFi Stadium',          'Inglewood',       'USA'),
  ('R32-7',  'W_C', '3_B', timestamptz '2026-07-02 00:00:00+00', 'Levi''s Stadium',       'Santa Clara',     'USA'),
  ('R32-8',  'W_H', '3_I', timestamptz '2026-07-01 20:00:00+00', 'Lumen Field',           'Seattle',         'USA'),
  ('R32-9',  'W_D', 'R_F', timestamptz '2026-06-29 17:00:00+00', 'NRG Stadium',           'Houston',         'USA'),
  ('R32-10', 'R_E', 'R_I', timestamptz '2026-06-30 17:00:00+00', 'AT&T Stadium',          'Arlington',       'USA'),
  ('R32-11', 'W_A', '3_E', timestamptz '2026-07-01 00:00:00+00', 'Estadio Azteca',        'Mexico City',     'Mexico'),
  ('R32-12', 'W_K', '3_L', timestamptz '2026-07-01 16:00:00+00', 'Mercedes-Benz Stadium', 'Atlanta',         'USA'),
  ('R32-13', 'W_J', 'R_G', timestamptz '2026-07-03 22:00:00+00', 'Hard Rock Stadium',     'Miami Gardens',   'USA'),
  ('R32-14', 'R_C', 'R_H', timestamptz '2026-07-03 18:00:00+00', 'AT&T Stadium',          'Arlington',       'USA'),
  ('R32-15', 'W_B', '3_J', timestamptz '2026-07-03 03:00:00+00', 'BC Place',              'Vancouver',       'Canada'),
  ('R32-16', 'W_L', '3_K', timestamptz '2026-07-04 01:30:00+00', 'Arrowhead Stadium',     'Kansas City',     'USA')
) as v(slot, hs, as_, dt, stadium, city, country)
where m.slot_code = v.slot;
