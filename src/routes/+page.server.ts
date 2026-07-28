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
						.select('team')
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
	}

	return { user, card, current, active };
};
