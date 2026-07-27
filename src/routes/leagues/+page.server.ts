import { fail, redirect } from '@sveltejs/kit';
import { resolveCurrentComp } from '$lib/server/currentComp';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, cookies, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) redirect(303, '/auth/login');

	// Leagues belong to the game you're in — show ONLY the current competition's
	// leagues (PL and UCL stay separate). The game comes from the /[comp] cookie,
	// switchable here via ?comp=.
	const { current, active } = await resolveCurrentComp(supabase, cookies, url.searchParams.get('comp'));

	const { data: memberships } = await supabase
		.from('group_members')
		.select('role, groups(id, name, description, invite_code, created_at, competition_id, competitions(slug, name_fr, name_en))')
		.eq('user_id', user.id);

	const allGroups = (memberships ?? []).map((m) => ({
		...(m.groups as unknown as Record<string, unknown>),
		role: m.role
	})) as Array<{
		id: string; name: string; description: string | null; invite_code: string; created_at: string; role: string;
		competition_id: string | null;
		competitions: { slug: string; name_fr: string; name_en: string } | null;
	}>;

	// Only the current game's leagues.
	const groups = current ? allGroups.filter((g) => g.competition_id === current.id) : allGroups;

	// Admin groups: load pending join requests
	const adminGroupIds = groups.filter((g) => g.role === 'admin').map((g) => g.id);

	let pendingRequests: Array<{
		id: string;
		group_id: string;
		group_name: string;
		created_at: string;
		profiles: { id: string; username: string; display_name: string | null; avatar_url: string | null } | null;
	}> = [];

	if (adminGroupIds.length > 0) {
		const { data: requests } = await supabase
			.from('group_join_requests')
			.select('id, group_id, created_at, profiles(id, username, display_name, avatar_url)')
			.eq('status', 'pending')
			.in('group_id', adminGroupIds)
			.order('created_at', { ascending: true });

		pendingRequests = (requests ?? []).map((r) => ({
			id: r.id,
			group_id: r.group_id,
			group_name: groups.find((g) => g.id === r.group_id)?.name ?? '',
			created_at: r.created_at,
			profiles: r.profiles as unknown as { id: string; username: string; display_name: string | null; avatar_url: string | null } | null
		}));
	}

	// Current user's own pending requests (groups they asked to join, not yet a
	// member). Policy groups_select_requested exposes name + invite_code to the
	// requester so the card can remind them which code they used.
	const { data: myRequests } = await supabase
		.from('group_join_requests')
		.select('id, group_id, created_at, groups(id, name, invite_code)')
		.eq('user_id', user.id)
		.eq('status', 'pending');

	const myPendingRequests = (myRequests ?? []).map((r) => ({
		id: r.id,
		group_id: r.group_id,
		group_name: (r.groups as unknown as { name: string } | null)?.name ?? '',
		invite_code: (r.groups as unknown as { invite_code: string } | null)?.invite_code ?? null,
		created_at: r.created_at
	}));

	// Current user's pending group invites
	const { data: myInvites } = await supabase
		.from('group_invites')
		.select('id, group_id, created_at, invited_by, groups(id, name, description)')
		.eq('user_id', user.id)
		.eq('status', 'pending');

	// Fetch inviters' profiles separately
	const inviterIds = [...new Set((myInvites ?? []).map((inv) => inv.invited_by))];
	const { data: inviterProfiles } = inviterIds.length > 0
		? await supabase.from('profiles').select('id, username, display_name').in('id', inviterIds)
		: { data: [] };
	const inviterMap = Object.fromEntries((inviterProfiles ?? []).map((p) => [p.id, p]));

	const myPendingInvites = (myInvites ?? []).map((inv) => ({
		id: inv.id,
		group_id: inv.group_id,
		group_name: (inv.groups as unknown as { name: string; description: string | null } | null)?.name ?? '',
		group_description: (inv.groups as unknown as { name: string; description: string | null } | null)?.description ?? null,
		invited_by: inviterMap[inv.invited_by] as { username: string; display_name: string | null } | null,
		created_at: inv.created_at
	}));

	return { groups, pendingRequests, myPendingRequests, myPendingInvites, currentComp: current, activeComps: active };
};

export const actions: Actions = {
	joinByCode: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user) return fail(401, { error: 'Non authentifié' });

		const form = await request.formData();
		const code = (form.get('code') as string ?? '').trim().toLowerCase();
		if (!code) return fail(400, { joinError: 'Code requis', code });

		// Atomic SECURITY DEFINER RPC — handles invalid_code / already_member /
		// public-join / pending_created / pending_existing in one round trip.
		const { data: rpcResult, error: rpcErr } = await supabase
			.rpc('join_group_by_code', { code_input: code });

		if (rpcErr) return fail(500, { joinError: rpcErr.message, code });

		const result = rpcResult as {
			status: 'joined' | 'already_member' | 'pending_created' | 'pending_existing' | 'invalid_code' | 'unauthenticated';
			group_id?: string;
			group_name?: string;
		};

		switch (result.status) {
			case 'invalid_code':
				return fail(404, { joinError: 'invalid_code', code });
			case 'already_member':
				return fail(400, { joinError: 'already_member', code });
			case 'joined':
				redirect(303, `/leagues/${result.group_id}`);
			case 'pending_created':
				return { joinSuccess: true, groupName: result.group_name, alreadyPending: false };
			case 'pending_existing':
				return { joinSuccess: true, groupName: result.group_name, alreadyPending: true };
			default:
				return fail(500, { joinError: 'unknown', code });
		}
	},

	approveRequest: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user) return fail(401, { error: 'Non authentifié' });

		const form = await request.formData();
		const requestId = form.get('request_id') as string;
		if (!requestId) return fail(400, { error: 'Demande invalide' });

		const { data: rpcResult, error: rpcErr } = await supabase
			.rpc('approve_join_request', { p_request_id: requestId });

		if (rpcErr) return fail(500, { error: rpcErr.message });
		const status = (rpcResult as any)?.status;
		if (status === 'not_admin')   return fail(403, { error: 'Non autorisé' });
		if (status === 'invalid')     return fail(404, { error: 'Demande introuvable' });
		if (status !== 'approved')    return fail(500, { error: 'Erreur inconnue' });

		return { approved: true };
	},

	declineRequest: async ({ request, locals: { supabase, safeGetSession } }) => {
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

	respondToInvite: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user) return fail(401, { error: 'Non authentifié' });

		const form = await request.formData();
		const inviteId = form.get('invite_id') as string;
		const action = form.get('action') as 'accepted' | 'declined';

		if (!inviteId || !action) return fail(400, { error: 'Données invalides' });

		const { data: rpcResult, error: rpcErr } = await supabase
			.rpc('respond_to_invite', { p_invite_id: inviteId, p_accept: action === 'accepted' });

		if (rpcErr) return fail(500, { error: rpcErr.message });
		const status = (rpcResult as any)?.status;
		if (status === 'invalid') return fail(403, { error: 'Invitation invalide' });

		return { responded: true };
	}
};
