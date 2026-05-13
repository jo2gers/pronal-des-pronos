import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals: { supabase } }) => {
	const code = url.searchParams.get('code');
	const next = url.searchParams.get('next') ?? '/';

	console.log('[oauth-callback] hit', { hasCode: !!code, next });

	if (!code) redirect(303, '/auth/login?error=oauth_no_code');

	const { data: exchangeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
	console.log('[oauth-callback] exchange', {
		hasUser: !!exchangeData?.user,
		hasSession: !!exchangeData?.session,
		error: exchangeError?.message
	});

	if (exchangeError) {
		const msg = encodeURIComponent(exchangeError.message);
		redirect(303, `/auth/login?error=oauth_exchange&detail=${msg}`);
	}

	// Trust the exchange result directly — no need to round-trip getUser().
	const user = exchangeData?.user;
	if (!user) redirect(303, '/auth/login?error=oauth_no_user');

	// First-time OAuth users won't have a complete profile yet — gate them through onboarding.
	const { data: profile, error: profileError } = await supabase
		.from('profiles')
		.select('username, favorite_team')
		.eq('id', user.id)
		.maybeSingle();

	console.log('[oauth-callback] profile lookup', {
		userId: user.id,
		hasProfile: !!profile,
		username: profile?.username,
		favoriteTeam: profile?.favorite_team,
		error: profileError?.message
	});

	const incomplete = !profile || !profile.username || !profile.favorite_team;
	if (incomplete) redirect(303, `/auth/complete?next=${encodeURIComponent(next)}`);

	redirect(303, next);
};
