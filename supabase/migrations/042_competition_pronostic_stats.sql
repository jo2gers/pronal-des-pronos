-- 042: per-competition score aggregation for the V2 leaderboards. Additive —
-- the archive's user_pronostic_stats view is untouched; this is the same
-- semantics (prono_points / picks / exact / winners, security_invoker) with a
-- competition_id grouping key so each competition ranks separately.
create view public.competition_pronostic_stats
with (security_invoker = true) as
select
  m.competition_id,
  p.user_id,
  coalesce(sum(p.points_earned), 0::numeric) as prono_points,
  count(*)::integer as picks,
  count(*) filter (
    where p.predicted_home = m.home_score and p.predicted_away = m.away_score
  )::integer as exact,
  count(*) filter (
    where not (p.predicted_home = m.home_score and p.predicted_away = m.away_score)
      and sign((p.predicted_home - p.predicted_away)::double precision)
        = sign((m.home_score - m.away_score)::double precision)
  )::integer as winners
from pronostics p
join matches m on m.id = p.match_id
where p.is_scored = true and m.home_score is not null and m.away_score is not null
group by m.competition_id, p.user_id;

grant select on public.competition_pronostic_stats to anon, authenticated, service_role;
