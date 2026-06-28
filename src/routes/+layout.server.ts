import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { session, user } = await safeGetSession();

	// Site-wide announcement banner — shown to everyone, logged in or not, so it
	// is fetched before the no-user early return. Public-readable via RLS.
	const { data: settings } = await supabase
		.from('site_settings')
		.select('banner_message, banner_tone, banner_updated_at')
		.eq('id', 1)
		.maybeSingle();
	const banner = settings?.banner_message
		? {
			message: settings.banner_message as string,
			tone: ((settings.banner_tone as string) === 'warn' ? 'warn' : 'info') as 'info' | 'warn',
			updatedAt: (settings.banner_updated_at as string | null) ?? null
		}
		: null;

	if (!user) return { session, user, profile: null, friendNotifCount: 0, groupNotifCount: 0, inviteCount: 0, banner };

	// Admin group IDs (needed to count pending join requests)
	const { data: adminGroups } = await supabase
		.from('group_members')
		.select('group_id')
		.eq('user_id', user.id)
		.eq('role', 'admin');

	const adminGroupIds = (adminGroups ?? []).map((g) => g.group_id);

	const [{ count: friendCount }, joinResult, { count: inviteCount }, { data: profile }] = await Promise.all([
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
			.eq('status', 'pending'),
		supabase
			.from('profiles')
			.select('id, username, display_name, avatar_url')
			.eq('id', user.id)
			.maybeSingle()
	]);

	return {
		session,
		user,
		profile: profile ?? null,
		friendNotifCount: friendCount ?? 0,
		groupNotifCount:  (joinResult as { count: number | null }).count ?? 0,
		inviteCount: inviteCount ?? 0,
		banner
	};
};
