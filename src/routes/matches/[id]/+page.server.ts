import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();

	const [{ data: match }, oddsResult, pronosticResult] = await Promise.all([
		supabase
			.from('matches')
			.select('*')
			.eq('id', params.id)
			.single(),
		supabase
			.from('odds_cache')
			.select('*')
			.eq('match_id', params.id)
			.maybeSingle(),
		user
			? supabase
					.from('pronostics')
					.select('*')
					.eq('match_id', params.id)
					.eq('user_id', user.id)
					.maybeSingle()
			: Promise.resolve({ data: null })
	]);

	if (!match) error(404, 'Match introuvable');

	let allPronostics = null;
	if (match.status === 'finished') {
		const { data } = await supabase
			.from('pronostics')
			.select('*, profiles(username, display_name, avatar_url)')
			.eq('match_id', params.id)
			.order('points_earned', { ascending: false });
		allPronostics = data;
	}

	return {
		match,
		odds: oddsResult.data,
		userPronostic: pronosticResult.data,
		allPronostics,
		user
	};
};

export const actions: Actions = {
	pronostic: async ({ params, request, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user) return fail(401, { error: 'Non authentifié' });

		const form = await request.formData();
		const predicted_home = parseInt(form.get('predicted_home') as string);
		const predicted_away = parseInt(form.get('predicted_away') as string);

		if (isNaN(predicted_home) || isNaN(predicted_away) || predicted_home < 0 || predicted_away < 0) {
			return fail(400, { error: 'Scores invalides' });
		}

		// Check match is not locked
		const { data: match } = await supabase
			.from('matches')
			.select('match_datetime, status')
			.eq('id', params.id)
			.single();

		if (!match || new Date(match.match_datetime) <= new Date()) {
			return fail(400, { error: 'Les pronostics sont fermés pour ce match' });
		}

		// Fetch current odds to store as odds_used
		const { data: odds } = await supabase
			.from('odds_cache')
			.select('home_win, draw, away_win')
			.eq('match_id', params.id)
			.maybeSingle();

		let odds_used = 1.0;
		if (odds) {
			const outcome = Math.sign(predicted_home - predicted_away);
			if (outcome > 0) odds_used = odds.home_win ?? 1.0;
			else if (outcome === 0) odds_used = odds.draw ?? 1.0;
			else odds_used = odds.away_win ?? 1.0;
		}

		const { error: upsertError } = await supabase
			.from('pronostics')
			.upsert(
				{
					user_id: user.id,
					match_id: params.id,
					predicted_home,
					predicted_away,
					odds_used
				},
				{ onConflict: 'user_id,match_id' }
			);

		if (upsertError) return fail(500, { error: upsertError.message });
		return { success: true };
	}
};
