import { resolveCurrentComp } from '$lib/server/currentComp';
import type { PageServerLoad } from './$types';

// The home is the HALL of the game you're in — it opens directly on your current
// competition (the /[comp] cookie, else ?comp= switch, else Premier League), NOT
// a "choose every time" screen. A big banner names the competition and a switch
// button changes it. The WC archive lives on at /leaderboard, /matches, /wc-2026.
export const load: PageServerLoad = async ({ url, cookies, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	const { current, active } = await resolveCurrentComp(supabase, cookies, url.searchParams.get('comp'));

	let card: {
		slug: string;
		name_fr: string;
		name_en: string;
		starts_at: string | null;
		matchCount: number;
		next: { id: string; home_team: string; away_team: string; match_datetime: string }[];
		teamMap: Record<string, { short: string | null; logo: string | null }>;
		myTeam: string | null;
	} | null = null;

	// Logged-in dashboard for the current game: my total points + my points over
	// the last 7 days (in THIS competition — never mixed with the other game).
	let stats: { totalPoints: number; weekPoints: number } | null = null;

	if (current) {
		const [{ count: matchCount }, { data: next }, { data: teams }, favRes] = await Promise.all([
			supabase.from('matches').select('id', { count: 'exact', head: true }).eq('competition_id', current.id),
			supabase
				.from('matches')
				.select('id, home_team, away_team, match_datetime')
				.eq('competition_id', current.id)
				.eq('status', 'upcoming')
				.order('match_datetime', { ascending: true })
				.limit(3),
			supabase.from('competition_teams').select('name_en, short_name, logo_url').eq('competition_id', current.id),
			user
				? supabase
						.from('favorite_teams')
						.select('team, bonus_points')
						.eq('competition_id', current.id)
						.eq('user_id', user.id)
						.maybeSingle()
				: Promise.resolve({ data: null })
		]);

		const teamMap: Record<string, { short: string | null; logo: string | null }> = {};
		for (const t of teams ?? []) teamMap[t.name_en] = { short: t.short_name, logo: t.logo_url };

		card = {
			slug: current.slug,
			name_fr: current.name_fr,
			name_en: current.name_en,
			starts_at: current.starts_at,
			matchCount: matchCount ?? 0,
			next: (next ?? []) as any,
			teamMap,
			myTeam: (favRes.data as any)?.team ?? null
		};

		if (user) {
			const sevenDaysAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
			const nowIso = new Date().toISOString();
			const [{ data: agg }, { data: recent }] = await Promise.all([
				supabase
					.from('competition_pronostic_stats')
					.select('prono_points')
					.eq('user_id', user.id)
					.eq('competition_id', current.id)
					.maybeSingle(),
				supabase
					.from('matches')
					.select('id')
					.eq('competition_id', current.id)
					.gte('match_datetime', sevenDaysAgo)
					.lte('match_datetime', nowIso)
			]);

			const prono = parseFloat(String((agg as any)?.prono_points ?? 0));
			const bonus = parseFloat(String((favRes.data as any)?.bonus_points ?? 0));

			let weekPoints = 0;
			const recentIds = (recent ?? []).map((m) => m.id);
			if (recentIds.length > 0) {
				const { data: wp } = await supabase
					.from('pronostics')
					.select('points_earned')
					.eq('user_id', user.id)
					.eq('is_scored', true)
					.in('match_id', recentIds);
				weekPoints = (wp ?? []).reduce((s, p) => s + (p.points_earned ?? 0), 0);
			}

			stats = {
				totalPoints: parseFloat((prono + bonus).toFixed(2)),
				weekPoints: parseFloat(weekPoints.toFixed(2))
			};
		}
	}

	return { user, card, current, active, stats };
};
