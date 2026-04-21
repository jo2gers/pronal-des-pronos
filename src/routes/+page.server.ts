import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();

	const matchFields = 'id, home_team, away_team, home_flag, away_flag, stage, group_label, match_datetime, venue, status, home_score, away_score, odds_home, odds_draw, odds_away';

	const [{ data: liveMatches }, { data: nextMatch }, { data: upcomingMatches }, statsResult] =
		await Promise.all([
			supabase.from('matches').select(matchFields).eq('status', 'live').neq('home_team', 'TBD'),
			supabase.from('matches').select(matchFields).eq('status', 'upcoming').neq('home_team', 'TBD')
				.order('match_datetime', { ascending: true }).limit(1).maybeSingle(),
			supabase.from('matches').select(matchFields).eq('status', 'upcoming').neq('home_team', 'TBD')
				.order('match_datetime', { ascending: true }).limit(8),
			user
				? supabase.from('pronostics').select('match_id, predicted_home, predicted_away, points_earned').eq('user_id', user.id)
				: Promise.resolve({ data: null })
		]);

	let stats = null;
	let pronosticsMap: Record<string, { predicted_home: number; predicted_away: number }> = {};

	if (user && statsResult.data) {
		const pronostics = statsResult.data;
		pronosticsMap = Object.fromEntries(
			pronostics.map((p) => [p.match_id, { predicted_home: p.predicted_home, predicted_away: p.predicted_away }])
		);

		const pronoPoints = pronostics.reduce((sum, p) => sum + (p.points_earned ?? 0), 0);

		const { data: profileData } = await supabase
			.from('profiles').select('team_bonus_points').eq('id', user.id).single();

		const teamBonus   = profileData?.team_bonus_points ?? 0;
		const totalPoints = pronoPoints + teamBonus;

		const { count } = await supabase
			.from('pronostics').select('user_id', { count: 'exact', head: true }).gt('points_earned', pronoPoints);

		stats = { totalPoints, pronoPoints, teamBonus, pronosticsCount: pronostics.length, rank: (count ?? 0) + 1 };
	}

	return { liveMatches: liveMatches ?? [], nextMatch: nextMatch ?? null, upcomingMatches: upcomingMatches ?? [], stats, pronosticsMap, user };
};

export const actions: Actions = {
	pronostic: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user) return fail(401, { error: 'Non authentifié' });

		const form = await request.formData();
		const match_id       = form.get('match_id') as string;
		const predicted_home = parseInt(form.get('predicted_home') as string);
		const predicted_away = parseInt(form.get('predicted_away') as string);

		if (!match_id) return fail(400, { error: 'Match invalide' });
		if (isNaN(predicted_home) || isNaN(predicted_away) || predicted_home < 0 || predicted_away < 0)
			return fail(400, { error: 'Scores invalides', match_id });

		const { data: match } = await supabase
			.from('matches').select('match_datetime, status, odds_home, odds_draw, odds_away')
			.eq('id', match_id).single();

		if (!match || new Date(match.match_datetime).getTime() - Date.now() < 2 * 3600000)
			return fail(400, { error: 'Pronos fermés pour ce match', match_id });

		let odds_used = 1.0;
		const outcome = Math.sign(predicted_home - predicted_away);
		if (outcome > 0)       odds_used = match.odds_home ?? 1.0;
		else if (outcome === 0) odds_used = match.odds_draw ?? 1.0;
		else                    odds_used = match.odds_away ?? 1.0;

		const { error: upsertError } = await supabase.from('pronostics').upsert(
			{ user_id: user.id, match_id, predicted_home, predicted_away, odds_used },
			{ onConflict: 'user_id,match_id' }
		);

		if (upsertError) return fail(500, { error: upsertError.message, match_id });
		return { success: true, match_id, predicted_home, predicted_away };
	}
};
