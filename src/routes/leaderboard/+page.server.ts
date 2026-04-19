import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession }, url }) => {
	const { user } = await safeGetSession();
	const stage = url.searchParams.get('stage') ?? 'all';

	// Aggregate points per user
	const { data: rankings } = await supabase
		.from('pronostics')
		.select('user_id, points_earned, profiles(username, display_name, avatar_url, favorite_team)')
		.eq('is_scored', true);

	// Group by user
	const userMap = new Map<string, { user: unknown; total: number; count: number }>();
	for (const row of rankings ?? []) {
		if (!userMap.has(row.user_id)) {
			userMap.set(row.user_id, { user: row.profiles, total: 0, count: 0 });
		}
		const entry = userMap.get(row.user_id)!;
		entry.total += row.points_earned ?? 0;
		entry.count += 1;
	}

	const leaderboard = Array.from(userMap.entries())
		.map(([userId, { user, total, count }]) => ({ userId, user, total, count }))
		.sort((a, b) => b.total - a.total)
		.map((entry, i) => ({ ...entry, rank: i + 1 }));

	const userRank = user ? leaderboard.findIndex((r) => r.userId === user.id) + 1 : null;

	return { leaderboard, userRank, currentUser: user };
};
