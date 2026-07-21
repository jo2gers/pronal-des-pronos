import { fail } from '@sveltejs/kit';
import { resolveOddsUsed } from '$lib/utils';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, locals: { supabase, safeGetSession } }) => {
	const { competition } = await parent();
	const { user } = await safeGetSession();

	const [{ data: matches }, { data: teams }] = await Promise.all([
		supabase
			.from('matches')
			.select(
				'id, home_team, away_team, match_datetime, status, home_score, away_score, odds_home, odds_draw, odds_away, venue, matchday, stage'
			)
			.eq('competition_id', competition.id)
			.order('match_datetime', { ascending: true }),
		supabase
			.from('competition_teams')
			.select('name_en, short_name, logo_url')
			.eq('competition_id', competition.id)
	]);

	// name → {short, logo} for the club badges (V2 competitions have crests,
	// not the country flags the WC archive uses).
	const teamMap: Record<string, { short: string | null; logo: string | null }> = {};
	for (const t of teams ?? []) teamMap[t.name_en] = { short: t.short_name, logo: t.logo_url };

	// The signed-in user's picks on this competition's matches.
	let pronosticsMap: Record<string, { predicted_home: number; predicted_away: number }> = {};
	if (user && (matches ?? []).length > 0) {
		const ids = (matches ?? []).map((m) => m.id);
		const { data: pronos } = await supabase
			.from('pronostics')
			.select('match_id, predicted_home, predicted_away')
			.eq('user_id', user.id)
			.in('match_id', ids);
		for (const p of pronos ?? [])
			pronosticsMap[p.match_id] = { predicted_home: p.predicted_home, predicted_away: p.predicted_away };
	}

	return { matches: matches ?? [], teamMap, pronosticsMap, user };
};

export const actions: Actions = {
	// Same contract as the archive pick action: lock 5 min before kickoff,
	// teams must be known. V2 fixtures always have real teams, but the guard
	// stays (a future UCL knockout slot could be TBD).
	pronostic: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user) return fail(401, { error: 'Non authentifié' });

		const form = await request.formData();
		const match_id = form.get('match_id') as string;
		const predicted_home = parseInt(form.get('predicted_home') as string);
		const predicted_away = parseInt(form.get('predicted_away') as string);

		if (!match_id) return fail(400, { error: 'Match invalide' });
		if (isNaN(predicted_home) || isNaN(predicted_away) || predicted_home < 0 || predicted_away < 0)
			return fail(400, { error: 'Scores invalides', match_id });

		const { data: match } = await supabase
			.from('matches')
			.select('match_datetime, status, home_team, away_team, odds_home, odds_draw, odds_away')
			.eq('id', match_id)
			.single();

		if (!match || new Date(match.match_datetime).getTime() - Date.now() < 5 * 60000)
			return fail(400, { error: 'Pronos fermés pour ce match', match_id });
		if (match.home_team === 'TBD' || match.away_team === 'TBD')
			return fail(400, { error: 'Équipes pas encore déterminées', match_id });

		const odds_used = resolveOddsUsed(predicted_home, predicted_away, match);

		const { error: upsertError } = await supabase
			.from('pronostics')
			.upsert(
				{ user_id: user.id, match_id, predicted_home, predicted_away, odds_used },
				{ onConflict: 'user_id,match_id' }
			);

		if (upsertError) return fail(500, { error: upsertError.message, match_id });
		return { success: true };
	}
};
