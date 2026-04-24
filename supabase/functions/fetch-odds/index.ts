import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL              = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

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
// TODO: Replace with Polymarket API integration
	for (const match of matches ?? []) {
		if (!match.external_id) continue;1 / (percentage / 100)
			const convertToOdd = (percentage: string | undefined): number | null => {
				if (!percentage) return null;
				const num = parseFloat(percentage);
				if (num <= 0 || num > 100) return null;
				return 1 / (num / 100);
			};

			const homeOdd = convertToOdd(homeOdds);
			const drawOdd = convertToOdd(drawOdds);
			const awayOdd = convertToOdd(awayOdds);

			// Save to cache
			await supabase.from('odds_cache').upsert(
				{
					match_id:   match.id,
					home_win:   homeOdd,
					draw:       drawOdd,
					away_win:   awayOdd,
					fetched_at: new Date().toISOString(),
				},
				{ onConflict: 'match_id' }
			);

			// Also update matches table directly for immediate availability
			await supabase
				.from('matches')
				.update({
					odds_home: homeOdd,
					odds_draw: drawOdd,
					odds_away: awayOdd,
				})
				.eq('id', match.id);

			updated++;
		}

		return new Response(JSON.stringify({ success: true, updated }), {
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (err) {
		return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
	}
});
