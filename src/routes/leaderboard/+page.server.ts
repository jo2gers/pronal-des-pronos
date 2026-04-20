import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();

	// Aggregate pronostic points per user
	const { data: rankings } = await supabase
		.from('pronostics')
		.select('user_id, points_earned, profiles(id, username, display_name, avatar_url, favorite_team, team_bonus_points)')
		.eq('is_scored', true);

	// Group by user
	const userMap = new Map<string, {
		user: unknown;
		pronoPoints: number;
		teamBonus: number;
		count: number;
	}>();

	for (const row of rankings ?? []) {
		if (!userMap.has(row.user_id)) {
			const profile = row.profiles as any;
			userMap.set(row.user_id, {
				user: profile,
				pronoPoints: 0,
				teamBonus: profile?.team_bonus_points ?? 0,
				count: 0
			});
		}
		const entry = userMap.get(row.user_id)!;
		entry.pronoPoints += row.points_earned ?? 0;
		entry.count += 1;
	}

	// Also include users who have team bonus but zero pronostics scored yet
	const { data: bonusProfiles } = await supabase
		.from('profiles')
		.select('id, username, display_name, avatar_url, favorite_team, team_bonus_points')
		.gt('team_bonus_points', 0);

	for (const profile of bonusProfiles ?? []) {
		if (!userMap.has(profile.id)) {
			userMap.set(profile.id, {
				user: profile,
				pronoPoints: 0,
				teamBonus: profile.team_bonus_points ?? 0,
				count: 0
			});
		}
	}

	const leaderboard = Array.from(userMap.entries())
		.map(([userId, { user, pronoPoints, teamBonus, count }]) => ({
			userId,
			user,
			pronoPoints,
			teamBonus,
			total: pronoPoints + teamBonus,
			count
		}))
		.sort((a, b) => b.total - a.total)
		.map((entry, i) => ({ ...entry, rank: i + 1 }));

	const userRank = user ? (leaderboard.findIndex((r) => r.userId === user.id) + 1) || null : null;

	return { leaderboard, userRank, currentUser: user };
};
