import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { safeGetSession }, url }) => {
	const { user } = await safeGetSession();
	const next = url.searchParams.get('next') ?? '/';
	if (user) redirect(303, next);

	return { next };
};

export const actions: Actions = {
	default: async ({ request, locals: { supabase } }) => {
		const form = await request.formData();
		const email = form.get('email') as string;
		const password = form.get('password') as string;
		const username = (form.get('username') as string).trim().toLowerCase();
		const next = (form.get('next') as string) || '/';

		if (!/^[a-z0-9_]{3,30}$/.test(username)) {
			return fail(400, {
				error: 'Nom d\'utilisateur invalide (3-30 caractères, lettres, chiffres, _)',
				email,
				username,
				next
			});
		}

		// V2: no forced favourite team at sign-up — the club is picked per
		// competition on /[comp]/team (profiles.favorite_team stays the WC
		// archive field and is no longer written here).
		const { data, error } = await supabase.auth.signUp({
			email,
			password,
			options: { data: { username } }
		});

		if (error) return fail(400, { error: error.message, email, username, next });
		if (!data.user) return fail(400, { error: 'Erreur lors de la création du compte', email, username, next });

		await supabase.from('profiles').update({ username }).eq('id', data.user.id);

		redirect(303, next);
	}
};
