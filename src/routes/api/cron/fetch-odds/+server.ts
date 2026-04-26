import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import type { RequestHandler } from './$types';

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

// Polymarket → DB English name
const NAME_MAP: Record<string, string> = {
	'Korea Republic': 'South Korea',
	Czechia: 'Czech Republic',
	'United States': 'USA',
	"Côte d'Ivoire": 'Ivory Coast',
	'Congo DR': 'DR Congo',
	'Democratic Republic of Congo': 'DR Congo',
	Türkiye: 'Turkey',
	'Cabo Verde': 'Cape Verde',
	'IR Iran': 'Iran',
	'Islamic Republic of Iran': 'Iran'
};
const norm = (n: string) => NAME_MAP[n] ?? n;

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

function parsePrice(market: any, index = 0): number {
	let p = market.outcomePrices;
	if (typeof p === 'string') {
		try { p = JSON.parse(p); } catch { return 0; }
	}
	return Array.isArray(p) ? parseFloat(p[index] ?? '0') || 0 : 0;
}

const toMatchOdds = (p: number) => (!p || p <= 0 ? 1.0 : Math.min(15, parseFloat((1 / p).toFixed(2))));

async function syncMatchOdds(supabase: any) {
	const res = await fetch('https://gamma-api.polymarket.com/events?series_id=11433&limit=200', {
		headers: { Accept: 'application/json' }
	});
	if (!res.ok) return { ok: false, error: `Polymarket: ${res.status}` };

	const raw = await res.json();
	const events: any[] = Array.isArray(raw) ? raw : (raw.events ?? []);
	if (!events.length) return { ok: false, error: 'No events from Polymarket' };

	const { data: dbMatches } = await supabase
		.from('matches')
		.select('id, home_team, away_team, match_datetime')
		.neq('home_team', 'TBD');
	if (!dbMatches) return { ok: false, error: 'Could not load matches' };

	// Lock cutoff: 5 minutes before kickoff — odds frozen permanently after this
	const LOCK_MS = 5 * 60 * 1000;
	const now = Date.now();

	let updated = 0;
	let lockedSkipped = 0;

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

		const dbMatch = (dbMatches as any[]).find(
			(m) =>
				(m.home_team === dbHomeName && m.away_team === dbAwayName) ||
				(m.home_team === dbAwayName && m.away_team === dbHomeName)
		);
		if (!dbMatch) continue;

		// Lock: don't refresh odds within 1h of kickoff
		const kickoff = new Date(dbMatch.match_datetime).getTime();
		if (kickoff - now < LOCK_MS) {
			lockedSkipped++;
			continue;
		}

		const isSwapped = dbMatch.home_team === dbAwayName;
		const pmHomeWin = markets.find((m) => m.question?.startsWith(`Will ${pmHome} win`));
		const pmAwayWin = markets.find((m) => m.question?.startsWith(`Will ${pmAway} win`));
		const drawMkt = markets.find((m) => m.question?.toLowerCase().includes('draw'));
		if (!pmHomeWin || !pmAwayWin || !drawMkt) continue;

		const pmHomeProb = parsePrice(pmHomeWin);
		const drawProb = parsePrice(drawMkt);
		const pmAwayProb = parsePrice(pmAwayWin);

		const odds_home = toMatchOdds(isSwapped ? pmAwayProb : pmHomeProb);
		const odds_draw = toMatchOdds(drawProb);
		const odds_away = toMatchOdds(isSwapped ? pmHomeProb : pmAwayProb);

		const { error } = await supabase
			.from('matches')
			.update({ odds_home, odds_draw, odds_away })
			.eq('id', dbMatch.id);
		if (!error) updated++;
	}

	return { ok: true, updated, lockedSkipped };
}

async function syncWcWinnerOdds(supabase: any) {
	// Lock: stop refreshing 2 days before the first WC match
	const { data: firstMatch } = await supabase
		.from('matches')
		.select('match_datetime')
		.eq('status', 'upcoming')
		.neq('home_team', 'TBD')
		.order('match_datetime', { ascending: true })
		.limit(1)
		.maybeSingle();

	const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
	const firstMatchTime = (firstMatch as any)?.match_datetime
		? new Date((firstMatch as any).match_datetime).getTime()
		: null;
	if (firstMatchTime && Date.now() >= firstMatchTime - TWO_DAYS_MS) {
		return { ok: true, locked: true, updated: 0 };
	}

	const res = await fetch('https://gamma-api.polymarket.com/events?slug=2026-fifa-world-cup-winner-595', {
		headers: { Accept: 'application/json' }
	});
	if (!res.ok) return { ok: false, error: `Polymarket: ${res.status}` };

	const raw = await res.json();
	const events: any[] = Array.isArray(raw) ? raw : [raw];
	const event = events[0];
	const markets: any[] = Array.isArray(event?.markets) ? event.markets : [];

	if (markets.length === 0 && event?.id) {
		const mRes = await fetch(`https://gamma-api.polymarket.com/markets?event_id=${event.id}&limit=100`, {
			headers: { Accept: 'application/json' }
		});
		if (mRes.ok) markets.push(...(await mRes.json()));
	}
	if (markets.length === 0) return { ok: false, error: 'No WC winner markets' };

	let updated = 0;
	for (const market of markets) {
		const q = market.question as string | undefined;
		const m = q?.match(/^Will (.+) win the 2026 FIFA World Cup\?$/);
		if (!m) continue;
		const dbName = norm(m[1]);
		const prob = parsePrice(market);
		if (prob <= 0) continue;
		const odds = parseFloat(Math.min(3001, 1 / prob).toFixed(2));
		const team_name_fr = FR_NAMES[dbName] ?? dbName;
		const { error } = await supabase
			.from('wc_winner_odds')
			.upsert({ team_name_en: dbName, team_name_fr, odds }, { onConflict: 'team_name_en' });
		if (!error) updated++;
	}
	return { ok: true, updated };
}

async function syncTopScorerOdds(supabase: any) {
	// Lock: stop refreshing 2 days before the first WC match
	const { data: firstMatch } = await supabase
		.from('matches')
		.select('match_datetime')
		.eq('status', 'upcoming')
		.neq('home_team', 'TBD')
		.order('match_datetime', { ascending: true })
		.limit(1)
		.maybeSingle();

	const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
	const firstMatchTime = (firstMatch as any)?.match_datetime
		? new Date((firstMatch as any).match_datetime).getTime()
		: null;
	if (firstMatchTime && Date.now() >= firstMatchTime - TWO_DAYS_MS) {
		return { ok: true, locked: true, updated: 0 };
	}

	const res = await fetch('https://gamma-api.polymarket.com/events?slug=2026-fifa-world-cup-top-goalscorer', {
		headers: { Accept: 'application/json' }
	});
	if (!res.ok) return { ok: false, error: `Polymarket: ${res.status}` };

	const raw = await res.json();
	const events: any[] = Array.isArray(raw) ? raw : [raw];
	const event = events[0];
	const markets: any[] = Array.isArray(event?.markets) ? event.markets : [];

	if (markets.length === 0 && event?.id) {
		const mRes = await fetch(`https://gamma-api.polymarket.com/markets?event_id=${event.id}&limit=200`, {
			headers: { Accept: 'application/json' }
		});
		if (mRes.ok) markets.push(...(await mRes.json()));
	}
	if (markets.length === 0) return { ok: false, error: 'No top-scorer markets' };

	let updated = 0;
	for (const market of markets) {
		const q = market.question as string | undefined;
		const m = q?.match(/^Will (.+?) be the top goalscorer at the 2026 FIFA World Cup\?$/i);
		if (!m) continue;
		const playerName = m[1].trim();
		const prob = parsePrice(market);
		if (prob <= 0) continue;
		const odds = parseFloat(Math.min(3001, 1 / prob).toFixed(2));
		const { error } = await supabase
			.from('wc_top_scorers')
			.upsert({ player_name: playerName, odds }, { onConflict: 'player_name' });
		if (!error) updated++;
	}
	return { ok: true, updated };
}

export const GET: RequestHandler = async ({ request }) => {
	// Vercel cron sends Authorization: Bearer ${CRON_SECRET}; allow either Vercel's
	// internal trigger (user-agent vercel-cron) or a matching CRON_SECRET if set.
	const cronSecret = process.env.CRON_SECRET;
	if (cronSecret) {
		const auth = request.headers.get('authorization') ?? '';
		const ua = request.headers.get('user-agent') ?? '';
		if (auth !== `Bearer ${cronSecret}` && !ua.includes('vercel-cron')) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}
	}

	if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
		return json({ error: 'Missing Supabase env' }, { status: 500 });
	}

	const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

	const [matchRes, wcRes, scorerRes] = await Promise.all([
		syncMatchOdds(supabase),
		syncWcWinnerOdds(supabase),
		syncTopScorerOdds(supabase)
	]);

	return json({
		ts: new Date().toISOString(),
		matchOdds: matchRes,
		wcWinnerOdds: wcRes,
		topScorerOdds: scorerRes
	});
};
