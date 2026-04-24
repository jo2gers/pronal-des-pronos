import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession }, url }) => {
	const { user } = await safeGetSession();
	const next = url.searchParams.get('next') ?? '/';
	if (user) redirect(303, next);

	const { data: oddsData } = await supabase
		.from('wc_winner_odds')
		.select('team_name_en, odds');

	const oddsMap = Object.fromEntries(
		(oddsData ?? []).map((o) => [o.team_name_en, parseFloat(String(o.odds))])
	);

	return { next, oddsMap };
};

export const actions: Actions = {
	default: async ({ request, locals: { supabase } }) => {
		const form = await request.formData();
		const email = form.get('email') as string;
		const password = form.get('password') as string;
		const username = (form.get('username') as string).trim().toLowerCase();
		const favorite_team = (form.get('favorite_team') as string).trim();
		const next = (form.get('next') as string) || '/';

		if (!/^[a-z0-9_]{3,30}$/.test(username)) {
			return fail(400, {
				error: 'Nom d\'utilisateur invalide (3-30 caractères, lettres, chiffres, _)',
				email,
				username,
				next
			});
		}

		if (!favorite_team) {
			return fail(400, {
				error: 'Tu dois choisir une équipe favorite pour participer.',
				email,
				username,
				next
			});
		}

		const { data, error } = await supabase.auth.signUp({
			email,
			password,
			options: { data: { username } }
		});

		if (error) return fail(400, { error: error.message, email, username, next });
		if (!data.user) return fail(400, { error: 'Erreur lors de la création du compte', email, username, next });

		// Update the profile username and favorite team
		await supabase
			.from('profiles')
			.update({ username, favorite_team })
			.eq('id', data.user.id);

		redirect(303, next);
	}
};
