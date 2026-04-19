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

Deno.serve(async (req) => {
	const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

	const body = await req.json().catch(() => ({}));
	const matchId = body.match_id as string | undefined;

	if (!matchId) {
		return new Response(JSON.stringify({ error: 'match_id required' }), { status: 400 });
	}

	const { data: match } = await supabase
		.from('matches')
		.select('id, home_score, away_score, status')
		.eq('id', matchId)
		.single();

	if (!match || match.status !== 'finished' || match.home_score == null || match.away_score == null) {
		return new Response(JSON.stringify({ error: 'Match not finished or scores not set' }), { status: 400 });
	}

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

	// Mark match as finished if not already
	await supabase.from('matches').update({ status: 'finished' }).eq('id', matchId);

	return new Response(JSON.stringify({ success: true, scored }), {
		headers: { 'Content-Type': 'application/json' }
	});
});
