import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();

	const matchFields = 'id, home_team, away_team, home_flag, away_flag, stage, group_label, match_datetime, venue, status, home_score, away_score';

	const [{ data: liveMatches }, { data: nextMatch }, { data: upcomingMatches }, statsResult] =
		await Promise.all([
			// Live matches
			supabase
				.from('matches')
				.select(matchFields)
				.eq('status', 'live')
				.neq('home_team', 'TBD'),
			// Next upcoming match
			supabase
				.from('matches')
				.select(matchFields)
				.eq('status', 'upcoming')
				.neq('home_team', 'TBD')
				.order('match_datetime', { ascending: true })
				.limit(1)
				.maybeSingle(),
			// Next 5 upcoming for the list below
			supabase
				.from('matches')
				.select('id, home_team, away_team, home_flag, away_flag, stage, group_label, match_datetime, status')
				.eq('status', 'upcoming')
				.neq('home_team', 'TBD')
				.order('match_datetime', { ascending: true })
				.limit(5),
			user
				? supabase
						.from('pronostics')
						.select('match_id, predicted_home, predicted_away, points_earned')
						.eq('user_id', user.id)
				: Promise.resolve({ data: null })
		]);

	let stats = null;
	let userPronostics: Record<string, { predicted_home: number; predicted_away: number }> = {};

	if (user && statsResult.data) {
		const pronostics = statsResult.data;
		userPronostics = Object.fromEntries(
			pronostics.map((p) => [p.match_id, { predicted_home: p.predicted_home, predicted_away: p.predicted_away }])
		);

		const pronoPoints = pronostics.reduce((sum, p) => sum + (p.points_earned ?? 0), 0);

		// Fetch team bonus separately
		const { data: profileData } = await supabase
			.from('profiles')
			.select('team_bonus_points')
			.eq('id', user.id)
			.single();

		const teamBonus = profileData?.team_bonus_points ?? 0;
		const totalPoints = pronoPoints + teamBonus;

		const { count } = await supabase
			.from('pronostics')
			.select('user_id', { count: 'exact', head: true })
			.gt('points_earned', pronoPoints);

		stats = {
			totalPoints,
			pronoPoints,
			teamBonus,
			pronosticsCount: pronostics.length,
			rank: (count ?? 0) + 1
		};
	}

	return {
		liveMatches: liveMatches ?? [],
		nextMatch: nextMatch ?? null,
		upcomingMatches: upcomingMatches ?? [],
		stats,
		userPronostics
	};
};
