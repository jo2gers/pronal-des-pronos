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

		const { data: group, error: groupError } = await supabase
			.from('groups')
			.insert({ name, description: description || null, creator_id: user.id })
			.select()
			.single();

		if (groupError || !group) return fail(500, { error: groupError?.message ?? 'Erreur création' });

		// Creator becomes admin
		await supabase
			.from('group_members')
			.insert({ group_id: group.id, user_id: user.id, role: 'admin' });

		redirect(303, `/groups/${group.id}`);
	}
};
