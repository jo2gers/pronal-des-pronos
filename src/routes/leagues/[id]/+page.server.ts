import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) redirect(303, '/auth/login');

	const { data: group } = await supabase
		.from('groups')
		.select('*, competitions(id, slug, name_fr, name_en)')
		.eq('id', params.id)
		.single();

	if (!group) error(404, 'Ligue introuvable');

	// V2: the scoreboard is scoped to the group's competition. WC leagues (the
	// archive) keep the legacy global view + profiles.team_bonus_points; V2
	// leagues read the per-competition view + favorite_teams.bonus_points.
	const competition = group.competitions as { id: string; slug: string; name_fr: string; name_en: string } | null;
	const isLegacyWc = !competition || competition.slug === 'wc-2026';

	const [{ data: members }, { data: statRows }, friendshipsResult, { data: bonusRows }] = await Promise.all([
		supabase
			.from('group_members')
			.select('role, joined_at, profiles(id, username, display_name, avatar_url, team_bonus_points)')
			.eq('group_id', params.id),
		// Per-user scored aggregates from the DB view (no 1000-row cap, no re-summing).
		isLegacyWc
			? supabase
					.from('user_pronostic_stats')
					.select('user_id, prono_points, picks, winners, exact')
			: supabase
					.from('competition_pronostic_stats')
					.select('user_id, prono_points, picks, winners, exact')
					.eq('competition_id', competition.id),
		supabase
			.from('friendships')
			.select(`
				id, status, requester_id, addressee_id,
				requester:profiles!friendships_requester_id_fkey(id, username, display_name, avatar_url),
				addressee:profiles!friendships_addressee_id_fkey(id, username, display_name, avatar_url)
			`)
			.or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
			.eq('status', 'accepted'),
		isLegacyWc
			? Promise.resolve({ data: [] as Array<{ user_id: string; bonus_points: number }> })
			: supabase
					.from('favorite_teams')
					.select('user_id, bonus_points')
					.eq('competition_id', competition.id)
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

	// Scoreboard: per-member breakdown straight from the per-user stats view
	// (picks, winners = correct-not-exact, exact, summed prono points). teamBonus:
	// legacy WC → profile column; V2 → favorite_teams.bonus_points for this comp.
	const statsMap = new Map((statRows ?? []).map((s: any) => [s.user_id as string, s]));
	const bonusMap = new Map((bonusRows ?? []).map((b: any) => [b.user_id as string, b.bonus_points]));

	const scoreboard = (members ?? [])
		.map((m) => {
			const p = m.profiles as any;
			const s = statsMap.get(p?.id) as any;
			const pronoPts = parseFloat(String(s?.prono_points ?? 0));
			const teamBonus = isLegacyWc
				? parseFloat(String(p?.team_bonus_points ?? 0))
				: parseFloat(String(bonusMap.get(p?.id) ?? 0));
			return {
				profile: p,
				role: m.role,
				picks: s?.picks ?? 0,
				winners: s?.winners ?? 0,
				exact: s?.exact ?? 0,
				pronoPts: parseFloat(pronoPts.toFixed(2)),
				teamBonus,
				points: parseFloat((pronoPts + teamBonus).toFixed(2))
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

		pendingRequests = (requests ?? []) as unknown as typeof pendingRequests;
	}

	return { group, competition, scoreboard, isAdmin, user, friendsNotInGroup, pendingRequests };
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
