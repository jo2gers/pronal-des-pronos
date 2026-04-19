import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) redirect(303, '/auth/login');

	const { data: memberships } = await supabase
		.from('group_members')
		.select('role, groups(id, name, description, invite_code, created_at)')
		.eq('user_id', user.id);

	const groups = (memberships ?? []).map((m) => ({
		...m.groups,
		role: m.role
	}));

	return { groups };
};
