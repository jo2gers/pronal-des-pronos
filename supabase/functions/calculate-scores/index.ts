import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

function calculatePoints(
	predictedHome: number,
	predictedAway: number,
	actualHome: number,
	actualAway: number,
	oddsUsed: number
): number {
	if (predictedHome === actualHome && predictedAway === actualAway) {
		return +(3 * oddsUsed).toFixed(3);
	}
	const predictedResult = Math.sign(predictedHome - predictedAway);
	const actualResult = Math.sign(actualHome - actualAway);
	if (predictedResult === actualResult) {
		return +(1 * oddsUsed).toFixed(3);
	}
	return 0;
}

// Bonus points awarded to supporters of the winning team, per stage
// The idea: the further your team goes, the bigger the reward
const STAGE_BONUS: Record<string, number> = {
	group:       1,   // +1 pt per group stage win
	round_of_32: 2,   // +2 pts
	round_of_16: 4,   // +4 pts
	quarters:    8,   // +8 pts
	semis:       13,  // +13 pts
	final:       21,  // +21 pts for winning the World Cup!
	third:       5,   // +5 pts for winning 3rd place match
};

Deno.serve(async (req) => {
	const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

	const body = await req.json().catch(() => ({}));
	const matchId = body.match_id as string | undefined;

	if (!matchId) {
		return new Response(JSON.stringify({ error: 'match_id required' }), { status: 400 });
	}

	const { data: match } = await supabase
		.from('matches')
		.select('id, home_team, away_team, home_score, away_score, status, stage, bonus_calculated')
		.eq('id', matchId)
		.single();

	if (!match || match.status !== 'finished' || match.home_score == null || match.away_score == null) {
		return new Response(JSON.stringify({ error: 'Match not finished or scores not set' }), { status: 400 });
	}

	// ── 1. Score pronostics ──────────────────────────────────────────────────
	const { data: pronostics } = await supabase
		.from('pronostics')
		.select('id, predicted_home, predicted_away, odds_used')
		.eq('match_id', matchId)
		.eq('is_scored', false);

	let scored = 0;

	for (const p of pronostics ?? []) {
		const points = calculatePoints(
			p.predicted_home,
			p.predicted_away,
			match.home_score,
			match.away_score,
			p.odds_used ?? 1.0
		);

		await supabase
			.from('pronostics')
			.update({ points_earned: points, is_scored: true })
			.eq('id', p.id);

		scored++;
	}

	// ── 2. Award favorite team bonus ─────────────────────────────────────────
	let bonusAwarded = 0;

	if (!match.bonus_calculated) {
		const stageBonus = STAGE_BONUS[match.stage] ?? 0;

		if (stageBonus > 0) {
			// Determine match winner (no winner on draw in group stage)
			let winnerTeam: string | null = null;
			if (match.home_score > match.away_score) {
				winnerTeam = match.home_team;
			} else if (match.away_score > match.home_score) {
				winnerTeam = match.away_team;
			}
			// Group stage draws: no bonus. Knockout draws resolved by penalties —
			// we treat higher score as winner (admin sets final score incl. pens if needed)

			if (winnerTeam) {
				// Find all profiles whose favorite_team = winnerTeam
				const { data: supporters } = await supabase
					.from('profiles')
					.select('id, team_bonus_points')
					.eq('favorite_team', winnerTeam);

				for (const profile of supporters ?? []) {
					await supabase
						.from('profiles')
						.update({ team_bonus_points: (profile.team_bonus_points ?? 0) + stageBonus })
						.eq('id', profile.id);

					bonusAwarded++;
				}
			}
		}

		// Mark bonus as calculated so re-runs don't double-award
		await supabase
			.from('matches')
			.update({ bonus_calculated: true })
			.eq('id', matchId);
	}

	return new Response(
		JSON.stringify({ success: true, scored, bonusAwarded }),
		{ headers: { 'Content-Type': 'application/json' } }
	);
});
