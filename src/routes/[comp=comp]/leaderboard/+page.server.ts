import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, locals: { supabase, safeGetSession } }) => {
	const { competition } = await parent();
	const { user } = await safeGetSession();

	const [{ data: stats }, { data: profiles }] = await Promise.all([
		supabase
			.from('competition_pronostic_stats')
			.select('user_id, prono_points, picks, winners, exact')
			.eq('competition_id', competition.id),
		supabase.from('profiles').select('id, username, display_name, avatar_url')
	]);

	const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

	// Total = prono points for now. The V2 per-competition team bonus (survey
	// signal: only 4/7 liked the WC one — it's being rethought) plugs in here
	// once favorite_teams + competition_winner_odds are wired.
	const rows = (stats ?? [])
		.map((s: any) => ({
			userId: s.user_id as string,
			user: profileById.get(s.user_id) ?? null,
			picks: s.picks as number,
			winners: s.winners as number,
			exact: s.exact as number,
			total: parseFloat(String(s.prono_points ?? 0))
		}))
		.sort((a, b) => b.total - a.total || (a.userId < b.userId ? -1 : 1));

	return { rows, currentUserId: user?.id ?? null };
};
