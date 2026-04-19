import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();

	const [{ data: matches }, pronosticsResult] = await Promise.all([
		supabase
			.from('matches')
			.select(`
				id, home_team, away_team, home_flag, away_flag,
				stage, group_label, match_datetime, venue, status,
				home_score, away_score, odds_home, odds_draw, odds_away
			`)
			.order('match_datetime', { ascending: true }),
		user
			? supabase
					.from('pronostics')
					.select('match_id, predicted_home, predicted_away')
					.eq('user_id', user.id)
			: Promise.resolve({ data: [] })
	]);

	const pronosticsMap = Object.fromEntries(
		(pronosticsResult.data ?? []).map((p) => [
			p.match_id,
			{ predicted_home: p.predicted_home, predicted_away: p.predicted_away }
		])
	);

	return { matches: matches ?? [], pronosticsMap, user };
};
