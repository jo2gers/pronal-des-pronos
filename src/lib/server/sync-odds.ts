/**
 * Polymarket odds sync — shared logic used by both admin actions and the
 * scheduled cron endpoint. Each function takes a Supabase service-role client
 * and returns a structured result so the caller can format messages or log.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

// ── Match odds (gamma series 11433 = 2026 FIFA WC) ─────────────────────────
export async function syncMatchOdds(supabase: SupabaseClient) {
	const res = await fetch(
		// closed=false: Polymarket returns oldest events first and caps a page at
		// ~100, so without this filter the open knockout markets never appear and
		// only finished group matches come back. Open = upcoming + in-play.
		'https://gamma-api.polymarket.com/events?series_id=11433&closed=false&limit=200',
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

// ── Polymarket event-slug backfill ──────────────────────────────────────────
// Walks the same WC2026 event list and writes event.slug onto every matching
// match row. Once set, the live-score cron can resolve the row to its
// Polymarket event by slug and pull score/period/ended in real time.
//
// Idempotent and safe to re-run — re-clicking the admin button after a
// knockout slot resolves (TBD → team name) will pick up the new pairings.
export async function backfillPolymarketSlugs(supabase: SupabaseClient) {
	const res = await fetch(
		// closed=false: Polymarket returns oldest events first and caps a page at
		// ~100, so without this filter the open knockout markets never appear and
		// only finished group matches come back. Open = upcoming + in-play.
		'https://gamma-api.polymarket.com/events?series_id=11433&closed=false&limit=200',
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

	const { data: dbMatches } = await supabase
		.from('matches')
		.select('id, home_team, away_team, polymarket_event_slug')
		.neq('home_team', 'TBD');
	if (!dbMatches) return { ok: false as const, error: 'Impossible de charger les matchs' };

	let updated = 0;
	let alreadySet = 0;
	const unmatched: string[] = [];

	for (const event of events) {
		const title = event.title as string | undefined;
		const slug = event.slug as string | undefined;
		if (!title || !slug) continue;

		const parts = title.split(' vs. ');
		if (parts.length !== 2) continue;
		const dbHomeName = norm(parts[0].trim());
		const dbAwayName = norm(parts[1].trim());

		const dbMatch = dbMatches.find(
			(m) => (m.home_team === dbHomeName && m.away_team === dbAwayName)
				|| (m.home_team === dbAwayName && m.away_team === dbHomeName)
		);
		if (!dbMatch) { unmatched.push(title); continue; }

		if ((dbMatch as any).polymarket_event_slug === slug) { alreadySet++; continue; }

		const { error } = await supabase.from('matches')
			.update({ polymarket_event_slug: slug })
			.eq('id', dbMatch.id);

		if (!error) updated++;
	}

	return { ok: true as const, updated, alreadySet, unmatched };
}

// ═══════════════════════════════════════════════════════════════════════════
// V2 — competition-aware odds + slug sync (PL / UCL / any competitions row
// with polymarket_series_id set). One pass does both jobs the WC needed two
// passes for: match each open Polymarket event to a fixture, write the event
// slug (feeds the live-score loop) AND the 3-way odds (frozen by the 5-min
// lock rule; the slug ignores the lock).
//
// Club-market differences vs the WC (calibrated on real events):
//   title: ' EPL: Arsenal vs. Wolverhampton' → strip the '<PREFIX>: ' part
//   home Q: 'Will Arsenal beat Wolverhampton?'   (WC said 'win')
//   draw Q: '…end in a draw?'
//   names are short forms → normalised/alias matching against
//   competition_teams (name_en + short_name), STRICT orientation (a league
//   pairing exists in both venues, so home-vs-home disambiguates the leg).
// ═══════════════════════════════════════════════════════════════════════════

const CLUB_ALIASES: Record<string, string> = {
	'man city': 'manchester city',
	'man utd': 'manchester united',
	'man united': 'manchester united',
	spurs: 'tottenham hotspur',
	wolves: 'wolverhampton wanderers',
	'nottm forest': 'nottingham forest'
};

function normClub(s: string): string {
	let n = s.toLowerCase().replace(/&/g, 'and').replace(/\./g, '').replace(/\s+/g, ' ').trim();
	n = n.replace(/^afc /, '').replace(/ afc$/, '').replace(/ fc$/, '');
	return CLUB_ALIASES[n] ?? n;
}

/** Does a Polymarket club name refer to this competition_teams row? */
function clubMatches(pmName: string, team: { name_en: string; short_name: string | null }): boolean {
	const pm = normClub(pmName);
	const full = normClub(team.name_en);
	const short = team.short_name ? normClub(team.short_name) : null;
	if (pm === full || pm === short) return true;
	// 'wolverhampton' → 'wolverhampton wanderers'; 'bournemouth' → 'afc bournemouth' (stripped)
	if (full.startsWith(pm + ' ') || full === pm) return true;
	return false;
}

export async function syncCompetitionOdds(supabase: SupabaseClient) {
	const { data: comps } = await supabase
		.from('competitions')
		.select('id, slug, polymarket_series_id')
		.eq('active', true)
		.not('polymarket_series_id', 'is', null);

	const LOCK_MS = 5 * 60 * 1000;
	const now = Date.now();
	const results: Record<string, unknown> = {};

	for (const comp of comps ?? []) {
		const res = await fetch(
			`https://gamma-api.polymarket.com/events?series_id=${comp.polymarket_series_id}&closed=false&limit=200`,
			{ headers: { Accept: 'application/json' } }
		);
		if (!res.ok) { results[comp.slug] = { ok: false, error: `Polymarket: ${res.status}` }; continue; }
		const raw = await res.json();
		const events: any[] = Array.isArray(raw) ? raw : (raw.events ?? []);

		const [{ data: dbMatches }, { data: teams }] = await Promise.all([
			supabase
				.from('matches')
				.select('id, home_team, away_team, match_datetime, status, polymarket_event_slug, odds_home')
				.eq('competition_id', comp.id)
				.in('status', ['upcoming', 'live']),
			supabase.from('competition_teams').select('name_en, short_name').eq('competition_id', comp.id)
		]);
		const teamRows = teams ?? [];
		const resolveTeam = (pmName: string) => teamRows.find((t) => clubMatches(pmName, t))?.name_en ?? null;

		let oddsUpdated = 0, slugsSet = 0, lockedSkipped = 0;
		const unmatched: string[] = [];

		for (const event of events) {
			const rawTitle = String(event.title ?? '').trim();
			const title = rawTitle.replace(/^[A-Z]{2,6}:\s*/, '');
			const parts = title.split(' vs. ');
			if (parts.length !== 2) continue; // champion markets, props, etc.
			const pmHome = parts[0].trim();
			const pmAway = parts[1].trim();
			// Sub-markets ('… - Halftime Result') fail team resolution below — fine.
			const homeName = resolveTeam(pmHome);
			const awayName = resolveTeam(pmAway);
			if (!homeName || !awayName) { unmatched.push(rawTitle); continue; }

			// STRICT orientation — the reverse fixture is a different match.
			const dbMatch = (dbMatches ?? []).find((m) => m.home_team === homeName && m.away_team === awayName);
			if (!dbMatch) { unmatched.push(rawTitle); continue; }

			// Slug first — the live loop needs it regardless of the odds lock.
			const slug = event.slug as string | undefined;
			if (slug && dbMatch.polymarket_event_slug !== slug) {
				const { error } = await supabase.from('matches').update({ polymarket_event_slug: slug }).eq('id', dbMatch.id);
				if (!error) slugsSet++;
			}

			// Odds — frozen 5 min before kickoff.
			if (new Date(dbMatch.match_datetime).getTime() - now < LOCK_MS) { lockedSkipped++; continue; }
			const markets = event.markets as any[];
			if (!Array.isArray(markets) || markets.length < 3) continue;
			const homeMkt = markets.find((m: any) => m.question?.startsWith(`Will ${pmHome} beat`) || m.question?.startsWith(`Will ${pmHome} win`));
			const awayMkt = markets.find((m: any) => m.question?.startsWith(`Will ${pmAway} beat`) || m.question?.startsWith(`Will ${pmAway} win`));
			const drawMkt = markets.find((m: any) => m.question?.toLowerCase().includes('draw'));
			if (!homeMkt || !awayMkt || !drawMkt) { unmatched.push(`${rawTitle} (marchés incomplets)`); continue; }

			const parsePrice = (market: any): number => {
				let prices = market.outcomePrices;
				if (typeof prices === 'string') { try { prices = JSON.parse(prices); } catch { return 0; } }
				return Array.isArray(prices) ? parseFloat(prices[0] ?? '0') || 0 : 0;
			};
			const toOdds = (p: number): number => (!p || p <= 0 ? 1.0 : Math.min(15, parseFloat((1 / p).toFixed(2))));

			const { error } = await supabase
				.from('matches')
				.update({
					odds_home: toOdds(parsePrice(homeMkt)),
					odds_draw: toOdds(parsePrice(drawMkt)),
					odds_away: toOdds(parsePrice(awayMkt))
				})
				.eq('id', dbMatch.id);
			if (!error) oddsUpdated++;
		}

		results[comp.slug] = { ok: true, events: events.length, oddsUpdated, slugsSet, lockedSkipped, unmatched: unmatched.slice(0, 20) };
	}

	return results;
}

// ── WC winner odds (team-level, for favorite-team bonus) ───────────────────
export async function syncWCWinnerOdds(supabase: SupabaseClient) {
	// Hard freeze 5 minutes before the tournament's first kickoff: these
	// multipliers drive every future team bonus, so once the WC starts they
	// must never move again — even via the admin sync button.
	const { data: firstMatch } = await supabase
		.from('matches')
		.select('match_datetime')
		.neq('home_team', 'TBD')
		.order('match_datetime', { ascending: true })
		.limit(1)
		.maybeSingle();
	const firstKickoff = firstMatch?.match_datetime
		? new Date(firstMatch.match_datetime).getTime()
		: null;
	if (firstKickoff && Date.now() >= firstKickoff - 5 * 60 * 1000) {
		return { ok: true as const, locked: true, updated: 0, unmatched: [] as string[] };
	}

	// Polymarket retired the old `2026-fifa-world-cup-winner-595` slug; the
	// market now lives at `world-cup-winner` (same question format).
	const res = await fetch(
		'https://gamma-api.polymarket.com/events?slug=world-cup-winner',
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
