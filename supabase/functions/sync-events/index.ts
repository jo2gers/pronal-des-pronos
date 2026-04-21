import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const API_FOOTBALL_KEY          = Deno.env.get('API_FOOTBALL_KEY') ?? '';
const SUPABASE_URL              = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const WC_LEAGUE_ID = '1';   // FIFA World Cup on api-football.com
const WC_SEASON    = '2026';

// Map Odds API team names → our DB names for known mismatches
const TEAM_NAME_MAP: Record<string, string> = {
	'united states':        'USA',
	'usa':                  'USA',
	'us':                   'USA',
	'korea republic':       'South Korea',
	'republic of korea':    'South Korea',
	'korea dpr':            'North Korea',
	'iran':                 'Iran',
	'ir iran':              'Iran',
	'türkiye':              'Turkey',
	'turkey':               'Turkey',
	'czechia':              'Czech Republic',
	'czech republic':       'Czech Republic',
	'ivory coast':          "Côte d'Ivoire",
	"côte d'ivoire":        "Côte d'Ivoire",
	'cape verde':           'Cape Verde Islands',
	'cape verde islands':   'Cape Verde Islands',
	'trinidad & tobago':    'Trinidad and Tobago',
	'trinidad and tobago':  'Trinidad and Tobago',
	'new zealand':          'New Zealand',
};

function normalize(name: string): string {
	const lower = name.toLowerCase().trim();
	return TEAM_NAME_MAP[lower] ?? name;
}

/** Check if two team names refer to the same team */
function teamsMatch(apiName: string, dbName: string): boolean {
	const a = normalize(apiName).toLowerCase();
	const b = dbName.toLowerCase();
	if (a === b) return true;
	// Prefix match (first 5 chars) to handle "Argentina" vs "Argentina U23" etc.
	if (a.length >= 5 && b.length >= 5 && (a.startsWith(b.slice(0, 5)) || b.startsWith(a.slice(0, 5)))) return true;
	// Substring match
	if (a.includes(b.slice(0, 6)) || b.includes(a.slice(0, 6))) return true;
	return false;
}

Deno.serve(async (_req) => {
	const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

	try {
		// Fetch all WC2026 fixtures from api-football.com
		const params = new URLSearchParams({
			league: WC_LEAGUE_ID,
			season: WC_SEASON,
			from:   '2026-06-01',
			to:     '2026-07-20',
		});

		const resp = await fetch(
			`https://v3.football.api-sports.io/fixtures?${params}`,
			{ headers: { 'x-apisports-key': API_FOOTBALL_KEY, Accept: 'application/json' } }
		);

		if (!resp.ok) {
			const text = await resp.text();
			return new Response(
				JSON.stringify({ error: `API-Football error ${resp.status}: ${text}` }),
				{ status: 502, headers: { 'Content-Type': 'application/json' } }
			);
		}

		const data = await resp.json();

		if (data.errors && Object.keys(data.errors).length > 0) {
			return new Response(
				JSON.stringify({ error: data.errors }),
				{ status: 502, headers: { 'Content-Type': 'application/json' } }
			);
		}

		const fixtures: Array<{
			fixture: { id: number; date: string; status: { short: string } };
			teams:   { home: { name: string }; away: { name: string } };
		}> = data.response ?? [];

		// Fetch our existing matches
		const { data: dbMatches, error: dbErr } = await supabase
			.from('matches')
			.select('id, home_team, away_team, external_id, match_datetime');

		if (dbErr) throw new Error(dbErr.message);

		const results = { matched: 0, updated: 0, unmatched: [] as string[] };

		for (const fixture of fixtures) {
			const apiHomeTeam = fixture.teams.home.name;
			const apiAwayTeam = fixture.teams.away.name;
			const fixtureId   = String(fixture.fixture.id);
			const fixtureDate = fixture.fixture.date;

			// First try exact external_id match (after first run)
			let dbMatch = (dbMatches ?? []).find((m) => m.external_id === fixtureId);

			// Otherwise fuzzy-match on team names
			if (!dbMatch) {
				dbMatch = (dbMatches ?? []).find(
					(m) =>
						teamsMatch(apiHomeTeam, m.home_team) &&
						teamsMatch(apiAwayTeam, m.away_team)
				);
				// Also try swapped home/away (API sometimes flips them for neutral venues)
				if (!dbMatch) {
					dbMatch = (dbMatches ?? []).find(
						(m) =>
							teamsMatch(apiHomeTeam, m.away_team) &&
							teamsMatch(apiAwayTeam, m.home_team)
					);
				}
			}

			if (!dbMatch) {
				results.unmatched.push(`${apiHomeTeam} vs ${apiAwayTeam}`);
				continue;
			}

			results.matched++;

			// Update: external_id + correct kickoff time
			const updates: Record<string, string> = {
				external_id:    fixtureId,
				match_datetime: fixtureDate,
			};

			const { error: updateErr } = await supabase
				.from('matches')
				.update(updates)
				.eq('id', dbMatch.id);

			if (!updateErr) results.updated++;
		}

		const remaining = resp.headers.get('x-ratelimit-requests-remaining');

		return new Response(
			JSON.stringify({ success: true, ...results, api_quota_remaining: remaining }),
			{ headers: { 'Content-Type': 'application/json' } }
		);
	} catch (err) {
		return new Response(
			JSON.stringify({ error: String(err) }),
			{ status: 500, headers: { 'Content-Type': 'application/json' } }
		);
	}
});
