import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();

	// Fetch scored pronostics (no join — avoids FK ambiguity)
	const { data: pronostics } = await supabase
		.from('pronostics')
		.select('user_id, points_earned')
		.eq('is_scored', true);

	// Aggregate prono points per user
	const pronoMap = new Map<string, number>();
	for (const p of pronostics ?? []) {
		pronoMap.set(p.user_id, (pronoMap.get(p.user_id) ?? 0) + (p.points_earned ?? 0));
	}

	// Fetch all profiles that appear in pronostics OR have a team bonus
	const profileIds = [...pronoMap.keys()];

	const { data: profiles } = await supabase
		.from('profiles')
		.select('id, username, display_name, avatar_url, favorite_team, team_bonus_points, top_scorer, top_scorer_bonus_points')
		.or(
			profileIds.length > 0
				? `id.in.(${profileIds.join(',')}),team_bonus_points.gt.0,top_scorer_bonus_points.gt.0`
				: 'team_bonus_points.gt.0,top_scorer_bonus_points.gt.0'
		);

	// Build leaderboard
	const leaderboard = (profiles ?? [])
		.map((profile) => {
			const pronoPoints = pronoMap.get(profile.id) ?? 0;
			const teamBonus   = profile.team_bonus_points ?? 0;
			const scorerBonus = profile.top_scorer_bonus_points ?? 0;
			const total       = pronoPoints + teamBonus + scorerBonus;
			const count       = pronostics?.filter((p) => p.user_id === profile.id).length ?? 0;
			return { userId: profile.id, user: profile, pronoPoints, teamBonus, scorerBonus, total, count };
		})
		.sort((a, b) => b.total - a.total)
		.map((entry, i) => ({ ...entry, rank: i + 1 }));

	const userRank = user
		? (leaderboard.findIndex((r) => r.userId === user.id) + 1) || null
		: null;

	// Friend IDs for "friends" filter
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

	return { leaderboard, userRank, currentUser: user, friendIds };
};
