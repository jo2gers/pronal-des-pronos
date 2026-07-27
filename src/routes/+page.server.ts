import type { PageServerLoad } from './$types';

// V2 season home: one card per active competition — next fixtures, your club,
// the doors in (picks / club / leaderboard). The WC2026 farewell home this
// replaces lives in git history; the archive itself stays at /matches,
// /leaderboard and /wc-2026/….
export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();

	const { data: comps } = await supabase
		.from('competitions')
		.select('id, slug, name_fr, name_en, format, starts_at')
		.eq('active', true)
		.order('starts_at', { ascending: true });

	const cards = await Promise.all(
		(comps ?? []).map(async (c) => {
			const [{ count: matchCount }, { data: next }, { data: teams }, favRes] = await Promise.all([
				supabase.from('matches').select('id', { count: 'exact', head: true }).eq('competition_id', c.id),
				supabase
					.from('matches')
					.select('id, home_team, away_team, match_datetime, matchday')
					.eq('competition_id', c.id)
					.eq('status', 'upcoming')
					.order('match_datetime', { ascending: true })
					.limit(3),
				supabase.from('competition_teams').select('name_en, short_name, logo_url').eq('competition_id', c.id),
				user
					? supabase
							.from('favorite_teams')
							.select('team, bonus_points')
							.eq('competition_id', c.id)
							.eq('user_id', user.id)
							.maybeSingle()
					: Promise.resolve({ data: null })
			]);

			const teamMap: Record<string, { short: string | null; logo: string | null }> = {};
			for (const t of teams ?? []) teamMap[t.name_en] = { short: t.short_name, logo: t.logo_url };

			return {
				slug: c.slug as string,
				name_fr: c.name_fr as string,
				name_en: c.name_en as string,
				starts_at: c.starts_at as string | null,
				matchCount: matchCount ?? 0,
				next: next ?? [],
				teamMap,
				myTeam: (favRes.data as any)?.team ?? null
			};
		})
	);

	return { user, cards };
};
