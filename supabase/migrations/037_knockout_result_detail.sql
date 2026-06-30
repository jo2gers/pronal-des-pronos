-- Migration 037: knockout result detail (extra time + penalties).
--
-- Predictions are graded on the 90-minute (regulation) score, kept in
-- home_score/away_score. But a knockout can be decided in extra time or on
-- penalties, and we need that to (a) show who actually advanced and (b) resolve
-- the bracket to the RIGHT team. New columns:
--   ft_home_score / ft_away_score  — score after extra time (120'), null if none
--   pen_home / pen_away            — penalty shootout result, null if none
--   knockout_result_synced         — guard so the ESPN summary is fetched once

alter table public.matches
  add column if not exists ft_home_score int,
  add column if not exists ft_away_score int,
  add column if not exists pen_home int,
  add column if not exists pen_away int,
  add column if not exists knockout_result_synced boolean not null default false;

-- slot_winner / slot_loser now compare the EFFECTIVE result — penalties beat
-- extra-time beat the 90-min score — so a match drawn at 90' but decided on
-- penalties advances the team that actually won, not the home side on `>=`.
create or replace function public.slot_winner(p_slot text)
 returns table(team text, flag text)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select
    case when m.status='finished' and m.home_score is not null and m.away_score is not null then
      case when coalesce(m.pen_home, m.ft_home_score, m.home_score) >= coalesce(m.pen_away, m.ft_away_score, m.away_score)
        then m.home_team else m.away_team end
    end,
    case when m.status='finished' and m.home_score is not null and m.away_score is not null then
      case when coalesce(m.pen_home, m.ft_home_score, m.home_score) >= coalesce(m.pen_away, m.ft_away_score, m.away_score)
        then m.home_flag else m.away_flag end
    end
  from matches m where m.slot_code = p_slot;
$function$;

create or replace function public.slot_loser(p_slot text)
 returns table(team text, flag text)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select
    case when m.status='finished' and m.home_score is not null and m.away_score is not null then
      case when coalesce(m.pen_home, m.ft_home_score, m.home_score) < coalesce(m.pen_away, m.ft_away_score, m.away_score)
        then m.home_team else m.away_team end
    end,
    case when m.status='finished' and m.home_score is not null and m.away_score is not null then
      case when coalesce(m.pen_home, m.ft_home_score, m.home_score) < coalesce(m.pen_away, m.ft_away_score, m.away_score)
        then m.home_flag else m.away_flag end
    end
  from matches m where m.slot_code = p_slot;
$function$;
