import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) redirect(303, '/auth/login');

	const { data: group } = await supabase
		.from('groups')
		.select('*')
		.eq('id', params.id)
		.single();

	if (!group) error(404, 'Ligue introuvable');

	const [{ data: members }, pronosticsResult, friendshipsResult] = await Promise.all([
		supabase
			.from('group_members')
			.select('role, joined_at, profiles(id, username, display_name, avatar_url, team_bonus_points)')
			.eq('group_id', params.id),
		supabase
			.from('pronostics')
			.select('user_id, predicted_home, predicted_away, points_earned, match:matches(home_score, away_score)')
			.eq('is_scored', true),
		supabase
			.from('friendships')
			.select(`
				id, status, requester_id, addressee_id,
				requester:profiles!friendships_requester_id_fkey(id, username, display_name, avatar_url),
				addressee:profiles!friendships_addressee_id_fkey(id, username, display_name, avatar_url)
			`)
			.or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
			.eq('status', 'accepted')
	]);

	const memberIds = (members ?? []).map((m) => (m.profiles as any)?.id);
	const isMember = memberIds.includes(user.id);
	if (!isMember) redirect(303, '/leagues');

	const myMembership = (members ?? []).find((m) => (m.profiles as any)?.id === user.id);
	const isAdmin = myMembership?.role === 'admin';

	// Friends who are NOT already in the group
	const friends = (friendshipsResult.data ?? []).map((f) =>
		(f.requester_id === user.id ? f.addressee : f.requester) as unknown as { id: string; username: string; display_name: string | null; avatar_url: string | null }
	);

	const friendsNotInGroup = friends.filter((f) => f && !memberIds.includes(f.id));

	// Scoreboard: per-member breakdown.
	// - picks   : number of scored predictions
	// - winners : count of "correct winner" picks that weren't exact
	// - exact   : count of exact-score picks
	// - pronoPts: sum of points_earned from predictions
	// teamBonus + scorerBonus come straight from the profile columns.
	type Stats = { picks: number; winners: number; exact: number; pronoPts: number };
	const stats = new Map<string, Stats>();
	for (const id of memberIds) stats.set(id, { picks: 0, winners: 0, exact: 0, pronoPts: 0 });

	for (const row of pronosticsResult.data ?? []) {
		const s = stats.get(row.user_id);
		if (!s) continue;
		s.picks++;
		s.pronoPts += row.points_earned ?? 0;
		const m = (row as any).match;
		if (m?.home_score != null && m?.away_score != null) {
			if (row.predicted_home === m.home_score && row.predicted_away === m.away_score) {
				s.exact++;
			} else if (Math.sign(row.predicted_home - row.predicted_away) === Math.sign(m.home_score - m.away_score)) {
				s.winners++;
			}
		}
	}

	const scoreboard = (members ?? [])
		.map((m) => {
			const p = m.profiles as any;
			const id = p?.id;
			const s = stats.get(id) ?? { picks: 0, winners: 0, exact: 0, pronoPts: 0 };
			const teamBonus   = parseFloat(String(p?.team_bonus_points ?? 0));
			return {
				profile: p,
				role: m.role,
				picks: s.picks,
				winners: s.winners,
				exact: s.exact,
				pronoPts: parseFloat(s.pronoPts.toFixed(2)),
				teamBonus,
				points: parseFloat((s.pronoPts + teamBonus).toFixed(2))
			};
		})
		.sort((a, b) => b.points - a.points);

	// Pending join requests (only visible to admin)
	let pendingRequests: Array<{
		id: string;
		user_id: string;
		created_at: string;
		profiles: { id: string; username: string; display_name: string | null; avatar_url: string | null } | null;
	}> = [];

	if (isAdmin) {
		const { data: requests } = await supabase
			.from('group_join_requests')
			.select('id, user_id, created_at, profiles(id, username, display_name, avatar_url)')
			.eq('group_id', params.id)
			.eq('status', 'pending')
			.order('created_at', { ascending: true });

		pendingRequests = (requests ?? []) as typeof pendingRequests;
	}

	return { group, scoreboard, isAdmin, user, friendsNotInGroup, pendingRequests };
};

export const actions: Actions = {
	approveRequest: async ({ params, request, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user) return fail(401, { error: 'Non authentifié' });

		const form = await request.formData();
		const requestId = form.get('request_id') as string;
		if (!requestId) return fail(400, { error: 'Demande invalide' });

		const { data: rpcResult, error: rpcErr } = await supabase
			.rpc('approve_join_request', { p_request_id: requestId });
		if (rpcErr) return fail(500, { error: rpcErr.message });
		const status = (rpcResult as any)?.status;
		if (status === 'not_admin') return fail(403, { error: 'Non autorisé' });
		if (status === 'invalid')   return fail(404, { error: 'Demande introuvable' });
		if (status !== 'approved')  return fail(500, { error: 'Erreur inconnue' });

		return { approved: true };
	},

	declineRequest: async ({ params, request, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user) return fail(401, { error: 'Non authentifié' });

		const form = await request.formData();
		const requestId = form.get('request_id') as string;
		if (!requestId) return fail(400, { error: 'Demande invalide' });

		const { data: rpcResult, error: rpcErr } = await supabase
			.rpc('decline_join_request', { p_request_id: requestId });
		if (rpcErr) return fail(500, { error: rpcErr.message });
		const status = (rpcResult as any)?.status;
		if (status === 'not_admin') return fail(403, { error: 'Non autorisé' });
		if (status === 'invalid')   return fail(404, { error: 'Demande introuvable' });
		if (status !== 'declined')  return fail(500, { error: 'Erreur inconnue' });

		return { declined: true };
	},

	leave: async ({ params, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user) return fail(401, { error: 'Non authentifié' });

		// Atomic RPC: deletes membership, counts remaining server-side (bypassing RLS),
		// and only cascades the group delete when truly empty. Previously this was
		// counted client-side after self-delete — RLS made the count return 0 even
		// when other members remained, wrongly deleting populated groups.
		await supabase.rpc('leave_group', { p_group_id: params.id });

		redirect(303, '/leagues');
	},

	addFriend: async ({ params, request, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user) return fail(401, { error: 'Non authentifié' });

		const form = await request.formData();
		const friendId = form.get('friend_id') as string;
		if (!friendId) return fail(400, { error: 'Ami introuvable' });

		// Single SECURITY DEFINER RPC enforces every precondition atomically.
		const { data: rpcResult, error: rpcErr } = await supabase
			.rpc('invite_friend_to_group', { p_group_id: params.id, p_friend_id: friendId });

		if (rpcErr) return fail(500, { error: rpcErr.message });
		const status = (rpcResult as any)?.status;
		switch (status) {
			case 'invited':
			case 'invite_pending':
				return { inviteSent: true };
			case 'not_member':    return fail(403, { error: "Tu n'es pas membre de cette ligue" });
			case 'not_admin':     return fail(403, { error: "Seul l'admin peut ajouter des membres à une ligue privée" });
			case 'not_friend':    return fail(403, { error: "Cet utilisateur n'est pas dans ta liste d'amis" });
			case 'already_member':return fail(400, { error: 'Cet ami est déjà dans la ligue' });
			default:              return fail(500, { error: 'Erreur inconnue' });
		}
	},

};
