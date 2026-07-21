import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, locals: { supabase } }) => {
	const { competition } = await parent();

	const [{ data: matches }, { data: teams }] = await Promise.all([
		supabase
			.from('matches')
			.select('id, home_team, away_team, match_datetime, status, home_score, away_score, venue, matchday, stage')
			.eq('competition_id', competition.id)
			.order('match_datetime', { ascending: true }),
		supabase
			.from('competition_teams')
			.select('name_en, short_name, logo_url')
			.eq('competition_id', competition.id)
	]);

	// name → {short, logo} for the club badges (V2 competitions have crests,
	// not the country flags the WC archive uses).
	const teamMap: Record<string, { short: string | null; logo: string | null }> = {};
	for (const t of teams ?? []) teamMap[t.name_en] = { short: t.short_name, logo: t.logo_url };

	return { matches: matches ?? [], teamMap };
};
