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

	if (!group) error(404, 'Groupe introuvable');

	const [{ data: members }, pronosticsResult, friendshipsResult] = await Promise.all([
		supabase
			.from('group_members')
			.select('role, joined_at, profiles(id, username, display_name, avatar_url)')
			.eq('group_id', params.id),
		supabase
			.from('pronostics')
			.select('user_id, points_earned')
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
	if (!isMember) redirect(303, '/groups');

	const myMembership = (members ?? []).find((m) => (m.profiles as any)?.id === user.id);
	const isAdmin = myMembership?.role === 'admin';

	// Friends who are NOT already in the group
	const friends = (friendshipsResult.data ?? []).map((f) =>
		(f.requester_id === user.id ? f.addressee : f.requester) as unknown as { id: string; username: string; display_name: string | null; avatar_url: string | null }
	);

	const friendsNotInGroup = friends.filter((f) => f && !memberIds.includes(f.id));

	// Scoreboard: aggregate points for members
	const memberPoints = new Map<string, number>();
	for (const id of memberIds) memberPoints.set(id, 0);
	for (const row of pronosticsResult.data ?? []) {
		if (memberPoints.has(row.user_id)) {
			memberPoints.set(row.user_id, (memberPoints.get(row.user_id) ?? 0) + (row.points_earned ?? 0));
		}
	}

	const scoreboard = (members ?? [])
		.map((m) => ({
			profile: m.profiles,
			role: m.role,
			points: memberPoints.get((m.profiles as any)?.id ?? '') ?? 0
		}))
		.sort((a, b) => b.points - a.points);

	return { group, scoreboard, isAdmin, user, friendsNotInGroup };
};

export const actions: Actions = {
	leave: async ({ params, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user) return fail(401, { error: 'Non authentifié' });

		await supabase
			.from('group_members')
			.delete()
			.eq('group_id', params.id)
			.eq('user_id', user.id);

		// If no members remain, delete the empty group + all dependent rows.
		const { count } = await supabase
			.from('group_members')
			.select('user_id', { count: 'exact', head: true })
			.eq('group_id', params.id);

		if ((count ?? 0) === 0) {
			await Promise.all([
				supabase.from('group_invites').delete().eq('group_id', params.id),
				supabase.from('group_join_requests').delete().eq('group_id', params.id)
			]);
			await supabase.from('groups').delete().eq('id', params.id);
		}

		redirect(303, '/groups');
	},

	addFriend: async ({ params, request, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user) return fail(401, { error: 'Non authentifié' });

		const form = await request.formData();
		const friendId = form.get('friend_id') as string;
		if (!friendId) return fail(400, { error: 'Ami introuvable' });

		// Verify current user is member and check group privacy
		const [{ data: myMembership }, { data: group }] = await Promise.all([
			supabase
				.from('group_members')
				.select('role')
				.eq('group_id', params.id)
				.eq('user_id', user.id)
				.maybeSingle(),
			supabase
				.from('groups')
				.select('is_public')
				.eq('id', params.id)
				.single()
		]);

		if (!myMembership) return fail(403, { error: 'Tu n\'es pas membre de ce groupe' });

		// If private group, only admin can add
		const isPrivate = group && group.is_public === false;
		if (isPrivate && myMembership.role !== 'admin') {
			return fail(403, { error: 'Seul l\'admin peut ajouter des membres à un groupe privé' });
		}

		// Verify the person to add is actually a friend
		const { data: friendship } = await supabase
			.from('friendships')
			.select('id')
			.or(`and(requester_id.eq.${user.id},addressee_id.eq.${friendId}),and(requester_id.eq.${friendId},addressee_id.eq.${user.id})`)
			.eq('status', 'accepted')
			.maybeSingle();

		if (!friendship) return fail(403, { error: 'Cet utilisateur n\'est pas dans ta liste d\'amis' });

		// Check not already a member
		const { data: existing } = await supabase
			.from('group_members')
			.select('id')
			.eq('group_id', params.id)
			.eq('user_id', friendId)
			.maybeSingle();

		if (existing) return fail(400, { error: 'Cet ami est déjà dans le groupe' });

		// Check not already invited
		const { data: existingInvite } = await supabase
			.from('group_invites')
			.select('id')
			.eq('group_id', params.id)
			.eq('user_id', friendId)
			.eq('status', 'pending')
			.maybeSingle();

		if (existingInvite) return fail(400, { error: 'Cet ami a déjà une invitation en attente' });

		const { error: insertError } = await supabase
			.from('group_invites')
			.insert({ group_id: params.id, user_id: friendId, invited_by: user.id, status: 'pending' });

		if (insertError) return fail(500, { error: insertError.message });

		return { inviteSent: true };
	}
};
