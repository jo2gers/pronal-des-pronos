-- 038: slot_winner / slot_loser return NULL on an effective draw.
--
-- A knockout match can never truly end level. If the EFFECTIVE result
-- (penalties > extra time > 90') is equal, the real outcome isn't captured yet
-- (shootout / ET pending, or a stale score at the finish-transition). In that
-- case these functions must return NULL so resolve_bracket leaves the downstream
-- slot TBD and re-resolves once the real result lands — instead of advancing the
-- HOME side on the old `>=` tiebreak.
--
-- Bug this fixes: France beat Morocco 0-2 in QF-1, but resolve_bracket had run
-- during a momentary 0-0 at the finish-transition, so slot_winner('QF-1')
-- returned the home team (Morocco) and SF-1 was filled with Morocco. Because
-- resolve_bracket only fills TBD slots, the later 0-2 never corrected it.
-- (Pairs with the scoreMatch fix that keeps bonus_calculated=false on a
-- knockout effective-draw so the team bonus isn't locked to a null winner.)

create or replace function public.slot_winner(p_slot text)
returns table(team text, flag text)
language sql stable security definer set search_path to 'public'
as $function$
  select
    case
      when m.status <> 'finished' or m.home_score is null or m.away_score is null then null
      when coalesce(m.pen_home, m.ft_home_score, m.home_score) > coalesce(m.pen_away, m.ft_away_score, m.away_score) then m.home_team
      when coalesce(m.pen_away, m.ft_away_score, m.away_score) > coalesce(m.pen_home, m.ft_home_score, m.home_score) then m.away_team
      else null
    end,
    case
      when m.status <> 'finished' or m.home_score is null or m.away_score is null then null
      when coalesce(m.pen_home, m.ft_home_score, m.home_score) > coalesce(m.pen_away, m.ft_away_score, m.away_score) then m.home_flag
      when coalesce(m.pen_away, m.ft_away_score, m.away_score) > coalesce(m.pen_home, m.ft_home_score, m.home_score) then m.away_flag
      else null
    end
  from matches m where m.slot_code = p_slot;
$function$;

create or replace function public.slot_loser(p_slot text)
returns table(team text, flag text)
language sql stable security definer set search_path to 'public'
as $function$
  select
    case
      when m.status <> 'finished' or m.home_score is null or m.away_score is null then null
      when coalesce(m.pen_home, m.ft_home_score, m.home_score) > coalesce(m.pen_away, m.ft_away_score, m.away_score) then m.away_team
      when coalesce(m.pen_away, m.ft_away_score, m.away_score) > coalesce(m.pen_home, m.ft_home_score, m.home_score) then m.home_team
      else null
    end,
    case
      when m.status <> 'finished' or m.home_score is null or m.away_score is null then null
      when coalesce(m.pen_home, m.ft_home_score, m.home_score) > coalesce(m.pen_away, m.ft_away_score, m.away_score) then m.away_flag
      when coalesce(m.pen_away, m.ft_away_score, m.away_score) > coalesce(m.pen_home, m.ft_home_score, m.home_score) then m.home_flag
      else null
    end
  from matches m where m.slot_code = p_slot;
$function$;
