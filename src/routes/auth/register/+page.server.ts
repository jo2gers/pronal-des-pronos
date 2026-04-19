import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (user) redirect(303, '/');
	return {};
};

export const actions: Actions = {
	default: async ({ request, locals: { supabase } }) => {
		const form = await request.formData();
		const email = form.get('email') as string;
		const password = form.get('password') as string;
		const username = (form.get('username') as string).trim().toLowerCase();

		if (!/^[a-z0-9_]{3,30}$/.test(username)) {
			return fail(400, {
				error: 'Nom d\'utilisateur invalide (3-30 caractères, lettres, chiffres, _)',
				email,
				username
			});
		}

		const { data, error } = await supabase.auth.signUp({
			email,
			password,
			options: { data: { username } }
		});

		if (error) return fail(400, { error: error.message, email, username });
		if (!data.user) return fail(400, { error: 'Erreur lors de la création du compte', email, username });

		// Update the profile username (trigger may use email prefix; overwrite with chosen username)
		await supabase
			.from('profiles')
			.update({ username })
			.eq('id', data.user.id);

		redirect(303, '/');
	}
};
