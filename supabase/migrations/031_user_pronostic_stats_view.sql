-- Per-user scored-pronostic aggregates, computed in Postgres so the leaderboard /
-- home rank / rank snapshots / league boards never re-sum thousands of rows in JS
-- and never hit PostgREST's 1000-row response cap (the GROUP BY returns one row
-- per user). security_invoker = true → respects the caller's RLS, and scored picks
-- are public (RLS opens them once the match is locked), so totals come out true.
create or replace view public.user_pronostic_stats
with (security_invoker = true) as
select
	p.user_id,
	coalesce(sum(p.points_earned), 0)::numeric as prono_points,
	count(*)::int as picks,
	count(*) filter (
		where p.predicted_home = m.home_score and p.predicted_away = m.away_score
	)::int as exact,
	count(*) filter (
		where not (p.predicted_home = m.home_score and p.predicted_away = m.away_score)
			and sign(p.predicted_home - p.predicted_away) = sign(m.home_score - m.away_score)
	)::int as winners
from public.pronostics p
join public.matches m on m.id = p.match_id
where p.is_scored = true
	and m.home_score is not null
	and m.away_score is not null
group by p.user_id;

grant select on public.user_pronostic_stats to anon, authenticated, service_role;
