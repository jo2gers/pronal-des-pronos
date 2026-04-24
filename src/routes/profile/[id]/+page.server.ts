import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();

	const { data: profile } = await supabase
		.from('profiles')
		.select('id, username, display_name, avatar_url, favorite_team, country, team_bonus_points')
		.eq('id', params.id)
		.single();

	if (!profile) error(404, 'Profil introuvable');

	// Fetch ALL pronostics (scored ones for history, + count of unscored ones)
	const { data: pronostics } = await supabase
		.from('pronostics')
		.select(`
			id, predicted_home, predicted_away, points_earned, is_scored,
			match:matches(id, home_team, away_team, home_flag, away_flag, home_score, away_score, match_datetime, stage, status)
		`)
		.eq('user_id', params.id);

	const scored    = (pronostics ?? []).filter((p) => p.is_scored).sort((a, b) => {
		const dateA = new Date((a.match as any)?.match_datetime ?? 0).getTime();
		const dateB = new Date((b.match as any)?.match_datetime ?? 0).getTime();
		return dateB - dateA; // Newest first
	});
	const pronoPoints = scored.reduce((sum, p) => sum + (p.points_earned ?? 0), 0);
	const teamBonus   = profile.team_bonus_points ?? 0;
	const totalPoints = pronoPoints + teamBonus;
	const exactScores = scored.filter((p) => {
		const m = p.match as any;
		return m && p.predicted_home === m.home_score && p.predicted_away === m.away_score;
	}).length;

	// Fetch WC winner odds from DB (populated by admin sync from Polymarket)
	// odds column = 1/probability (decimal odds, e.g. 6.25 for Spain)
	let teamOdds: number | null = null;
	if (profile.favorite_team) {
		const { data: oddsRows } = await supabase
			.from('wc_winner_odds')
			.select('odds, multiplier, team_name_en');

		// Match by exact name first, then fallback to case-insensitive contains
		const row =
			(oddsRows ?? []).find((r) => r.team_name_en === profile.favorite_team) ??
			(oddsRows ?? []).find((r) =>
				r.team_name_en.toLowerCase().includes(profile.favorite_team!.toLowerCase().split(' ')[0])
			);

		if (row) teamOdds = parseFloat(String(row.multiplier ?? row.odds));
	}

	return {
		profile,
		pronostics: scored,
		pronoPoints,
		teamBonus,
		totalPoints,
		exactScores,
		totalPronoCount: (pronostics ?? []).length,
		isOwnProfile: user?.id === params.id,
		teamOdds
	};
};
