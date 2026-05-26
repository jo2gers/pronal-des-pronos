import { fail } from '@sveltejs/kit';
import { createServerClient } from '@supabase/ssr';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { resolveOddsUsed } from '$lib/utils';
import { syncLiveScores } from '$lib/server/syncLiveScores';
import type { Actions, PageServerLoad } from './$types';

function adminClient() {
	return createServerClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
		cookies: { getAll: () => [], setAll: () => {} }
	});
}

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	const nowIso = new Date().toISOString();

	// Pull fresh live scores from Polymarket before reading matches. Rate-
	// limited inside syncLiveScores to 1 actual fetch per 20s per instance,
	// so concurrent page loads coalesce. Failures are swallowed so a Polymarket
	// hiccup never breaks the homepage.
	try {
		await syncLiveScores(adminClient());
	} catch {
		// non-fatal — render with last-known scores
	}

	const matchFields = 'id, home_team, away_team, home_flag, away_flag, stage, group_label, match_datetime, venue, status, home_score, away_score, odds_home, odds_draw, odds_away';

	// Phantom-live: status still 'upcoming' but kickoff has passed (admin
	// hasn't flipped to 'live' yet). Pull those separately and merge into the
	// live list with status overridden so the homepage shows the LIVE card
	// instead of leaving the match as "next match" or first in upcoming.
	const [{ data: liveMatches }, { data: phantomLive }, { data: nextMatch }, { data: upcomingMatches }, { data: finishedMatches }, statsResult] =
		await Promise.all([
			supabase.from('matches').select(matchFields).eq('status', 'live').neq('home_team', 'TBD'),
			supabase.from('matches').select(matchFields).eq('status', 'upcoming').neq('home_team', 'TBD')
				.lte('match_datetime', nowIso),
			supabase.from('matches').select(matchFields).eq('status', 'upcoming').neq('home_team', 'TBD')
				.gt('match_datetime', nowIso).order('match_datetime', { ascending: true }).limit(1).maybeSingle(),
			supabase.from('matches').select(matchFields).eq('status', 'upcoming').neq('home_team', 'TBD')
				.gt('match_datetime', nowIso).order('match_datetime', { ascending: true }).limit(5),
			supabase.from('matches').select(matchFields).eq('status', 'finished').neq('home_team', 'TBD')
				.order('match_datetime', { ascending: false }).limit(3),
			user
				? supabase.from('pronostics').select('match_id, predicted_home, predicted_away, points_earned, is_scored, odds_used').eq('user_id', user.id)
				: Promise.resolve({ data: null })
		]);

	const allLive = [
		...(liveMatches ?? []),
		...((phantomLive ?? []).map((m) => ({ ...m, status: 'live' as const })))
	];

	let stats = null;
	let pronosticsMap: Record<string, { predicted_home: number; predicted_away: number; points_earned: number | null; is_scored: boolean; odds_used: number | null }> = {};

	if (user && statsResult.data) {
		const pronostics = statsResult.data;
		pronosticsMap = Object.fromEntries(
			pronostics.map((p) => [p.match_id, {
				predicted_home: p.predicted_home,
				predicted_away: p.predicted_away,
				points_earned: p.points_earned,
				is_scored: p.is_scored,
				odds_used: (p as any).odds_used ?? null
			}])
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

	return {
		liveMatches: allLive,
		nextMatch: nextMatch ?? null,
		upcomingMatches: upcomingMatches ?? [],
		finishedMatches: (finishedMatches ?? []).reverse(),
		stats,
		pronosticsMap,
		user
	};
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
			.from('matches').select('match_datetime, status, home_team, away_team, odds_home, odds_draw, odds_away')
			.eq('id', match_id).single();

		if (!match || new Date(match.match_datetime).getTime() - Date.now() < 5 * 60000)
			return fail(400, { error: 'Pronos fermés pour ce match', match_id });
		if (match.home_team === 'TBD' || match.away_team === 'TBD')
			return fail(400, { error: 'Équipes pas encore déterminées', match_id });

		const odds_used = resolveOddsUsed(predicted_home, predicted_away, match);

		const { error: upsertError } = await supabase.from('pronostics').upsert(
			{ user_id: user.id, match_id, predicted_home, predicted_away, odds_used },
			{ onConflict: 'user_id,match_id' }
		);

		if (upsertError) return fail(500, { error: upsertError.message, match_id });
		return { success: true, match_id, predicted_home, predicted_away };
	}
};
