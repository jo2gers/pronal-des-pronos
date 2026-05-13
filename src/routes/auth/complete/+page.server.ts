import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession }, url }) => {
	const { user } = await safeGetSession();
	if (!user) redirect(303, '/auth/login');

	const next = url.searchParams.get('next') ?? '/';

	const [{ data: profile }, { data: oddsData }, { data: scorerData }] = await Promise.all([
		supabase.from('profiles').select('username, favorite_team, top_scorer').eq('id', user.id).maybeSingle(),
		supabase.from('wc_winner_odds').select('team_name_en, odds'),
		supabase.from('wc_top_scorers').select('player_name, odds, multiplier').order('odds', { ascending: true })
	]);

	if (profile?.username && profile?.favorite_team) redirect(303, next);

	const oddsMap = Object.fromEntries(
		(oddsData ?? []).map((o) => [o.team_name_en, parseFloat(String(o.odds))])
	);
	const scorers = (scorerData ?? []).map((s) => ({
		player_name: s.player_name as string,
		odds: parseFloat(String(s.odds)),
		multiplier: parseFloat(String(s.multiplier))
	}));

	// Suggest a username from email prefix
	const suggestedUsername = user.email
		? user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 30)
		: '';

	return {
		next,
		email: user.email ?? '',
		profile,
		suggestedUsername,
		oddsMap,
		scorers
	};
};

export const actions: Actions = {
	default: async ({ request, locals: { supabase, safeGetSession } }) => {
		const form = await request.formData();
		const username = (form.get('username') as string).trim().toLowerCase();
		const favorite_team = (form.get('favorite_team') as string).trim();
		const top_scorer = ((form.get('top_scorer') as string) ?? '').trim();
		const next = (form.get('next') as string) || '/';

		const { user } = await safeGetSession();
		if (!user) return fail(401, { error: 'Non authentifié', username, favorite_team, top_scorer, next });

		if (!/^[a-z0-9_]{3,30}$/.test(username)) {
			return fail(400, {
				error: 'Nom d\'utilisateur invalide (3-30 caractères, lettres, chiffres, _)',
				username,
				favorite_team,
				top_scorer,
				next
			});
		}
		if (!favorite_team) {
			return fail(400, {
				error: 'Tu dois choisir une équipe favorite pour participer.',
				username,
				favorite_team,
				top_scorer,
				next
			});
		}

		// Upsert: handles both "trigger created an empty profile row" and "no profile yet" cases.
		const { error: upsertError } = await supabase
			.from('profiles')
			.upsert(
				{ id: user.id, username, favorite_team, top_scorer: top_scorer || null },
				{ onConflict: 'id' }
			);

		if (upsertError) {
			const msg = upsertError.message.includes('username')
				? 'Ce nom d\'utilisateur est déjà pris.'
				: upsertError.message;
			return fail(400, { error: msg, username, favorite_team, top_scorer, next });
		}

		redirect(303, next);
	}
};
