import { error, fail } from '@sveltejs/kit';
import { resolveOddsUsed, MATCH_LOCK_MS } from '$lib/utils';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent, locals: { supabase, safeGetSession } }) => {
	const { competition } = await parent();
	const { user } = await safeGetSession();

	const { data: match } = await supabase
		.from('matches')
		.select(
			'id, competition_id, home_team, away_team, match_datetime, status, home_score, away_score, odds_home, odds_draw, odds_away, scoreline_multipliers, venue, venue_city, matchday, stage, live_period, live_elapsed, last_score_sync_at, live_events'
		)
		.eq('id', params.id)
		.maybeSingle();

	// The URL's competition must own the match — no cross-competition leakage.
	if (!match || match.competition_id !== competition.id) error(404, 'Match introuvable');

	const [{ data: teams }, pronoRes] = await Promise.all([
		supabase
			.from('competition_teams')
			.select('name_en, short_name, logo_url')
			.eq('competition_id', competition.id)
			.in('name_en', [match.home_team, match.away_team]),
		user
			? supabase
					.from('pronostics')
					.select('predicted_home, predicted_away, points_earned, is_scored, exact_multiplier')
					.eq('match_id', match.id)
					.eq('user_id', user.id)
					.maybeSingle()
			: Promise.resolve({ data: null })
	]);

	const teamMap: Record<string, { short: string | null; logo: string | null }> = {};
	for (const t of teams ?? []) teamMap[t.name_en] = { short: t.short_name, logo: t.logo_url };

	// Community picks become public at the lock (RLS opens them then, same rule
	// as the archive): everyone's pick + name, ordered by points once scored.
	const locked =
		match.status !== 'upcoming' || new Date(match.match_datetime).getTime() - Date.now() < MATCH_LOCK_MS;
	let allPronostics: any[] | null = null;
	if (locked) {
		const { data } = await supabase
			.from('pronostics')
			.select('user_id, predicted_home, predicted_away, points_earned, is_scored, exact_multiplier, profiles(id, username, display_name, avatar_url)')
			.eq('match_id', match.id);
		allPronostics = (data ?? []).sort((a: any, b: any) => {
			const pa = a.is_scored ? (a.points_earned ?? 0) : -1;
			const pb = b.is_scored ? (b.points_earned ?? 0) : -1;
			if (pb !== pa) return pb - pa;
			const na = (a.profiles?.display_name ?? a.profiles?.username ?? '').toLowerCase();
			const nb = (b.profiles?.display_name ?? b.profiles?.username ?? '').toLowerCase();
			return na.localeCompare(nb);
		});
	}

	return { match, teamMap, userProno: pronoRes.data ?? null, allPronostics, locked, user };
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
			.select('match_datetime, status, home_team, away_team, odds_home, odds_draw, odds_away')
			.eq('id', params.id)
			.single();

		if (!match || new Date(match.match_datetime).getTime() - Date.now() < MATCH_LOCK_MS)
			return fail(400, { error: 'Pronos fermés pour ce match' });
		if (match.home_team === 'TBD' || match.away_team === 'TBD')
			return fail(400, { error: 'Équipes pas encore déterminées' });

		const odds_used = resolveOddsUsed(predicted_home, predicted_away, match);
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
