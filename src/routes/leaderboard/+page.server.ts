import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();

	// Per-user scored-pronostic aggregates from the DB view (always fresh, no
	// 1000-row cap, no JS re-summing) - one row per user who has a scored pick.
	const { data: stats } = await supabase
		.from('user_pronostic_stats')
		.select('user_id, prono_points, picks, winners, exact');
	const statsMap = new Map((stats ?? []).map((s: any) => [s.user_id as string, s]));

	// Fetch all profiles that appear in pronostics OR have a team bonus
	const profileIds = [...statsMap.keys()];

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
			const s = statsMap.get(profile.id) as any;
			const pronoPoints = parseFloat(String(s?.prono_points ?? 0));
			const teamBonus   = profile.team_bonus_points ?? 0;
			const total       = pronoPoints + teamBonus;
			const count       = s?.picks ?? 0;
			const winners     = s?.winners ?? 0;
			const exact       = s?.exact ?? 0;
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
