import { redirect } from '@sveltejs/kit';
import { safeNext } from '$lib/utils';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals: { supabase } }) => {
	const code = url.searchParams.get('code');
	const next = safeNext(url.searchParams.get('next'));

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
		.select('username, favorite_team, avatar_url, display_name')
		.eq('id', user.id)
		.maybeSingle();

	console.log('[oauth-callback] profile lookup', {
		userId: user.id,
		hasProfile: !!profile,
		username: profile?.username,
		favoriteTeam: profile?.favorite_team,
		error: profileError?.message
	});

	// Pull Google's avatar + display name into the profile on first OAuth sign-in.
	// Google's user_metadata typically carries:
	//   avatar_url / picture  → profile photo URL
	//   full_name / name      → display name
	// We only overwrite columns that are still null, so a user who later changes
	// their own display name or avatar isn't reset on every callback.
	const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
	const googleAvatar = (meta.avatar_url ?? meta.picture) as string | undefined;
	const googleName   = (meta.full_name ?? meta.name) as string | undefined;

	const updates: Record<string, string> = {};
	if (googleAvatar && !profile?.avatar_url)   updates.avatar_url   = googleAvatar;
	if (googleName   && !profile?.display_name) updates.display_name = googleName;

	if (Object.keys(updates).length > 0) {
		const { error: updErr } = await supabase
			.from('profiles')
			.update(updates)
			.eq('id', user.id);
		if (updErr) console.log('[oauth-callback] avatar/name backfill failed', updErr.message);
	}

	// Onboarding gates on the username alone. favorite_team is the retired WC
	// archive column (always null in V2), so including it made `incomplete`
	// permanently true → a wasted callback→complete→next bounce on every OAuth
	// login, and the username picker unreachable.
	const incomplete = !profile || !profile.username;
	if (incomplete) redirect(303, `/auth/complete?next=${encodeURIComponent(next)}`);

	redirect(303, next);
};
