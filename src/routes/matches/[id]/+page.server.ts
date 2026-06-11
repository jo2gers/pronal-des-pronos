import { error, fail } from '@sveltejs/kit';
import { effectiveStatus, resolveOddsUsed, computeStageUnlocks, STAGE_PROGRESSION } from '$lib/utils';
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

	// Stage gate: knockout matches stay locked until the previous round is
	// fully finished. One small query covers it.
	const { data: stageRows } = await supabase.from('matches').select('stage, status');
	const stageUnlocks = computeStageUnlocks((stageRows ?? []) as any[]);
	(match as any).stage_locked = !(stageUnlocks[(match as any).stage] ?? true);

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
		const STAGE_BONUS: Record<string, number> = {
			group: 1, round_of_32: 2, round_of_16: 3, quarters: 5, semis: 8, final: 13, third: 3
		};
		const stageBonus = STAGE_BONUS[match.stage] ?? 0;

		let winnerTeam: string | null = null;
		if (match.home_score != null && match.away_score != null) {
			if (match.home_score > match.away_score) winnerTeam = match.home_team;
			else if (match.away_score > match.home_score) winnerTeam = match.away_team;
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

		// Stage gate — previous round must be fully finished.
		const prevStage = STAGE_PROGRESSION[(match as any).stage];
		if (prevStage) {
			const { count: prevUnfinished } = await supabase
				.from('matches').select('*', { count: 'exact', head: true })
				.eq('stage', prevStage).neq('status', 'finished');
			if ((prevUnfinished ?? 0) > 0) {
				return fail(400, { error: 'Tour précédent pas encore terminé' });
			}
		}

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
