import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();

	const [{ data: match }, pronosticResult] = await Promise.all([
		supabase.from('matches').select('*').eq('id', params.id).single(),
		user
			? supabase.from('pronostics').select('*').eq('match_id', params.id).eq('user_id', user.id).maybeSingle()
			: Promise.resolve({ data: null })
	]);

	if (!match) error(404, 'Match introuvable');

	// Load friend IDs for the current user
	let friendIds: string[] = [];
	if (user) {
		const { data: friendships } = await supabase
			.from('friendships')
			.select('requester_id, addressee_id')
			.eq('status', 'accepted')
			.or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);
		friendIds = (friendships ?? []).map((f) =>
			f.requester_id === user.id ? f.addressee_id : f.requester_id
		);
	}

	// After match: load all pronostics ordered by points
	let allPronostics = null;
	if (match.status === 'finished') {
		const { data } = await supabase
			.from('pronostics')
			.select('user_id, predicted_home, predicted_away, points_earned, is_scored, profiles(id, username, display_name, avatar_url)')
			.eq('match_id', params.id)
			.eq('is_scored', true)
			.order('points_earned', { ascending: false });
		allPronostics = data;
	}

	return {
		match,
		userPronostic: pronosticResult.data,
		allPronostics,
		friendIds,
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

		if (isNaN(predicted_home) || isNaN(predicted_away) || predicted_home < 0 || predicted_away < 0)
			return fail(400, { error: 'Scores invalides' });

		const { data: match } = await supabase
			.from('matches')
			.select('match_datetime, status, odds_home, odds_draw, odds_away')
			.eq('id', params.id)
			.single();

		if (!match || new Date(match.match_datetime).getTime() - Date.now() < 2 * 3600000)
			return fail(400, { error: 'Les pronostics sont fermés pour ce match' });

		let odds_used = 1.0;
		const outcome = Math.sign(predicted_home - predicted_away);
		if (outcome > 0)        odds_used = match.odds_home ?? 1.0;
		else if (outcome === 0) odds_used = match.odds_draw ?? 1.0;
		else                    odds_used = match.odds_away ?? 1.0;

		const { error: upsertError } = await supabase
			.from('pronostics')
			.upsert(
				{ user_id: user.id, match_id: params.id, predicted_home, predicted_away, odds_used },
				{ onConflict: 'user_id,match_id' }
			);

		if (upsertError) return fail(500, { error: upsertError.message });
		return { success: true };
	}
};
