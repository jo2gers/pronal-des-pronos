import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
	const team = decodeURIComponent(params.team);
	if (team === 'TBD') error(404, 'Équipe introuvable');

	// Quoted values keep PostgREST happy with names containing spaces
	// ("South Korea", "Bosnia and Herzegovina"…).
	const { data: matches } = await supabase
		.from('matches')
		.select('id, home_team, away_team, home_flag, away_flag, home_score, away_score, match_datetime, status, stage, group_label, venue')
		.or(`home_team.eq."${team}",away_team.eq."${team}"`)
		.order('match_datetime', { ascending: true });

	if (!matches || matches.length === 0) error(404, 'Équipe introuvable');

	// Flag + group label from any row where this team appears.
	const sample = matches[0];
	const flag = sample.home_team === team ? sample.home_flag : sample.away_flag;
	const groupLabel = matches.find((m) => m.stage === 'group')?.group_label ?? null;

	const finished = matches
		.filter((m) => m.status === 'finished' && m.home_score != null && m.away_score != null)
		.reverse(); // newest first
	const live = matches.find((m) => m.status === 'live') ?? null;
	const upcoming = matches.filter((m) => m.status === 'upcoming');

	// W/D/L + goals + clean sheets from this team's perspective
	let wins = 0, draws = 0, losses = 0, goalsFor = 0, goalsAgainst = 0, cleanSheets = 0;
	for (const m of finished) {
		const isHome = m.home_team === team;
		const gf = isHome ? m.home_score! : m.away_score!;
		const ga = isHome ? m.away_score! : m.home_score!;
		goalsFor += gf;
		goalsAgainst += ga;
		if (ga === 0) cleanSheets++;
		if (gf > ga) wins++;
		else if (gf === ga) draws++;
		else losses++;
	}

	// Flavour stats: WC-winner odds (frozen at tournament start) + how many
	// Tifo users picked this team as their favorite.
	const [{ data: oddsRow }, { count: supporters }] = await Promise.all([
		supabase
			.from('wc_winner_odds')
			.select('odds, multiplier')
			.eq('team_name_en', team)
			.maybeSingle(),
		supabase
			.from('profiles')
			.select('*', { count: 'exact', head: true })
			.eq('favorite_team', team)
	]);

	return {
		team,
		flag,
		groupLabel,
		live,
		upcoming,
		finished,
		winnerOdds: oddsRow ? parseFloat(String(oddsRow.odds)) : null,
		multiplier: oddsRow ? parseFloat(String(oddsRow.multiplier)) : null,
		supporters: supporters ?? 0,
		stats: {
			played: finished.length,
			wins,
			draws,
			losses,
			goalsFor,
			goalsAgainst,
			diff: goalsFor - goalsAgainst,
			cleanSheets
		}
	};
};
