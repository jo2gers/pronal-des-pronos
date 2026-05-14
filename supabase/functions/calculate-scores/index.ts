import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL              = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

function calculatePoints(
	predictedHome: number,
	predictedAway: number,
	actualHome: number,
	actualAway: number,
	oddsUsed: number
): number {
	console.log('calculatePoints input:', { predictedHome, predictedAway, actualHome, actualAway, oddsUsed });

	const basePoints =
		predictedHome === actualHome && predictedAway === actualAway ? 3 :
		Math.sign(predictedHome - predictedAway) === Math.sign(actualHome - actualAway) ? 1 :
		0;

	if (basePoints === 0) return 0;

	// Floor odds at 1.0: a stored 0 (bad Polymarket feed) or NaN would otherwise
	// zero out the user's points despite a correct prediction.
	const safeOdds = Number.isFinite(oddsUsed) && oddsUsed >= 1 ? oddsUsed : 1.0;
	return parseFloat((basePoints * safeOdds).toFixed(2));
}

// Base bonus points per stage win (before applying WC-odds multiplier)
const STAGE_BONUS: Record<string, number> = {
	group:       1,   // +1 pt base per group stage win
	round_of_32: 2,
	round_of_16: 3,
	quarters:    5,
	semis:       8,
	final:       13,  // winning the World Cup
	third:       3,   // 3rd place match
};

Deno.serve(async (req) => {
	const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

	const body    = await req.json().catch(() => ({}));
	const matchId = body.match_id as string | undefined;
	// When force=true, rescore every pronostic for this match (not just unscored
	// ones). Use this after fixing a scoring bug to recompute existing rows.
	const force   = body.force === true;

	if (!matchId) {
		return new Response(JSON.stringify({ error: 'match_id required' }), { status: 400 });
	}

	const { data: match } = await supabase
		.from('matches')
		.select('id, home_team, away_team, home_score, away_score, status, stage, bonus_calculated')
		.eq('id', matchId)
		.single();

	if (!match) {
		return new Response(JSON.stringify({ error: 'Match introuvable' }), { status: 400 });
	}
	if (match.status !== 'finished') {
		return new Response(JSON.stringify({ error: `Statut actuel: "${match.status}". Marque le match "Terminé" et attends que le score soit enregistré avant de calculer.` }), { status: 400 });
	}
	if (match.home_score == null || match.away_score == null) {
		return new Response(JSON.stringify({ error: 'Scores manquants (null en base). Mets les deux scores puis recalcule.' }), { status: 400 });
	}

	// ── 1. Score pronostics ──────────────────────────────────────────────────────
	let pronosticsQuery = supabase
		.from('pronostics')
		.select('id, predicted_home, predicted_away, odds_used')
		.eq('match_id', matchId);
	if (!force) pronosticsQuery = pronosticsQuery.eq('is_scored', false);
	const { data: pronostics } = await pronosticsQuery;

	let scored = 0;

	for (const p of pronostics ?? []) {
		console.log('Scoring pronostic:', { pronostic_id: p.id, predicted_home: p.predicted_home, predicted_away: p.predicted_away, actual_home: match.home_score, actual_away: match.away_score, odds_used: p.odds_used });
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

	// ── 2. Award favourite-team bonus (scaled by WC winner odds) ─────────────────
	let bonusAwarded = 0;

	if (!match.bonus_calculated) {
		const stageBonus = STAGE_BONUS[match.stage] ?? 0;

		if (stageBonus > 0) {
			// Determine match winner (draws give no bonus in group stage)
			let winnerTeamEn: string | null = null;
			if (match.home_score > match.away_score) winnerTeamEn = match.home_team;
			else if (match.away_score > match.home_score) winnerTeamEn = match.away_team;

			if (winnerTeamEn) {
				// Look up WC odds for the winning team —
				// multiplier = ROUND(LN(odds), 1), e.g. 1.7 for Spain, 4.4 for Mexico, 8.0 for Haiti
				// team_name_fr bridges English match names → French profile.favorite_team values
				const { data: oddsRow } = await supabase
					.from('wc_winner_odds')
					.select('multiplier, team_name_fr')
					.eq('team_name_en', winnerTeamEn)
					.maybeSingle();

				const multiplier   = +(oddsRow?.multiplier ?? 1.0);
			const bonusToAward = parseFloat((multiplier * stageBonus).toFixed(2));
				// Find all users whose favourite team is the winner
				// favorite_team stores English names (from WC2026_TEAMS), so match directly
				const { data: supporters } = await supabase
					.from('profiles')
					.select('id, team_bonus_points')
					.eq('favorite_team', winnerTeamEn);

				for (const profile of supporters ?? []) {
					await supabase
						.from('profiles')
						.update({ team_bonus_points: parseFloat(((profile.team_bonus_points ?? 0) + bonusToAward).toFixed(2)) })
						.eq('id', profile.id);

					bonusAwarded++;
				}
			}
		}

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
