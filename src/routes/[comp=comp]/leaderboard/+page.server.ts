import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, locals: { supabase, safeGetSession } }) => {
	const { competition } = await parent();
	const { user } = await safeGetSession();

	const [{ data: stats }, { data: profiles }, { data: favs }] = await Promise.all([
		supabase
			.from('competition_pronostic_stats')
			.select('user_id, prono_points, picks, winners, exact')
			.eq('competition_id', competition.id),
		supabase.from('profiles').select('id, username, display_name, avatar_url'),
		supabase
			.from('favorite_teams')
			.select('user_id, team, bonus_points')
			.eq('competition_id', competition.id)
	]);

	const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
	const favByUser = new Map((favs ?? []).map((f: any) => [f.user_id, f]));

	// Total = prono points + the per-competition favourite-club bonus. Users
	// with a bonus but no scored pick yet still appear (their club won before
	// they made a pick) — union both sources.
	const userIds = new Set<string>([
		...(stats ?? []).map((s: any) => s.user_id as string),
		...(favs ?? []).filter((f: any) => parseFloat(String(f.bonus_points ?? 0)) > 0).map((f: any) => f.user_id as string)
	]);
	const statByUser = new Map((stats ?? []).map((s: any) => [s.user_id, s]));

	const rows = [...userIds]
		.map((userId) => {
			const s: any = statByUser.get(userId) ?? {};
			const bonus = parseFloat(String(favByUser.get(userId)?.bonus_points ?? 0));
			return {
				userId,
				user: profileById.get(userId) ?? null,
				favTeam: (favByUser.get(userId)?.team as string) ?? null,
				picks: (s.picks as number) ?? 0,
				winners: (s.winners as number) ?? 0,
				exact: (s.exact as number) ?? 0,
				bonus,
				total: parseFloat(String(s.prono_points ?? 0)) + bonus
			};
		})
		.sort((a, b) => b.total - a.total || (a.userId < b.userId ? -1 : 1));

	return { rows, currentUserId: user?.id ?? null };
};
