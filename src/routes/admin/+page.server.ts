import { createServerClient } from '@supabase/ssr';
import { fail, redirect } from '@sveltejs/kit';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import type { Actions, PageServerLoad } from './$types';

function adminClient() {
	return createServerClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
		cookies: { getAll: () => [], setAll: () => {} }
	});
}

export const load: PageServerLoad = async ({ locals: { safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) redirect(303, '/auth/login');

	const supabase = adminClient();

	const { data: matches } = await supabase
		.from('matches')
		.select('id, home_team, away_team, home_flag, away_flag, stage, group_label, match_datetime, status, home_score, away_score')
		.neq('home_team', 'TBD')
		.order('match_datetime', { ascending: true });

	return { matches: matches ?? [] };
};

export const actions: Actions = {
	update: async ({ request }) => {
		const supabase = adminClient();
		const form = await request.formData();

		const id = form.get('id') as string;
		const status = form.get('status') as string;
		const home_score = form.get('home_score') !== '' ? parseInt(form.get('home_score') as string) : null;
		const away_score = form.get('away_score') !== '' ? parseInt(form.get('away_score') as string) : null;

		const update: Record<string, unknown> = { status };
		if (status === 'live' || status === 'finished') {
			update.home_score = isNaN(home_score as number) ? null : home_score;
			update.away_score = isNaN(away_score as number) ? null : away_score;
		}
		if (status === 'upcoming') {
			update.home_score = null;
			update.away_score = null;
		}

		const { error } = await supabase.from('matches').update(update).eq('id', id);
		if (error) return fail(500, { error: error.message });

		return { success: true };
	},

	calculate: async ({ request }) => {
		const form = await request.formData();
		const matchId = form.get('match_id') as string;

		const supabaseUrl = PUBLIC_SUPABASE_URL;

		const res = await fetch(`${supabaseUrl}/functions/v1/calculate-scores`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
			},
			body: JSON.stringify({ match_id: matchId })
		});

		const data = await res.json();
		if (!res.ok) return fail(500, { error: data.error ?? 'Erreur calcul' });

		return { calculated: true, scored: data.scored };
	},

	syncWCWinnerOdds: async () => {
		const supabase = adminClient();

		const res = await fetch(
			'https://gamma-api.polymarket.com/events?slug=2026-fifa-world-cup-winner-595',
			{ headers: { Accept: 'application/json' } }
		);
		if (!res.ok) return fail(500, { error: `Polymarket: ${res.status}` });

		const raw = await res.json();

		// Gamma API returns an array; event may have markets embedded
		const events: any[] = Array.isArray(raw) ? raw : [raw];
		const event = events[0];
		const markets: any[] = Array.isArray(event?.markets) ? event.markets : [];

		// If markets not embedded, try fetching via event_id
		if (markets.length === 0 && event?.id) {
			const mRes = await fetch(
				`https://gamma-api.polymarket.com/markets?event_id=${event.id}&limit=100`,
				{ headers: { Accept: 'application/json' } }
			);
			if (mRes.ok) markets.push(...(await mRes.json()));
		}

		if (markets.length === 0) {
			return fail(500, { error: `Polymarket: aucun marché trouvé (${JSON.stringify(raw).slice(0, 200)})` });
		}

		// Polymarket name → DB English name
		const WC_NAME_MAP: Record<string, string> = {
			'Korea Republic': 'South Korea',
			'Czechia': 'Czech Republic',
			'United States': 'USA',
			"Côte d'Ivoire": 'Ivory Coast',
			'Congo DR': 'DR Congo',
			'Democratic Republic of Congo': 'DR Congo',
			'Türkiye': 'Turkey',
			'Cabo Verde': 'Cape Verde',
			'IR Iran': 'Iran',
			'Islamic Republic of Iran': 'Iran'
		};

		// DB English name → French name (for upsert when row doesn't exist yet)
		const FR_NAMES: Record<string, string> = {
			'Mexico': 'Mexique', 'South Africa': 'Afrique du Sud', 'South Korea': 'Corée du Sud',
			'Czech Republic': 'République tchèque', 'Canada': 'Canada',
			'Bosnia and Herzegovina': 'Bosnie-Herzégovine', 'Qatar': 'Qatar',
			'Switzerland': 'Suisse', 'USA': 'Etats-Unis', 'Paraguay': 'Paraguay',
			'Australia': 'Australie', 'Turkey': 'Turquie', 'Brazil': 'Brésil',
			'Morocco': 'Maroc', 'Haiti': 'Haïti', 'Scotland': 'Ecosse',
			'Germany': 'Allemagne', 'Curaçao': 'Curaçao', 'Ecuador': 'Equateur',
			'Ivory Coast': "Côte d'Ivoire", 'Netherlands': 'Pays-Bas', 'Japan': 'Japon',
			'Sweden': 'Suède', 'Tunisia': 'Tunisie', 'Spain': 'Espagne',
			'Cape Verde': 'Cap-Vert', 'Saudi Arabia': 'Arabie Saoudite', 'Uruguay': 'Uruguay',
			'Belgium': 'Belgique', 'Egypt': 'Egypte', 'Iran': 'Iran',
			'New Zealand': 'Nouvelle-Zélande', 'France': 'France', 'Senegal': 'Sénégal',
			'Iraq': 'Irak', 'Norway': 'Norvège', 'Argentina': 'Argentine',
			'Algeria': 'Algérie', 'Austria': 'Autriche', 'Jordan': 'Jordanie',
			'England': 'Angleterre', 'Croatia': 'Croatie', 'Ghana': 'Ghana',
			'Panama': 'Panama', 'Portugal': 'Portugal', 'Uzbekistan': 'Ouzbékistan',
			'Colombia': 'Colombie', 'DR Congo': 'Congo RD'
		};

		function wcNorm(name: string) { return WC_NAME_MAP[name] ?? name; }
		function wcPrice(market: any): number {
			let p = market.outcomePrices;
			if (typeof p === 'string') { try { p = JSON.parse(p); } catch { return 0; } }
			return Array.isArray(p) ? parseFloat(p[0] ?? '0') || 0 : 0;
		}

		let updated = 0;
		const unmatched: string[] = [];

		for (const market of markets) {
			const q = market.question as string | undefined;
			const m = q?.match(/^Will (.+) win the 2026 FIFA World Cup\?$/);
			if (!m) continue;

			const dbName = wcNorm(m[1]);
			const prob = wcPrice(market);
			if (prob <= 0) { unmatched.push(`${dbName} (prob=0)`); continue; }

			const odds = parseFloat(Math.min(3001, 1 / prob).toFixed(2));
			const team_name_fr = FR_NAMES[dbName] ?? dbName;

			// Upsert so it works even if the table is empty
			const { error } = await supabase
				.from('wc_winner_odds')
				.upsert(
					{ team_name_en: dbName, team_name_fr, odds },
					{ onConflict: 'team_name_en' }
				);

			if (!error) updated++;
			else unmatched.push(`${dbName} (${error.message})`);
		}

		return { wcOddsSync: true, updated, unmatched };
	},

	syncOdds: async () => {
		const supabase = adminClient();

		// Polymarket FIFA WC 2026 series ID
		const res = await fetch(
			'https://gamma-api.polymarket.com/events?series_id=11433&limit=200',
			{ headers: { Accept: 'application/json' } }
		);
		if (!res.ok) return fail(500, { error: `Polymarket API: ${res.status}` });

		const raw = await res.json();
		const events: any[] = Array.isArray(raw) ? raw : (raw.events ?? []);
		if (!events.length) return fail(500, { error: 'Aucun match reçu de Polymarket' });

		// Polymarket team name → DB name mapping
		const NAME_MAP: Record<string, string> = {
			'Korea Republic': 'South Korea',
			'Czechia': 'Czech Republic',
			'United States': 'USA',
			"Côte d'Ivoire": 'Ivory Coast',
			'Congo DR': 'DR Congo',
			'Democratic Republic of Congo': 'DR Congo',
			'Türkiye': 'Turkey',
			'Cabo Verde': 'Cape Verde',
			'IR Iran': 'Iran',
			'Islamic Republic of Iran': 'Iran'
		};
		function norm(name: string): string {
			return NAME_MAP[name] ?? name;
		}
		// Parse outcomePrices — Polymarket API sometimes returns a JSON string instead of an array
		function parsePrice(market: any, index: number): number {
			let prices = market.outcomePrices;
			if (typeof prices === 'string') {
				try { prices = JSON.parse(prices); } catch { return 0; }
			}
			if (!Array.isArray(prices)) return 0;
			return parseFloat(prices[index] ?? '0') || 0;
		}
		// Convert probability (0-1) to decimal odds, 2 decimal places, capped at 15
		function toOdds(p: number): number {
			if (!p || p <= 0) return 1.0;
			return Math.min(15, parseFloat((1 / p).toFixed(2)));
		}

		// Fetch all non-TBD matches from DB
		const { data: dbMatches } = await supabase
			.from('matches')
			.select('id, home_team, away_team')
			.neq('home_team', 'TBD');
		if (!dbMatches) return fail(500, { error: 'Impossible de charger les matchs' });

		let updated = 0;
		const unmatched: string[] = [];

		for (const event of events) {
			const title = event.title as string;
			const markets = event.markets as any[];
			if (!title || !Array.isArray(markets) || markets.length < 3) continue;

			// Parse "Mexico vs. South Africa" → pmHome + pmAway
			const parts = title.split(' vs. ');
			if (parts.length !== 2) continue;
			const pmHome = parts[0].trim();
			const pmAway = parts[1].trim();
			const dbHomeName = norm(pmHome);
			const dbAwayName = norm(pmAway);

			// Find DB match (try both orderings)
			const dbMatch = dbMatches.find(
				(m) =>
					(m.home_team === dbHomeName && m.away_team === dbAwayName) ||
					(m.home_team === dbAwayName && m.away_team === dbHomeName)
			);
			if (!dbMatch) {
				unmatched.push(title);
				continue;
			}

			const isSwapped = dbMatch.home_team === dbAwayName;

			// Identify the three markets
			const pmHomeWin = markets.find((m) => m.question?.startsWith(`Will ${pmHome} win`));
			const pmAwayWin = markets.find((m) => m.question?.startsWith(`Will ${pmAway} win`));
			const drawMkt   = markets.find((m) => m.question?.toLowerCase().includes('draw'));

			if (!pmHomeWin || !pmAwayWin || !drawMkt) {
				unmatched.push(`${title} (marchés manquants)`);
				continue;
			}

			const pmHomeProb = parsePrice(pmHomeWin, 0);
			const drawProb   = parsePrice(drawMkt, 0);
			const pmAwayProb = parsePrice(pmAwayWin, 0);

			// Assign probabilities respecting DB home/away order
			const odds_home = toOdds(isSwapped ? pmAwayProb : pmHomeProb);
			const odds_draw = toOdds(drawProb);
			const odds_away = toOdds(isSwapped ? pmHomeProb : pmAwayProb);

			const { error } = await supabase
				.from('matches')
				.update({ odds_home, odds_draw, odds_away })
				.eq('id', dbMatch.id);

			if (!error) updated++;
		}

		return { oddsSync: true, updated, unmatched };
	},

	resetAll: async () => {
		const supabase = adminClient();

		// 1. Delete all pronostics
		const { error: e1 } = await supabase.from('pronostics').delete().not('id', 'is', null);
		if (e1) return fail(500, { error: `Pronostics: ${e1.message}` });

		// 2. Reset all match results
		const { error: e2 } = await supabase.from('matches').update({
			status: 'upcoming',
			home_score: null,
			away_score: null,
			bonus_calculated: false
		}).not('id', 'is', null);
		if (e2) return fail(500, { error: `Matchs: ${e2.message}` });

		// 3. Reset all team bonus points
		const { error: e3 } = await supabase.from('profiles').update({ team_bonus_points: 0 }).not('id', 'is', null);
		if (e3) return fail(500, { error: `Profils: ${e3.message}` });

		return { reset: true };
	}
};
