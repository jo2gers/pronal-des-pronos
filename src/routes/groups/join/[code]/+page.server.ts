import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) redirect(303, `/auth/login?next=/groups/join/${params.code}`);

	const { data: group } = await supabase
		.from('groups')
		.select('id, name')
		.eq('invite_code', params.code)
		.single();

	if (!group) error(404, 'Code d\'invitation invalide');

	// Already a member?
	const { data: existing } = await supabase
		.from('group_members')
		.select('id')
		.eq('group_id', group.id)
		.eq('user_id', user.id)
		.maybeSingle();

	if (!existing) {
		await supabase
			.from('group_members')
			.insert({ group_id: group.id, user_id: user.id, role: 'member' });
	}

	redirect(303, `/groups/${group.id}`);
};
