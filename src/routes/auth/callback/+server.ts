import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals: { supabase } }) => {
	const code = url.searchParams.get('code');
	const next = url.searchParams.get('next') ?? '/';

	if (!code) redirect(303, '/auth/login?error=oauth_no_code');

	const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
	if (exchangeError) redirect(303, `/auth/login?error=oauth_exchange`);

	// First-time OAuth users won't have a complete profile yet — gate them through onboarding.
	const { data: { user } } = await supabase.auth.getUser();
	if (user) {
		const { data: profile } = await supabase
			.from('profiles')
			.select('username, favorite_team')
			.eq('id', user.id)
			.maybeSingle();

		const incomplete = !profile || !profile.username || !profile.favorite_team;
		if (incomplete) redirect(303, `/auth/complete?next=${encodeURIComponent(next)}`);
	}

	redirect(303, next);
};
