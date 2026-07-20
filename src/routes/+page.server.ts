import type { PageServerLoad } from './$types';

// Tournament over — the home page is the farewell screen: thank-you message,
// world champion, the players' final podium and links to the two surfaces that
// stay open (finished matches + final leaderboard). The old live/countdown/pick
// home (and its pronostic action) is retired; see git history.
export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();

	const [{ data: finalMatch }, { data: statRows }, { data: profiles }] = await Promise.all([
		supabase
			.from('matches')
			.select('id, home_team, away_team, home_flag, away_flag, home_score, away_score, ft_home_score, ft_away_score, pen_home, pen_away')
			.eq('slot_code', 'FINAL')
			.maybeSingle(),
		supabase.from('user_pronostic_stats').select('user_id, prono_points'),
		supabase.from('profiles').select('id, username, display_name, avatar_url, favorite_team, team_bonus_points')
	]);

	// Final standings — same math as the leaderboard (prono points + team bonus,
	// id tiebreak), computed once here for the podium + the visitor's final rank.
	const pronoByUser = new Map((statRows ?? []).map((r: any) => [r.user_id, parseFloat(String(r.prono_points ?? 0))]));
	const board = (profiles ?? [])
		.map((p: any) => ({
			id: p.id as string,
			username: p.username as string | null,
			display_name: p.display_name as string | null,
			avatar_url: p.avatar_url as string | null,
			favorite_team: p.favorite_team as string | null,
			total: (pronoByUser.get(p.id) ?? 0) + (p.team_bonus_points ?? 0)
		}))
		.sort((a, b) => b.total - a.total || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

	const idx = user ? board.findIndex((r) => r.id === user.id) : -1;

	// Feedback survey: proposed on the farewell page until THIS account answers.
	// Anonymous visitors see the invite too (the survey page routes via login).
	let surveyDone = false;
	if (user) {
		const { data: sr } = await supabase
			.from('survey_responses')
			.select('user_id')
			.eq('user_id', user.id)
			.maybeSingle();
		surveyDone = !!sr;
	}

	return {
		user,
		finalMatch,
		top3: board.slice(0, 3),
		myRank: idx >= 0 ? idx + 1 : null,
		playerCount: board.length,
		surveyDone
	};
};
