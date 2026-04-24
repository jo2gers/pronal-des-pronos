import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) redirect(303, '/auth/login');

	const { data: memberships } = await supabase
		.from('group_members')
		.select('role, groups(id, name, description, invite_code, created_at)')
		.eq('user_id', user.id);

	const groups = (memberships ?? []).map((m) => ({
		...(m.groups as Record<string, unknown>),
		role: m.role
	})) as Array<{ id: string; name: string; description: string | null; invite_code: string; created_at: string; role: string }>;

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
			profiles: r.profiles as { id: string; username: string; display_name: string | null; avatar_url: string | null } | null
		}));
	}

	// Current user's own pending requests (groups they asked to join, not yet a member)
	const { data: myRequests } = await supabase
		.from('group_join_requests')
		.select('id, group_id, created_at, groups(id, name)')
		.eq('user_id', user.id)
		.eq('status', 'pending');

	const myPendingRequests = (myRequests ?? []).map((r) => ({
		id: r.id,
		group_id: r.group_id,
		group_name: (r.groups as { name: string } | null)?.name ?? '',
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
		group_name: (inv.groups as { name: string; description: string | null } | null)?.name ?? '',
		group_description: (inv.groups as { name: string; description: string | null } | null)?.description ?? null,
		invited_by: inviterMap[inv.invited_by] as { username: string; display_name: string | null } | null,
		created_at: inv.created_at
	}));

	return { groups, pendingRequests, myPendingRequests, myPendingInvites };
};

export const actions: Actions = {
	joinByCode: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user) return fail(401, { error: 'Non authentifié' });

		const form = await request.formData();
		const code = (form.get('code') as string ?? '').trim().toUpperCase();

		if (!code) return fail(400, { joinError: 'Code requis', code });

		// Find the group
		const { data: group } = await supabase
			.from('groups')
			.select('id, name')
			.eq('invite_code', code)
			.maybeSingle();

		if (!group) return fail(404, { joinError: 'invalid_code', code });

		// Already a member?
		const { data: existing } = await supabase
			.from('group_members')
			.select('id')
			.eq('group_id', group.id)
			.eq('user_id', user.id)
			.maybeSingle();

		if (existing) return fail(400, { joinError: 'already_member', code });

		// Already has a pending request?
		const { data: existingReq } = await supabase
			.from('group_join_requests')
			.select('id')
			.eq('group_id', group.id)
			.eq('user_id', user.id)
			.maybeSingle();

		if (existingReq) return { joinSuccess: true, groupName: group.name, alreadyPending: true };

		// Create the pending request
		const { error: insertErr } = await supabase
			.from('group_join_requests')
			.insert({ group_id: group.id, user_id: user.id });

		if (insertErr) return fail(500, { joinError: insertErr.message, code });

		return { joinSuccess: true, groupName: group.name, alreadyPending: false };
	},

	approveRequest: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user) return fail(401, { error: 'Non authentifié' });

		const form = await request.formData();
		const requestId = form.get('request_id') as string;

		// Load the request
		const { data: req } = await supabase
			.from('group_join_requests')
			.select('group_id, user_id')
			.eq('id', requestId)
			.single();

		if (!req) return fail(404, { error: 'Demande introuvable' });

		// Verify current user is admin of that group
		const { data: membership } = await supabase
			.from('group_members')
			.select('role')
			.eq('group_id', req.group_id)
			.eq('user_id', user.id)
			.maybeSingle();

		if (!membership || membership.role !== 'admin')
			return fail(403, { error: 'Non autorisé' });

		// Add to group + mark approved (in parallel)
		await Promise.all([
			supabase.from('group_members').insert({ group_id: req.group_id, user_id: req.user_id, role: 'member' }),
			supabase.from('group_join_requests').update({ status: 'approved' }).eq('id', requestId)
		]);

		return { approved: true };
	},

	declineRequest: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user) return fail(401, { error: 'Non authentifié' });

		const form = await request.formData();
		const requestId = form.get('request_id') as string;

		const { data: req } = await supabase
			.from('group_join_requests')
			.select('group_id')
			.eq('id', requestId)
			.single();

		if (!req) return fail(404, { error: 'Demande introuvable' });

		const { data: membership } = await supabase
			.from('group_members')
			.select('role')
			.eq('group_id', req.group_id)
			.eq('user_id', user.id)
			.maybeSingle();

		if (!membership || membership.role !== 'admin')
			return fail(403, { error: 'Non autorisé' });

		await supabase.from('group_join_requests').update({ status: 'declined' }).eq('id', requestId);

		return { declined: true };
	},

	respondToInvite: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user) return fail(401, { error: 'Non authentifié' });

		const form = await request.formData();
		const inviteId = form.get('invite_id') as string;
		const action = form.get('action') as 'accepted' | 'declined';

		if (!inviteId || !action) return fail(400, { error: 'Données invalides' });

		// Get the invite
		const { data: invite } = await supabase
			.from('group_invites')
			.select('id, group_id, user_id, status')
			.eq('id', inviteId)
			.maybeSingle();

		if (!invite || invite.user_id !== user.id || invite.status !== 'pending') {
			return fail(403, { error: 'Invitation invalide' });
		}

		if (action === 'accepted') {
			// Add user to group and mark invite as accepted
			await Promise.all([
				supabase
					.from('group_members')
					.insert({ group_id: invite.group_id, user_id: user.id, role: 'member' }),
				supabase
					.from('group_invites')
					.update({ status: 'accepted' })
					.eq('id', inviteId)
			]);
		} else {
			// Just mark as declined
			await supabase
				.from('group_invites')
				.update({ status: 'declined' })
				.eq('id', inviteId);
		}

		return { responded: true };
	}
};
