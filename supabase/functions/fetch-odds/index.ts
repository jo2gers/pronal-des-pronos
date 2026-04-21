import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const API_FOOTBALL_KEY          = Deno.env.get('API_FOOTBALL_KEY') ?? '';
const SUPABASE_URL              = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// Bet ID 1 = "Match Winner" (Home / Draw / Away) on api-football.com
const MATCH_WINNER_BET_ID = 1;

Deno.serve(async (_req) => {
	const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

	try {
		// Fetch all upcoming matches that have an external_id from api-football
		const { data: matches } = await supabase
			.from('matches')
			.select('id, home_team, away_team, external_id')
			.eq('status', 'upcoming')
			.not('external_id', 'is', null);

		let updated = 0;

		for (const match of matches ?? []) {
			const resp = await fetch(
				`https://v3.football.api-sports.io/odds?fixture=${match.external_id}&bet=${MATCH_WINNER_BET_ID}`,
				{ headers: { 'x-apisports-key': API_FOOTBALL_KEY, Accept: 'application/json' } }
			);

			if (!resp.ok) continue;

			const data = await resp.json();
			const oddsEntry = data.response?.[0];
			if (!oddsEntry) continue;

			// Walk bookmakers until we find one with Match Winner data
			const bets = oddsEntry.bookmakers?.[0]?.bets ?? [];
			const matchWinner = bets.find(
				(b: any) => b.id === MATCH_WINNER_BET_ID || b.name === 'Match Winner'
			);
			if (!matchWinner) continue;

			const values: Array<{ value: string; odd: string }> = matchWinner.values ?? [];
			const homeOdds = values.find((v) => v.value === 'Home')?.odd;
			const drawOdds = values.find((v) => v.value === 'Draw')?.odd;
			const awayOdds = values.find((v) => v.value === 'Away')?.odd;

			if (!homeOdds && !awayOdds) continue;

			await supabase.from('odds_cache').upsert(
				{
					match_id:   match.id,
					home_win:   homeOdds ? parseFloat(homeOdds) : null,
					draw:       drawOdds ? parseFloat(drawOdds) : null,
					away_win:   awayOdds ? parseFloat(awayOdds) : null,
					fetched_at: new Date().toISOString(),
				},
				{ onConflict: 'match_id' }
			);
			updated++;
		}

		return new Response(JSON.stringify({ success: true, updated }), {
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (err) {
		return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
	}
});
