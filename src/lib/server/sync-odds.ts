/**
 * Polymarket odds sync — shared logic used by both admin actions and the
 * scheduled cron endpoint. Each function takes a Supabase service-role client
 * and returns a structured result so the caller can format messages or log.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

// ── Match odds (gamma series 11433 = 2026 FIFA WC) ─────────────────────────
export async function syncMatchOdds(supabase: SupabaseClient) {
	const res = await fetch(
		'https://gamma-api.polymarket.com/events?series_id=11433&limit=200',
		{ headers: { Accept: 'application/json' } }
	);
	if (!res.ok) return { ok: false as const, error: `Polymarket API: ${res.status}` };

	const raw = await res.json();
	const events: any[] = Array.isArray(raw) ? raw : (raw.events ?? []);
	if (!events.length) return { ok: false as const, error: 'Aucun match reçu de Polymarket' };

	const NAME_MAP: Record<string, string> = {
		'Korea Republic': 'South Korea', Czechia: 'Czech Republic', 'United States': 'USA',
		"Côte d'Ivoire": 'Ivory Coast', 'Congo DR': 'DR Congo', 'Democratic Republic of Congo': 'DR Congo',
		'Türkiye': 'Turkey', 'Cabo Verde': 'Cape Verde', 'IR Iran': 'Iran', 'Islamic Republic of Iran': 'Iran'
	};
	const norm = (n: string) => NAME_MAP[n] ?? n;

	const parsePrice = (market: any, index: number): number => {
		let prices = market.outcomePrices;
		if (typeof prices === 'string') { try { prices = JSON.parse(prices); } catch { return 0; } }
		if (!Array.isArray(prices)) return 0;
		return parseFloat(prices[index] ?? '0') || 0;
	};
	const toOdds = (p: number): number => (!p || p <= 0 ? 1.0 : Math.min(15, parseFloat((1 / p).toFixed(2))));

	const { data: dbMatches } = await supabase
		.from('matches')
		.select('id, home_team, away_team')
		.neq('home_team', 'TBD');
	if (!dbMatches) return { ok: false as const, error: 'Impossible de charger les matchs' };

	let updated = 0;
	const unmatched: string[] = [];

	for (const event of events) {
		const title = event.title as string;
		const markets = event.markets as any[];
		if (!title || !Array.isArray(markets) || markets.length < 3) continue;

		const parts = title.split(' vs. ');
		if (parts.length !== 2) continue;
		const pmHome = parts[0].trim();
		const pmAway = parts[1].trim();
		const dbHomeName = norm(pmHome);
		const dbAwayName = norm(pmAway);

		const dbMatch = dbMatches.find(
			(m) => (m.home_team === dbHomeName && m.away_team === dbAwayName)
				|| (m.home_team === dbAwayName && m.away_team === dbHomeName)
		);
		if (!dbMatch) { unmatched.push(title); continue; }

		const isSwapped = dbMatch.home_team === dbAwayName;
		const pmHomeWin = markets.find((m: any) => m.question?.startsWith(`Will ${pmHome} win`));
		const pmAwayWin = markets.find((m: any) => m.question?.startsWith(`Will ${pmAway} win`));
		const drawMkt   = markets.find((m: any) => m.question?.toLowerCase().includes('draw'));

		if (!pmHomeWin || !pmAwayWin || !drawMkt) { unmatched.push(`${title} (marchés manquants)`); continue; }

		const pmHomeProb = parsePrice(pmHomeWin, 0);
		const drawProb   = parsePrice(drawMkt, 0);
		const pmAwayProb = parsePrice(pmAwayWin, 0);

		const odds_home = toOdds(isSwapped ? pmAwayProb : pmHomeProb);
		const odds_draw = toOdds(drawProb);
		const odds_away = toOdds(isSwapped ? pmHomeProb : pmAwayProb);

		const { error } = await supabase.from('matches')
			.update({ odds_home, odds_draw, odds_away })
			.eq('id', dbMatch.id);

		if (!error) updated++;
	}

	return { ok: true as const, updated, unmatched };
}

// ── WC winner odds (team-level, for favorite-team bonus) ───────────────────
export async function syncWCWinnerOdds(supabase: SupabaseClient) {
	const res = await fetch(
		'https://gamma-api.polymarket.com/events?slug=2026-fifa-world-cup-winner-595',
		{ headers: { Accept: 'application/json' } }
	);
	if (!res.ok) return { ok: false as const, error: `Polymarket: ${res.status}` };

	const raw = await res.json();
	const events: any[] = Array.isArray(raw) ? raw : [raw];
	const event = events[0];
	const markets: any[] = Array.isArray(event?.markets) ? event.markets : [];

	if (markets.length === 0 && event?.id) {
		const mRes = await fetch(
			`https://gamma-api.polymarket.com/markets?event_id=${event.id}&limit=100`,
			{ headers: { Accept: 'application/json' } }
		);
		if (mRes.ok) markets.push(...(await mRes.json()));
	}

	if (markets.length === 0) return { ok: false as const, error: 'Polymarket: aucun marché trouvé' };

	const WC_NAME_MAP: Record<string, string> = {
		'Korea Republic': 'South Korea', Czechia: 'Czech Republic', 'United States': 'USA',
		"Côte d'Ivoire": 'Ivory Coast', 'Congo DR': 'DR Congo', 'Democratic Republic of Congo': 'DR Congo',
		'Türkiye': 'Turkey', 'Cabo Verde': 'Cape Verde', 'IR Iran': 'Iran', 'Islamic Republic of Iran': 'Iran'
	};
	const FR_NAMES: Record<string, string> = {
		Mexico: 'Mexique', 'South Africa': 'Afrique du Sud', 'South Korea': 'Corée du Sud',
		'Czech Republic': 'République tchèque', Canada: 'Canada',
		'Bosnia and Herzegovina': 'Bosnie-Herzégovine', Qatar: 'Qatar',
		Switzerland: 'Suisse', USA: 'Etats-Unis', Paraguay: 'Paraguay',
		Australia: 'Australie', Turkey: 'Turquie', Brazil: 'Brésil',
		Morocco: 'Maroc', Haiti: 'Haïti', Scotland: 'Ecosse',
		Germany: 'Allemagne', 'Curaçao': 'Curaçao', Ecuador: 'Equateur',
		'Ivory Coast': "Côte d'Ivoire", Netherlands: 'Pays-Bas', Japan: 'Japon',
		Sweden: 'Suède', Tunisia: 'Tunisie', Spain: 'Espagne',
		'Cape Verde': 'Cap-Vert', 'Saudi Arabia': 'Arabie Saoudite', Uruguay: 'Uruguay',
		Belgium: 'Belgique', Egypt: 'Egypte', Iran: 'Iran',
		'New Zealand': 'Nouvelle-Zélande', France: 'France', Senegal: 'Sénégal',
		Iraq: 'Irak', Norway: 'Norvège', Argentina: 'Argentine',
		Algeria: 'Algérie', Austria: 'Autriche', Jordan: 'Jordanie',
		England: 'Angleterre', Croatia: 'Croatie', Ghana: 'Ghana',
		Panama: 'Panama', Portugal: 'Portugal', Uzbekistan: 'Ouzbékistan',
		Colombia: 'Colombie', 'DR Congo': 'Congo RD'
	};

	const wcNorm = (n: string) => WC_NAME_MAP[n] ?? n;
	const wcPrice = (market: any): number => {
		let p = market.outcomePrices;
		if (typeof p === 'string') { try { p = JSON.parse(p); } catch { return 0; } }
		return Array.isArray(p) ? parseFloat(p[0] ?? '0') || 0 : 0;
	};

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

		const { error } = await supabase.from('wc_winner_odds')
			.upsert({ team_name_en: dbName, team_name_fr, odds }, { onConflict: 'team_name_en' });

		if (!error) updated++; else unmatched.push(`${dbName} (${error.message})`);
	}

	return { ok: true as const, updated, unmatched };
}

// ── Top scorer odds ────────────────────────────────────────────────────────
export async function syncTopScorerOdds(supabase: SupabaseClient) {
	const res = await fetch(
		'https://gamma-api.polymarket.com/events?slug=2026-fifa-world-cup-top-goalscorer',
		{ headers: { Accept: 'application/json' } }
	);
	if (!res.ok) return { ok: false as const, error: `Polymarket: ${res.status}` };

	const raw = await res.json();
	const events: any[] = Array.isArray(raw) ? raw : [raw];
	const event = events[0];
	const markets: any[] = Array.isArray(event?.markets) ? event.markets : [];

	if (markets.length === 0 && event?.id) {
		const mRes = await fetch(
			`https://gamma-api.polymarket.com/markets?event_id=${event.id}&limit=200`,
			{ headers: { Accept: 'application/json' } }
		);
		if (mRes.ok) markets.push(...(await mRes.json()));
	}
	if (markets.length === 0) return { ok: false as const, error: 'Polymarket: aucun marché trouvé' };

	const priceOf = (market: any): number => {
		let p = market.outcomePrices;
		if (typeof p === 'string') { try { p = JSON.parse(p); } catch { return 0; } }
		return Array.isArray(p) ? parseFloat(p[0] ?? '0') || 0 : 0;
	};

	let updated = 0;
	const skipped: string[] = [];

	for (const market of markets) {
		const q = market.question as string | undefined;
		const m = q?.match(/^Will (.+?) be the top goalscorer at the 2026 FIFA World Cup\?$/i);
		if (!m) continue;

		const playerName = m[1].trim();
		const prob = priceOf(market);
		if (prob <= 0) { skipped.push(`${playerName} (prob=0)`); continue; }

		const odds = parseFloat(Math.min(3001, 1 / prob).toFixed(2));
		const { error } = await supabase.from('wc_top_scorers')
			.upsert({ player_name: playerName, odds }, { onConflict: 'player_name' });

		if (!error) updated++; else skipped.push(`${playerName} (${error.message})`);
	}

	return { ok: true as const, updated, skipped };
}
