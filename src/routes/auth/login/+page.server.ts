import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { safeGetSession }, url }) => {
	const { user } = await safeGetSession();
	const next = url.searchParams.get('next') ?? '/';
	if (user) redirect(303, next);

	const errorCode = url.searchParams.get('error');
	const detail = url.searchParams.get('detail');
	const errorMap: Record<string, string> = {
		oauth_no_code: 'Connexion Google annulée ou code manquant.',
		oauth_exchange: 'Échec de l\'échange du code OAuth.',
		oauth_no_user: 'L\'échange Google a réussi mais aucune session n\'a été créée — souvent un souci de cookies tiers.',
		oauth: 'Connexion Google indisponible. Réessaie ou utilise email + mot de passe.'
	};
	const baseMsg = errorCode ? (errorMap[errorCode] ?? `Erreur OAuth: ${errorCode}`) : null;
	const oauthError = baseMsg ? (detail ? `${baseMsg} (${detail})` : baseMsg) : null;

	return { next, oauthError };
};

export const actions: Actions = {
	default: async ({ request, locals: { supabase } }) => {
		const form = await request.formData();
		const email = form.get('email') as string;
		const password = form.get('password') as string;
		const next = (form.get('next') as string) || '/';

		const { error } = await supabase.auth.signInWithPassword({ email, password });

		if (error) return fail(400, { error: error.message, next });

		redirect(303, next);
	}
};
