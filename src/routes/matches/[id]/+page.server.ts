import { error, fail } from '@sveltejs/kit';
import { effectiveStatus, resolveOddsUsed } from '$lib/utils';
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

	// After match: load all pronostics ordered by points, plus compute the
	// team bonus this specific match awarded to supporters of the winning team.
	// Bonus only exists for decisive group-stage / knockout wins (no draws).
	let allPronostics = null;
	let matchBonus: { amount: number; winnerTeam: string } | null = null;
	if (match.status === 'finished') {
		const { data } = await supabase
			.from('pronostics')
			.select('user_id, predicted_home, predicted_away, points_earned, is_scored, profiles(id, username, display_name, avatar_url, favorite_team)')
			.eq('match_id', params.id)
			.eq('is_scored', true)
			.order('points_earned', { ascending: false });
		allPronostics = data;

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

	return {
		match,
		userPronostic: pronosticResult.data,
		allPronostics,
		matchBonus,
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
			.select('match_datetime, status, home_team, away_team, odds_home, odds_draw, odds_away')
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
