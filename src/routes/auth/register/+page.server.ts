import { fail, redirect } from '@sveltejs/kit';
import { safeNext } from '$lib/utils';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { safeGetSession }, url }) => {
	const { user } = await safeGetSession();
	const next = safeNext(url.searchParams.get('next'));
	if (user) redirect(303, next);

	return { next };
};

export const actions: Actions = {
	default: async ({ request, locals: { supabase } }) => {
		const form = await request.formData();
		const email = form.get('email') as string;
		const password = form.get('password') as string;
		const username = (form.get('username') as string).trim().toLowerCase();
		const next = safeNext(form.get('next') as string);

		if (!/^[a-z0-9_]{3,30}$/.test(username)) {
			return fail(400, {
				error: 'Nom d\'utilisateur invalide (3-30 caractères, lettres, chiffres, _)',
				email,
				username,
				next
			});
		}

		// Pre-check availability so a taken username gets a friendly message
		// instead of the raw Postgres unique-violation (the handle_new_user trigger
		// surfaces it as an opaque "Database error saving new user"). profiles is
		// public-read, so the anon register client can run this.
		const { data: taken } = await supabase
			.from('profiles').select('id').eq('username', username).maybeSingle();
		if (taken) return fail(400, { error: 'Ce nom d\'utilisateur est déjà pris.', email, username, next });

		// V2: no forced favourite team at sign-up — the club is picked per
		// competition on /[comp]/team (profiles.favorite_team stays the WC
		// archive field and is no longer written here).
		const { data, error } = await supabase.auth.signUp({
			email,
			password,
			options: { data: { username } }
		});

		if (error) {
			// A same-username race that slipped past the pre-check surfaces here as
			// the trigger's unique-violation — still show the friendly message.
			const msg = /username|profiles_username_key|duplicate|saving new user/i.test(error.message)
				? 'Ce nom d\'utilisateur est déjà pris.'
				: error.message;
			return fail(400, { error: msg, email, username, next });
		}
		if (!data.user) return fail(400, { error: 'Erreur lors de la création du compte', email, username, next });

		await supabase.from('profiles').update({ username }).eq('id', data.user.id);

		redirect(303, next);
	}
};
