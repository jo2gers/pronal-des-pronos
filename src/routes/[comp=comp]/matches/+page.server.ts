import { fail } from '@sveltejs/kit';
import { resolveOddsUsed } from '$lib/utils';
import type { Actions, PageServerLoad } from './$types';

const MATCH_COLS =
	'id, home_team, away_team, match_datetime, status, home_score, away_score, odds_home, odds_draw, odds_away, venue, matchday, stage';

export const load: PageServerLoad = async ({ parent, url, locals: { supabase, safeGetSession } }) => {
	const { competition } = await parent();
	const { user } = await safeGetSession();

	// League formats are paged ONE MATCHDAY at a time. Rendering all 38 journées
	// meant ~380 pick rows (with crests) in a single document — heavy on mobile,
	// and it always landed the reader on Journée 1 instead of the one being
	// played. Resolve the matchday range + the CURRENT one server-side, then
	// fetch only that page.
	const [{ data: firstMd }, { data: lastMd }, { data: nextUnplayed }, { count: totalMatches }] =
		await Promise.all([
			supabase.from('matches').select('matchday').eq('competition_id', competition.id)
				.not('matchday', 'is', null).order('matchday', { ascending: true }).limit(1).maybeSingle(),
			supabase.from('matches').select('matchday').eq('competition_id', competition.id)
				.not('matchday', 'is', null).order('matchday', { ascending: false }).limit(1).maybeSingle(),
			// The current matchday = the one holding the next match still to be
			// played (chronologically). A postponed fixture keeps its own matchday
			// number, so ordering by kickoff — not by matchday — is what tracks
			// "where the season actually is".
			supabase.from('matches').select('matchday').eq('competition_id', competition.id)
				.not('matchday', 'is', null).neq('status', 'finished')
				.order('match_datetime', { ascending: true }).limit(1).maybeSingle(),
			supabase.from('matches').select('id', { count: 'exact', head: true })
				.eq('competition_id', competition.id)
		]);

	const minMatchday = (firstMd?.matchday as number | null) ?? null;
	const maxMatchday = (lastMd?.matchday as number | null) ?? null;
	const hasMatchdays = minMatchday != null && maxMatchday != null;

	// Season not started → next unplayed is matchday 1; season over → clamp to the
	// last one so the page still shows real fixtures instead of an empty state.
	const currentMatchday = hasMatchdays
		? ((nextUnplayed?.matchday as number | null) ?? maxMatchday)
		: null;

	const requested = Number.parseInt(url.searchParams.get('j') ?? '', 10);
	const selectedMatchday =
		hasMatchdays
			? Number.isFinite(requested) && requested >= minMatchday! && requested <= maxMatchday!
				? requested
				: currentMatchday
			: null;

	const matchQuery = supabase.from('matches').select(MATCH_COLS).eq('competition_id', competition.id);
	const [{ data: matches }, { data: teams }] = await Promise.all([
		(selectedMatchday != null
			? matchQuery.eq('matchday', selectedMatchday)
			: matchQuery
		).order('match_datetime', { ascending: true }),
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

	return {
		matches: matches ?? [],
		teamMap,
		pronosticsMap,
		user,
		minMatchday,
		maxMatchday,
		currentMatchday,
		selectedMatchday,
		totalMatches: totalMatches ?? 0
	};
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
