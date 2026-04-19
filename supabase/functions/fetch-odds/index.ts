import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ODDS_API_KEY = Deno.env.get('ODDS_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

Deno.serve(async (_req) => {
	const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

	try {
		// Fetch odds from the-odds-api
		const resp = await fetch(
			`https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup/odds?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h&oddsFormat=decimal`,
			{ headers: { 'Content-Type': 'application/json' } }
		);

		if (!resp.ok) {
			const text = await resp.text();
			return new Response(JSON.stringify({ error: `Odds API error: ${text}` }), { status: 500 });
		}

		const oddsData = await resp.json();

		// Fetch all upcoming matches from DB
		const { data: matches } = await supabase
			.from('matches')
			.select('id, home_team, away_team, match_datetime')
			.eq('status', 'upcoming');

		let updated = 0;

		for (const match of matches ?? []) {
			// Try to find this match in the API response by team name matching
			const apiMatch = oddsData.find((o: any) => {
				const home = o.home_team?.toLowerCase();
				const away = o.away_team?.toLowerCase();
				return (
					home?.includes(match.home_team.toLowerCase().slice(0, 4)) ||
					away?.includes(match.away_team.toLowerCase().slice(0, 4))
				);
			});

			if (!apiMatch) continue;

			// Find h2h market
			const bookmaker = apiMatch.bookmakers?.[0];
			const market = bookmaker?.markets?.find((m: any) => m.key === 'h2h');
			if (!market) continue;

			const outcomes = market.outcomes ?? [];
			const homeOdds = outcomes.find((o: any) =>
				o.name?.toLowerCase().includes(match.home_team.toLowerCase().slice(0, 4))
			)?.price;
			const awayOdds = outcomes.find((o: any) =>
				o.name?.toLowerCase().includes(match.away_team.toLowerCase().slice(0, 4))
			)?.price;
			const drawOdds = outcomes.find((o: any) => o.name?.toLowerCase() === 'draw')?.price;

			if (!homeOdds && !awayOdds) continue;

			await supabase.from('odds_cache').upsert(
				{
					match_id: match.id,
					home_win: homeOdds ?? null,
					draw: drawOdds ?? null,
					away_win: awayOdds ?? null,
					fetched_at: new Date().toISOString()
				},
				{ onConflict: 'match_id' }
			);
			updated++;
		}

		return new Response(JSON.stringify({ success: true, updated }), {
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (err) {
		return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
	}
});
