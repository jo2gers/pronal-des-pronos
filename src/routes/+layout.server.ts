import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

// Tournament over (final played 2026-07-19) — the site is a read-only archive.
// Open: the farewell home, finished matches (+ detail), the leaderboard, and
// profiles (the leaderboard links to them). Everything else redirects home.
// Central here so every sub-route is covered without per-page guards. /admin
// stays reachable (password-gated); /api endpoints don't run layout loads.
// V2 launch: registration, leagues (per-competition since migration 045),
// friends and the rewritten rules page are OPEN again. Still closed — pure
// WC-archive views: bracket/schedule and teams (country pages).
const CLOSED_PREFIXES = [
	'/bracket',
	'/schedule',
	'/teams'
];

export const load: LayoutServerLoad = async ({ url, locals: { supabase, safeGetSession } }) => {
	if (CLOSED_PREFIXES.some((p) => url.pathname === p || url.pathname.startsWith(p + '/'))) {
		redirect(302, '/');
	}

	const { session, user } = await safeGetSession();

	// Site-wide announcement banner — shown to everyone, logged in or not, so it
	// is fetched before the no-user early return. Public-readable via RLS. We
	// store only a key (predefined, translated message); the layout resolves it
	// to the visitor's language.
	const { data: settings } = await supabase
		.from('site_settings')
		.select('banner_key, banner_updated_at')
		.eq('id', 1)
		.maybeSingle();
	const banner = settings?.banner_key
		? { id: settings.banner_key as string, updatedAt: (settings.banner_updated_at as string | null) ?? null }
		: null;

	if (!user)
		return { session, user, profile: null, friendNotifCount: 0, groupNotifCount: 0, inviteCount: 0, banner, surveyDone: false };

	// Admin group IDs (needed to count pending join requests)
	const { data: adminGroups } = await supabase
		.from('group_members')
		.select('group_id')
		.eq('user_id', user.id)
		.eq('role', 'admin');

	const adminGroupIds = (adminGroups ?? []).map((g) => g.group_id);

	const [{ count: friendCount }, joinResult, { count: inviteCount }, { data: profile }, { data: surveyRow }] = await Promise.all([
		supabase
			.from('friendships')
			.select('id', { count: 'exact', head: true })
			.eq('addressee_id', user.id)
			.eq('status', 'pending'),
		adminGroupIds.length > 0
			? supabase
				.from('group_join_requests')
				.select('id', { count: 'exact', head: true })
				.eq('status', 'pending')
				.in('group_id', adminGroupIds)
			: Promise.resolve({ count: 0 }),
		supabase
			.from('group_invites')
			.select('id', { count: 'exact', head: true })
			.eq('user_id', user.id)
			.eq('status', 'pending'),
		supabase
			.from('profiles')
			.select('id, username, display_name, avatar_url')
			.eq('id', user.id)
			.maybeSingle(),
		// Feedback survey — the nav tab + home invite hide once this account answered.
		supabase
			.from('survey_responses')
			.select('user_id')
			.eq('user_id', user.id)
			.maybeSingle()
	]);

	return {
		session,
		user,
		profile: profile ?? null,
		friendNotifCount: friendCount ?? 0,
		groupNotifCount:  (joinResult as { count: number | null }).count ?? 0,
		inviteCount: inviteCount ?? 0,
		banner,
		surveyDone: !!surveyRow
	};
};
