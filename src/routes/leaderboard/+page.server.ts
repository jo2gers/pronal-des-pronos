import type { PageServerLoad } from './$types';
import { fetchAllScoredPronostics } from '$lib/server/pronostics';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();

	// ALL scored pronostics, paginated past PostgREST's 1000-row cap — otherwise
	// users whose picks fall past row 1000 are silently under-counted (wrong total,
	// rank, winner/exact). No join → avoids FK ambiguity.
	const pronostics = await fetchAllScoredPronostics<{
		user_id: string;
		points_earned: number | null;
		predicted_home: number;
		predicted_away: number;
		match_id: string;
	}>(supabase, 'user_id, points_earned, predicted_home, predicted_away, match_id');

	// Aggregate prono points per user
	const pronoMap = new Map<string, number>();
	for (const p of pronostics ?? []) {
		pronoMap.set(p.user_id, (pronoMap.get(p.user_id) ?? 0) + (p.points_earned ?? 0));
	}

	// Per-user "winner" (correct outcome, not exact) and "exact" counts. Mirrors
	// the match page's scoring tiers: exact (3×) and winner (1×) are mutually
	// exclusive. Needs each pick's predicted score vs the match's final score.
	const matchIds = [...new Set((pronostics ?? []).map((p) => p.match_id).filter(Boolean))];
	const scoreMap = new Map<string, { home_score: number | null; away_score: number | null }>();
	if (matchIds.length > 0) {
		const { data: matchRows } = await supabase
			.from('matches')
			.select('id, home_score, away_score')
			.in('id', matchIds);
		for (const m of matchRows ?? []) scoreMap.set(m.id, m);
	}
	const winnerMap = new Map<string, number>();
	const exactMap = new Map<string, number>();
	for (const p of pronostics ?? []) {
		const m = scoreMap.get(p.match_id);
		if (!m || m.home_score == null || m.away_score == null) continue;
		if (p.predicted_home === m.home_score && p.predicted_away === m.away_score) {
			exactMap.set(p.user_id, (exactMap.get(p.user_id) ?? 0) + 1);
		} else if (Math.sign(p.predicted_home - p.predicted_away) === Math.sign(m.home_score - m.away_score)) {
			winnerMap.set(p.user_id, (winnerMap.get(p.user_id) ?? 0) + 1);
		}
	}

	// Fetch all profiles that appear in pronostics OR have a team bonus
	const profileIds = [...pronoMap.keys()];

	const { data: profiles } = await supabase
		.from('profiles')
		.select('id, username, display_name, avatar_url, favorite_team, team_bonus_points')
		.or(
			profileIds.length > 0
				? `id.in.(${profileIds.join(',')}),team_bonus_points.gt.0`
				: 'team_bonus_points.gt.0'
		);

	// Build leaderboard
	const leaderboard = (profiles ?? [])
		.map((profile) => {
			const pronoPoints = pronoMap.get(profile.id) ?? 0;
			const teamBonus   = profile.team_bonus_points ?? 0;
			const total       = pronoPoints + teamBonus;
			const count       = pronostics?.filter((p) => p.user_id === profile.id).length ?? 0;
			const winners     = winnerMap.get(profile.id) ?? 0;
			const exact       = exactMap.get(profile.id) ?? 0;
			return { userId: profile.id, user: profile, pronoPoints, teamBonus, total, count, winners, exact };
		})
		.sort((a, b) => b.total - a.total || (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0))
		.map((entry, i) => ({ ...entry, rank: i + 1 }));

	const userRank = user
		? (leaderboard.findIndex((r) => r.userId === user.id) + 1) || null
		: null;

	// Friend IDs for the "friends" filter + the viewer's leagues for per-league
	// tabs (Tous | each league | Amis).
	let friendIds: string[] = [];
	let myLeagues: { id: string; name: string; memberIds: string[] }[] = [];
	if (user) {
		const [{ data: friendships }, { data: memberships }] = await Promise.all([
			supabase
				.from('friendships')
				.select('requester_id, addressee_id')
				.eq('status', 'accepted')
				.or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`),
			supabase
				.from('group_members')
				.select('group_id, groups(id, name)')
				.eq('user_id', user.id)
		]);
		friendIds = (friendships ?? []).map((f) =>
			f.requester_id === user.id ? f.addressee_id : f.requester_id
		);

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

	// Baseline = standings as of ~24h ago, so the per-player rank deltas (+N / -N)
	// reflect movement over the LAST 24 HOURS (≈ the last couple of matches), not
	// just the most recent one. Snapshots are pre-result and timestamped; between
	// matches the standings don't change, so the OLDEST snapshot inside the 24h
	// window equals the standings at the start of that window. No snapshot in the
	// window → no matches in 24h → prevTotals null → every row shows "–".
	const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
	const { data: snapRow } = await supabase
		.from('rank_snapshots')
		.select('totals')
		.gte('created_at', since24h)
		.order('created_at', { ascending: true })
		.limit(1)
		.maybeSingle();
	const prevTotals = (snapRow?.totals ?? null) as Record<string, number> | null;

	return { leaderboard, userRank, currentUser: user, friendIds, myLeagues, prevTotals };
};
