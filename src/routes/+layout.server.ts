import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { session, user } = await safeGetSession();

	if (!user) return { session, user, friendNotifCount: 0, groupNotifCount: 0 };

	// Admin group IDs (needed to count pending join requests)
	const { data: adminGroups } = await supabase
		.from('group_members')
		.select('group_id')
		.eq('user_id', user.id)
		.eq('role', 'admin');

	const adminGroupIds = (adminGroups ?? []).map((g) => g.group_id);

	const [{ count: friendCount }, joinResult, { count: inviteCount }] = await Promise.all([
		supabase
			.from('friendships')
			.select('id', { count: 'exact', head: true })
			.eq('addressee_id', user.id)
			.eq('status', 'pending'),
		adminGroupIds.length > 0
			? supabase
				.from('group_join_requests')
				.select('id', { count: 'exact', head: true })
				.eq('status', 'pending')
				.in('group_id', adminGroupIds)
			: Promise.resolve({ count: 0 }),
		supabase
			.from('group_invites')
			.select('id', { count: 'exact', head: true })
			.eq('user_id', user.id)
			.eq('status', 'pending')
	]);

	return {
		session,
		user,
		friendNotifCount: friendCount ?? 0,
		groupNotifCount:  (joinResult as { count: number | null }).count ?? 0,
		inviteCount: inviteCount ?? 0
	};
};
