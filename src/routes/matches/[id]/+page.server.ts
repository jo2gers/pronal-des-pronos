import { error, fail } from '@sveltejs/kit';
import { effectiveStatus, resolveOddsUsed } from '$lib/utils';
import { STAGE_BONUS } from '$lib/server/scoring';
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

	// Past-kickoff but still 'upcoming' in DB → render the detail page as live
	// (locks picks, shows live score block) until the admin updates the row.
	if (match.status === 'upcoming') {
		(match as any).status = effectiveStatus(match as any);
	}

	// All matches (id/time) for the previous/next on-page arrow + swipe nav.
	const { data: stageRows } = await supabase.from('matches').select('id, stage, status, match_datetime');

	// Prev/next match in chronological order (id tiebreak so same-kickoff matches
	// are deterministic). Null at the ends → the arrow is disabled.
	const ordered = (stageRows ?? []).slice().sort((a: any, b: any) => {
		const ta = new Date(a.match_datetime).getTime();
		const tb = new Date(b.match_datetime).getTime();
		return ta - tb || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
	});
	const curIdx = ordered.findIndex((m: any) => m.id === params.id);
	const prevMatchId = curIdx > 0 ? ordered[curIdx - 1].id : null;
	const nextMatchId = curIdx >= 0 && curIdx < ordered.length - 1 ? ordered[curIdx + 1].id : null;

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

	// Once the match is locked (5 min before kickoff), everyone's picks become
	// public — RLS opens them at the same cutoff. Ordered by points for finished
	// matches, by name otherwise (nothing is scored yet).
	const matchLocked =
		match.status === 'live' ||
		match.status === 'finished' ||
		new Date(match.match_datetime).getTime() - Date.now() < 5 * 60000;

	let allPronostics = null;
	let matchBonus: { amount: number; winnerTeam: string } | null = null;

	if (matchLocked && match.home_team !== 'TBD') {
		const { data } = await supabase
			.from('pronostics')
			.select('user_id, predicted_home, predicted_away, points_earned, is_scored, profiles(id, username, display_name, avatar_url, favorite_team)')
			.eq('match_id', params.id);

		allPronostics = (data ?? []).sort((a, b) => {
			const pa = a.is_scored ? (a.points_earned ?? 0) : -1;
			const pb = b.is_scored ? (b.points_earned ?? 0) : -1;
			if (pb !== pa) return pb - pa;
			const na = ((a.profiles as any)?.display_name ?? (a.profiles as any)?.username ?? '').toLowerCase();
			const nb = ((b.profiles as any)?.display_name ?? (b.profiles as any)?.username ?? '').toLowerCase();
			return na.localeCompare(nb);
		});
	}

	// Team bonus annotation only makes sense once the result exists.
	if (match.status === 'finished') {
		// STAGE_BONUS is the same table scoreMatch awards from — one source of
		// truth (it must mirror the rules page).
		const stageBonus = STAGE_BONUS[match.stage] ?? 0;

		// The bonus follows who ADVANCED: penalties > extra time > 90-min —
		// a shootout win must annotate too, not read as a 90' draw.
		let winnerTeam: string | null = null;
		if (match.home_score != null && match.away_score != null) {
			const effH = (match as any).pen_home ?? (match as any).ft_home_score ?? match.home_score;
			const effA = (match as any).pen_away ?? (match as any).ft_away_score ?? match.away_score;
			if (effH > effA) winnerTeam = match.home_team;
			else if (effA > effH) winnerTeam = match.away_team;
		}

		if (winnerTeam && stageBonus > 0) {
			const { data: oddsRow } = await supabase
				.from('wc_winner_odds')
				.select('multiplier')
				.eq('team_name_en', winnerTeam)
				.maybeSingle();
			const multiplier = parseFloat(String(oddsRow?.multiplier ?? 1.0));
			matchBonus = {
				amount: parseFloat((stageBonus * multiplier).toFixed(2)),
				winnerTeam
			};
		}
	}

	// The viewer's leagues + their member lists → per-league filter tabs on the
	// pronostics list. Two cheap queries (league count per user is tiny).
	let myLeagues: { id: string; name: string; memberIds: string[] }[] = [];
	if (user && allPronostics) {
		const { data: memberships } = await supabase
			.from('group_members')
			.select('group_id, groups(id, name)')
			.eq('user_id', user.id);

		const groupIds = (memberships ?? []).map((m) => m.group_id);
		if (groupIds.length > 0) {
			const { data: allMembers } = await supabase
				.from('group_members')
				.select('group_id, user_id')
				.in('group_id', groupIds);

			myLeagues = (memberships ?? []).map((m) => ({
				id: m.group_id,
				name: (m.groups as any)?.name ?? '?',
				memberIds: (allMembers ?? [])
					.filter((r) => r.group_id === m.group_id)
					.map((r) => r.user_id)
			}));
		}
	}

	return {
		match,
		prevMatchId,
		nextMatchId,
		userPronostic: pronosticResult.data,
		allPronostics,
		matchBonus,
		friendIds,
		myLeagues,
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
			.select('match_datetime, status, home_team, away_team, stage, odds_home, odds_draw, odds_away')
			.eq('id', params.id)
			.single();

		if (!match || new Date(match.match_datetime).getTime() - Date.now() < 5 * 60000)
			return fail(400, { error: 'Les pronostics sont fermés pour ce match' });
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
