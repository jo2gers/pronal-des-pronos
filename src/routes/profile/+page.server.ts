import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) redirect(303, '/auth/login');

	const { data: profile } = await supabase
		.from('profiles')
		.select('*')
		.eq('id', user.id)
		.single();

	return { profile };
};

export const actions: Actions = {
	update: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user) return fail(401, { error: 'Non authentifié' });

		const form = await request.formData();
		const display_name = (form.get('display_name') as string).trim();
		const favorite_team = form.get('favorite_team') as string;
		const country = form.get('country') as string;

		const { error } = await supabase
			.from('profiles')
			.update({ display_name, favorite_team, country })
			.eq('id', user.id);

		if (error) return fail(500, { error: error.message });
		return { success: true };
	},

	avatar: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user) return fail(401, { error: 'Non authentifié' });

		const form = await request.formData();
		const file = form.get('avatar') as File;

		if (!file || file.size === 0) return fail(400, { error: 'Aucun fichier sélectionné' });
		if (file.size > 2 * 1024 * 1024) return fail(400, { error: 'Fichier trop grand (max 2MB)' });

		const ext = file.name.split('.').pop();
		const path = `${user.id}/avatar.${ext}`;

		const { error: uploadError } = await supabase.storage
			.from('avatars')
			.upload(path, file, { upsert: true });

		if (uploadError) return fail(500, { error: uploadError.message });

		const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);

		await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);

		return { success: true };
	}
};
