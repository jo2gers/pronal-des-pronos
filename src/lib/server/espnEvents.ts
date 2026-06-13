// Match timeline (goals + cards) AND post-match video highlights from ESPN's
// public, unauthenticated JSON API.
//
// - The scoreboard endpoint covers every World Cup match of a given day and
//   carries goals, own goals, penalties, yellow/red cards (with player names
//   and the clock) plus the ESPN gameId. Polymarket only has score/minute, so
//   this fills the timeline gap for free, no API key.
// - The per-match summary endpoint carries a `videos` array (highlight clips,
//   reactions, analysis) with headline, duration, thumbnail and a web link.
//   We only ever LINK OUT to ESPN for playback — never embed/hotline their
//   video CDN (geo/auth-restricted, and their copyrighted content).
//
// Non-fatal by design: any failure just means "no update this tick".

const BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world';
const SCOREBOARD_URL = `${BASE}/scoreboard`;
const SUMMARY_URL = `${BASE}/summary`;

export type MatchEvent = {
	minute: string;             // "9'", "45'+2'"
	type: 'goal' | 'og' | 'pen' | 'yellow' | 'red';
	side: 'home' | 'away';      // relative to OUR match row
	player: string | null;
};

export type EspnVideo = {
	headline: string;
	duration: number | null;    // seconds
	thumbnail: string | null;
	url: string;                // ESPN clip page (opens off-site)
};

export type EspnVideos = {
	items: EspnVideo[];
	pageUrl: string | null;     // ESPN "all videos for this match" page
};

// ESPN display name → our DB English name (only where they differ).
const ESPN_NAME_MAP: Record<string, string> = {
	Czechia: 'Czech Republic',
	'United States': 'USA',
	'Korea Republic': 'South Korea',
	"Côte d'Ivoire": 'Ivory Coast',
	'Democratic Republic of the Congo': 'DR Congo',
	'Congo DR': 'DR Congo',
	Türkiye: 'Turkey',
	'Cabo Verde': 'Cape Verde',
	'Cape Verde Islands': 'Cape Verde',
	'IR Iran': 'Iran',
	'Bosnia-Herzegovina': 'Bosnia and Herzegovina'
};
const norm = (n: string) => ESPN_NAME_MAP[n] ?? n;

// Key both orientations so a home/away swap on ESPN's side still matches.
const key = (a: string, b: string) => `${a.toLowerCase()}|${b.toLowerCase()}`;

/**
 * One scoreboard fetch → timeline events keyed by "homeTeam|awayTeam" (our EN
 * names, lowercased), plus the ESPN gameId per match key. `dateYYYYMMDD` lets
 * callers target a past day (the default scoreboard is today only).
 */
export async function fetchEspnEvents(
	dateYYYYMMDD?: string
): Promise<{ events: Map<string, MatchEvent[]>; gameIds: Map<string, string> }> {
	const events = new Map<string, MatchEvent[]>();
	const gameIds = new Map<string, string>();
	try {
		const qs = dateYYYYMMDD ? `?dates=${dateYYYYMMDD}&_=${Date.now()}` : `?_=${Date.now()}`;
		const res = await fetch(`${SCOREBOARD_URL}${qs}`, { headers: { Accept: 'application/json' } });
		if (!res.ok) return { events, gameIds };
		const data = await res.json();

		for (const event of data?.events ?? []) {
			const comp = event?.competitions?.[0];
			if (!comp) continue;

			const competitors: any[] = comp.competitors ?? [];
			const homeComp = competitors.find((c) => c.homeAway === 'home');
			const awayComp = competitors.find((c) => c.homeAway === 'away');
			if (!homeComp || !awayComp) continue;

			const espnHome = norm(homeComp.team?.displayName ?? '');
			const espnAway = norm(awayComp.team?.displayName ?? '');
			const homeId = String(homeComp.team?.id ?? homeComp.id ?? '');
			const gameId = String(event.id ?? comp.id ?? '');

			const list: MatchEvent[] = [];
			for (const det of comp.details ?? []) {
				const isGoal = det.scoringPlay === true;
				const isRed = det.redCard === true;
				const isYellow = det.yellowCard === true;
				if (!isGoal && !isRed && !isYellow) continue; // skip subs, VAR, etc.

				const type: MatchEvent['type'] = isGoal
					? det.ownGoal === true ? 'og' : det.penaltyKick === true ? 'pen' : 'goal'
					: isRed ? 'red' : 'yellow';

				// Own goals credit the conceding side's scoreboard: ESPN's team id
				// on the detail is the team that BENEFITS for goals; flip for og so
				// the player is shown under their actual team.
				let side: MatchEvent['side'] = String(det.team?.id ?? '') === homeId ? 'home' : 'away';
				if (type === 'og') side = side === 'home' ? 'away' : 'home';

				list.push({
					minute: det.clock?.displayValue ?? '',
					type,
					side,
					player: det.athletesInvolved?.[0]?.displayName ?? null
				});
			}

			// Store under both orientations; mark side-flip on the swapped key.
			events.set(key(espnHome, espnAway), list);
			events.set(
				key(espnAway, espnHome),
				list.map((e) => ({ ...e, side: e.side === 'home' ? 'away' : 'home' }))
			);
			if (gameId) {
				gameIds.set(key(espnHome, espnAway), gameId);
				gameIds.set(key(espnAway, espnHome), gameId);
			}
		}
	} catch {
		// non-fatal
	}
	return { events, gameIds };
}

/**
 * Resolve an ESPN gameId for one match by querying the scoreboard for its
 * kickoff date (and the neighbouring days, since ESPN groups by US date).
 */
export async function resolveEspnGameId(
	homeTeamEn: string,
	awayTeamEn: string,
	matchDatetimeIso: string
): Promise<string | null> {
	const d = new Date(matchDatetimeIso);
	// Try the UTC date and ±1 day to cover ESPN's timezone grouping.
	const candidates = [-1, 0, 1].map((off) => {
		const x = new Date(d.getTime() + off * 86400000);
		return `${x.getUTCFullYear()}${String(x.getUTCMonth() + 1).padStart(2, '0')}${String(x.getUTCDate()).padStart(2, '0')}`;
	});
	const want = key(homeTeamEn, awayTeamEn);
	for (const date of candidates) {
		const { gameIds } = await fetchEspnEvents(date);
		const hit = gameIds.get(want);
		if (hit) return hit;
	}
	return null;
}

/**
 * Per-match video highlights from the summary endpoint. Returns a slim,
 * link-out-only payload (we never serve ESPN's video stream ourselves).
 */
export async function fetchEspnVideos(gameId: string, max = 6): Promise<EspnVideos | null> {
	try {
		const res = await fetch(`${SUMMARY_URL}?event=${encodeURIComponent(gameId)}&_=${Date.now()}`, {
			headers: { Accept: 'application/json' }
		});
		if (!res.ok) return null;
		const data = await res.json();

		const items: EspnVideo[] = [];
		for (const v of data?.videos ?? []) {
			const url = v?.links?.web?.href as string | undefined;
			const headline = (v?.headline ?? '').trim();
			if (!url || !headline) continue;
			items.push({
				headline,
				duration: typeof v.duration === 'number' ? v.duration : null,
				thumbnail: v.thumbnail ?? null,
				url
			});
			if (items.length >= max) break;
		}

		const pageUrl =
			(data?.header?.links ?? []).find((l: any) => l?.text === 'Videos')?.href ??
			(data?.header?.links ?? []).find((l: any) => l?.text === 'Summary')?.href ??
			null;

		if (items.length === 0 && !pageUrl) return null;
		return { items, pageUrl };
	} catch {
		return null;
	}
}
