import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

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
					.select('match_id, predicted_home, predicted_away, points_earned, is_scored')
					.eq('user_id', user.id)
			: Promise.resolve({ data: [] })
	]);

	const pronosticsMap = Object.fromEntries(
		(pronosticsResult.data ?? []).map((p) => [
			p.match_id,
			{ predicted_home: p.predicted_home, predicted_away: p.predicted_away, points_earned: p.points_earned, is_scored: p.is_scored }
		])
	);

	return { matches: matches ?? [], pronosticsMap, user };
};

export const actions: Actions = {
	pronostic: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user) return fail(401, { error: 'Non authentifié' });

		const form = await request.formData();
		const match_id = form.get('match_id') as string;
		const predicted_home = parseInt(form.get('predicted_home') as string);
		const predicted_away = parseInt(form.get('predicted_away') as string);

		if (!match_id) return fail(400, { error: 'Match invalide' });
		if (isNaN(predicted_home) || isNaN(predicted_away) || predicted_home < 0 || predicted_away < 0) {
			return fail(400, { error: 'Scores invalides', match_id });
		}

		// Verify match is still open (2h before kickoff)
		const { data: match } = await supabase
			.from('matches')
			.select('match_datetime, status, odds_home, odds_draw, odds_away')
			.eq('id', match_id)
			.single();

		if (!match || new Date(match.match_datetime).getTime() - Date.now() < 2 * 3600000) {
			return fail(400, { error: 'Pronos fermés pour ce match', match_id });
		}

		// Compute odds_used from stored odds
		let odds_used = 1.0;
		const outcome = Math.sign(predicted_home - predicted_away);
		if (outcome > 0)      odds_used = match.odds_home ?? 1.0;
		else if (outcome === 0) odds_used = match.odds_draw ?? 1.0;
		else                  odds_used = match.odds_away ?? 1.0;

		const { error: upsertError } = await supabase
			.from('pronostics')
			.upsert(
				{ user_id: user.id, match_id, predicted_home, predicted_away, odds_used },
				{ onConflict: 'user_id,match_id' }
			);

		if (upsertError) return fail(500, { error: upsertError.message, match_id });
		return { success: true, match_id, predicted_home, predicted_away };
	}
};
