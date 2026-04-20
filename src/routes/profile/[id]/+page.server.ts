import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();

	const { data: profile } = await supabase
		.from('profiles')
		.select('id, username, display_name, avatar_url, favorite_team, country')
		.eq('id', params.id)
		.single();

	if (!profile) error(404, 'Profil introuvable');

	// Fetch pronostics for finished + scored matches
	const { data: pronostics } = await supabase
		.from('pronostics')
		.select(`
			id, predicted_home, predicted_away, points_earned, is_scored,
			match:matches(id, home_team, away_team, home_flag, away_flag, home_score, away_score, match_datetime, stage, status)
		`)
		.eq('user_id', params.id)
		.eq('is_scored', true)
		.order('created_at', { ascending: false });

	// Calculate stats
	const totalPoints = (pronostics ?? []).reduce((sum, p) => sum + (p.points_earned ?? 0), 0);
	const exactScores = (pronostics ?? []).filter((p) => p.points_earned !== null && p.points_earned >= 3).length;

	return {
		profile,
		pronostics: pronostics ?? [],
		totalPoints,
		exactScores,
		isOwnProfile: user?.id === params.id
	};
};
