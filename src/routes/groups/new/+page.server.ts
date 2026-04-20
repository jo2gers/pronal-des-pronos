import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) redirect(303, '/auth/login');
	return {};
};

export const actions: Actions = {
	default: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user) return fail(401, { error: 'Non authentifié' });

		const form = await request.formData();
		const name = (form.get('name') as string).trim();
		const description = (form.get('description') as string).trim();

		if (!name) return fail(400, { error: 'Le nom est obligatoire' });

		// Generate UUID here so we can insert group_members immediately after
		// without needing to SELECT the new group (which would fail RLS before membership exists)
		const groupId = crypto.randomUUID();

		const { error: groupError } = await supabase
			.from('groups')
			.insert({ id: groupId, name, description: description || null, creator_id: user.id });

		if (groupError) return fail(500, { error: groupError.message });

		const { error: memberError } = await supabase
			.from('group_members')
			.insert({ group_id: groupId, user_id: user.id, role: 'admin' });

		if (memberError) return fail(500, { error: memberError.message });

		redirect(303, `/groups/${groupId}`);
	}
};
