import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

// OAuth profile completion: only the username now. V2 dropped the forced
// favourite team at sign-up — the club is picked per competition on
// /[comp]/team (profiles.favorite_team stays the WC archive field).
export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession }, url }) => {
	const { user } = await safeGetSession();
	if (!user) redirect(303, '/auth/login');

	const next = url.searchParams.get('next') ?? '/';

	const { data: profile } = await supabase
		.from('profiles')
		.select('username')
		.eq('id', user.id)
		.maybeSingle();

	if (profile?.username) redirect(303, next);

	// Suggest a username from email prefix
	const suggestedUsername = user.email
		? user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 30)
		: '';

	return {
		next,
		email: user.email ?? '',
		profile,
		suggestedUsername
	};
};

export const actions: Actions = {
	default: async ({ request, locals: { supabase, safeGetSession } }) => {
		const form = await request.formData();
		const username = (form.get('username') as string).trim().toLowerCase();
		const next = (form.get('next') as string) || '/';

		const { user } = await safeGetSession();
		if (!user) return fail(401, { error: 'Non authentifié', username, next });

		if (!/^[a-z0-9_]{3,30}$/.test(username)) {
			return fail(400, {
				error: 'Nom d\'utilisateur invalide (3-30 caractères, lettres, chiffres, _)',
				username, next
			});
		}

		const { error: upsertError } = await supabase
			.from('profiles')
			.upsert({ id: user.id, username }, { onConflict: 'id' });

		if (upsertError) {
			const msg = upsertError.message.includes('username')
				? 'Ce nom d\'utilisateur est déjà pris.'
				: upsertError.message;
			return fail(400, { error: msg, username, next });
		}

		redirect(303, next);
	}
};
