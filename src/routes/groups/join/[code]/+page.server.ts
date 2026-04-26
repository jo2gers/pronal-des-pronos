import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) redirect(303, `/auth/login?next=/groups/join/${encodeURIComponent(params.code)}`);

	// Look up the group by invite code (case-insensitive — codes are stored uppercase)
	const code = params.code.trim().toUpperCase();
	const { data: group } = await supabase
		.from('groups')
		.select('id, name, is_public')
		.eq('invite_code', code)
		.maybeSingle();

	if (!group) error(404, "Code d'invitation invalide");

	// Already a member? Just go to the group page.
	const { data: existing } = await supabase
		.from('group_members')
		.select('id')
		.eq('group_id', group.id)
		.eq('user_id', user.id)
		.maybeSingle();

	if (existing) redirect(303, `/groups/${group.id}`);

	// Public group → instant join.
	if (group.is_public !== false) {
		await supabase
			.from('group_members')
			.insert({ group_id: group.id, user_id: user.id, role: 'member' });
		redirect(303, `/groups/${group.id}`);
	}

	// Private group → create a pending join request (if not already pending) and
	// send the user back to /groups so they see the "awaiting approval" state.
	const { data: existingReq } = await supabase
		.from('group_join_requests')
		.select('id')
		.eq('group_id', group.id)
		.eq('user_id', user.id)
		.maybeSingle();

	if (!existingReq) {
		await supabase
			.from('group_join_requests')
			.insert({ group_id: group.id, user_id: user.id });
	}

	redirect(303, `/groups?requested=${encodeURIComponent(group.name)}`);
};
