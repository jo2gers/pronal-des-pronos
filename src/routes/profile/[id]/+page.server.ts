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

	const scored    = (pronostics ?? []).filter((p) => p.is_scored);
	const pronoPoints = scored.reduce((sum, p) => sum + (p.points_earned ?? 0), 0);
	const teamBonus   = profile.team_bonus_points ?? 0;
	const totalPoints = pronoPoints + teamBonus;
	const exactScores = scored.filter((p) => {
		const m = p.match as any;
		return m && p.predicted_home === m.home_score && p.predicted_away === m.away_score;
	}).length;

	return {
		profile,
		pronostics: scored,
		pronoPoints,
		teamBonus,
		totalPoints,
		exactScores,
		totalPronoCount: (pronostics ?? []).length,
		isOwnProfile: user?.id === params.id
	};
};
