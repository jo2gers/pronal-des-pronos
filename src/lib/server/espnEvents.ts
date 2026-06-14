// Match timeline (goals + cards) from ESPN's public scoreboard API.
//
// ESPN exposes an unauthenticated JSON endpoint covering every World Cup
// match of the day — one request returns goals, own goals, penalties and
// yellow/red cards with player names and the match clock. Polymarket only
// carries score/minute, so this fills the gap for free, without an API key.
//
// Non-fatal by design: any failure here just means "no timeline this tick".

const BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world';
const SCOREBOARD_URL = `${BASE}/scoreboard`;
const SUMMARY_URL = `${BASE}/summary`;

export type MatchEvent = {
	minute: string;             // "9'", "45'+2'"
	type: 'goal' | 'og' | 'pen' | 'yellow' | 'red';
	side: 'home' | 'away';      // relative to OUR match row
	player: string | null;
};

export type LineupPlayer = {
	num: number | null;
	name: string;
	group: 'G' | 'D' | 'M' | 'F';
	subbedOut?: boolean;
};
export type TeamLineup = {
	formation: string | null;
	starters: LineupPlayer[];
	subs: { num: number | null; name: string }[];   // came on
	bench: { num: number | null; name: string }[];   // unused
};
export type SubEvent = {
	minute: string;             // "45'", "67'"
	side: 'home' | 'away';      // relative to ESPN home/away (caller aligns)
	playerIn: string | null;
	playerOut: string | null;
};
export type MatchLineups = {
	home: TeamLineup;
	away: TeamLineup;
	subs: SubEvent[];           // substitution timeline (from summary keyEvents)
	homeTeam: string;  // ESPN's home team, normalized to our EN name
	awayTeam: string;
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
 * One scoreboard fetch → map keyed by "homeTeam|awayTeam" (our EN names,
 * lowercased) → ordered list of goal/card events.
 */
export async function fetchEspnEvents(dateYYYYMMDD?: string): Promise<{
	events: Map<string, MatchEvent[]>;
	gameIds: Map<string, string>;
}> {
	const out = new Map<string, MatchEvent[]>();
	const gameIds = new Map<string, string>();
	try {
		const qs = dateYYYYMMDD ? `?dates=${dateYYYYMMDD}&_=${Date.now()}` : `?_=${Date.now()}`;
		const res = await fetch(`${SCOREBOARD_URL}${qs}`, {
			headers: { Accept: 'application/json' }
		});
		if (!res.ok) return { events: out, gameIds };
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

			const events: MatchEvent[] = [];
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

				events.push({
					minute: det.clock?.displayValue ?? '',
					type,
					side,
					player: det.athletesInvolved?.[0]?.displayName ?? null
				});
			}

			// Store under both orientations; mark side-flip on the swapped key.
			out.set(key(espnHome, espnAway), events);
			out.set(
				key(espnAway, espnHome),
				events.map((e) => ({ ...e, side: e.side === 'home' ? 'away' : 'home' }))
			);
			if (gameId) {
				gameIds.set(key(espnHome, espnAway), gameId);
				gameIds.set(key(espnAway, espnHome), gameId);
			}
		}
	} catch {
		// non-fatal — timeline simply doesn't update this tick
	}
	return { events: out, gameIds };
}

/** Resolve an ESPN gameId for one match via the dated scoreboard (±1 day for
 *  ESPN's US-date grouping), matching by team names. For finished-match backfill. */
export async function resolveEspnGameId(
	homeTeamEn: string,
	awayTeamEn: string,
	matchDatetimeIso: string
): Promise<string | null> {
	const d = new Date(matchDatetimeIso);
	const dates = [-1, 0, 1].map((off) => {
		const x = new Date(d.getTime() + off * 86400000);
		return `${x.getUTCFullYear()}${String(x.getUTCMonth() + 1).padStart(2, '0')}${String(x.getUTCDate()).padStart(2, '0')}`;
	});
	const want = key(homeTeamEn, awayTeamEn);
	for (const date of dates) {
		const { gameIds } = await fetchEspnEvents(date);
		const hit = gameIds.get(want);
		if (hit) return hit;
	}
	return null;
}

// ESPN position abbreviation → coarse pitch line. Robust across formations:
// G=keeper; anything with B/CD or starting D = defender; with M = midfielder;
// F/ST/CF/W(ing) = forward.
function positionGroup(pos: string): 'G' | 'D' | 'M' | 'F' {
	const p = (pos || '').toUpperCase();
	if (p === 'G' || p === 'GK') return 'G';
	if (/^F|ST|CF|^W|RW|LW/.test(p)) return 'F';
	if (p.includes('M')) return 'M';
	if (p.includes('B') || p.includes('CD') || p.startsWith('D') || p.includes('SW')) return 'D';
	return 'M';
}

function buildTeamLineup(r: any): TeamLineup {
	const roster: any[] = r?.roster ?? [];
	const starters = roster
		.filter((p) => p.starter)
		.sort((a, b) => (a.formationPlace ?? 99) - (b.formationPlace ?? 99))
		.map((p) => ({
			num: p.jersey != null ? Number(p.jersey) : null,
			name: p.athlete?.displayName ?? '',
			group: positionGroup((p.position || {}).abbreviation || ''),
			subbedOut: p.subbedOut === true
		}));
	const subs = roster
		.filter((p) => !p.starter && p.subbedIn)
		.map((p) => ({ num: p.jersey != null ? Number(p.jersey) : null, name: p.athlete?.displayName ?? '' }));
	const bench = roster
		.filter((p) => !p.starter && !p.subbedIn)
		.map((p) => ({ num: p.jersey != null ? Number(p.jersey) : null, name: p.athlete?.displayName ?? '' }));
	return { formation: r?.formation ?? null, starters, subs, bench };
}

/**
 * Per-match formations + lineups from the summary endpoint's `rosters`.
 * Returned keyed to OUR home/away (caller passes which ESPN side is home).
 */
export async function fetchEspnLineups(gameId: string): Promise<MatchLineups | null> {
	try {
		const res = await fetch(`${SUMMARY_URL}?event=${encodeURIComponent(gameId)}&_=${Date.now()}`, {
			headers: { Accept: 'application/json' }
		});
		if (!res.ok) return null;
		const data = await res.json();
		const rosters: any[] = data?.rosters ?? [];
		if (rosters.length < 2) return null;
		const homeR = rosters.find((r) => r.homeAway === 'home') ?? rosters[0];
		const awayR = rosters.find((r) => r.homeAway === 'away') ?? rosters[1];
		const home = buildTeamLineup(homeR);
		const away = buildTeamLineup(awayR);
		if (home.starters.length === 0 && away.starters.length === 0) return null;

		// Substitution timeline from keyEvents. Text format is reliable:
		// "Substitution, {Team}. {In} replaces {Out}." team.id → home/away.
		const homeId = String(
			(data?.header?.competitions?.[0]?.competitors ?? []).find((c: any) => c.homeAway === 'home')?.team?.id ?? ''
		);
		const subs: SubEvent[] = [];
		for (const ev of data?.keyEvents ?? []) {
			if (ev?.type?.text !== 'Substitution') continue;
			const m = (ev.text ?? '').match(/\.\s*(.+?)\s+replaces\s+(.+?)\.?\s*$/i);
			subs.push({
				minute: ev.clock?.displayValue ?? '',
				side: String(ev.team?.id ?? '') === homeId ? 'home' : 'away',
				playerIn: m ? m[1].trim() : (ev.participants?.[0]?.athlete?.displayName ?? null),
				playerOut: m ? m[2].trim() : (ev.participants?.[1]?.athlete?.displayName ?? null)
			});
		}

		return {
			home,
			away,
			subs,
			homeTeam: norm(homeR?.team?.displayName ?? ''),
			awayTeam: norm(awayR?.team?.displayName ?? '')
		};
	} catch {
		return null;
	}
}

export type MatchVenue = { stadium: string | null; city: string | null; country: string | null };

/** Stadium + host city/country from the summary endpoint's gameInfo.venue.
 *  Static per match, so the caller fetches it once then stops. */
export async function fetchEspnVenue(gameId: string): Promise<MatchVenue | null> {
	try {
		const res = await fetch(`${SUMMARY_URL}?event=${encodeURIComponent(gameId)}&_=${Date.now()}`, {
			headers: { Accept: 'application/json' }
		});
		if (!res.ok) return null;
		const data = await res.json();
		const v = data?.gameInfo?.venue;
		if (!v) return null;
		const stadium = v.fullName ?? v.shortName ?? null;
		const city = v.address?.city ?? null;
		const country = v.address?.country ?? null;
		if (!stadium && !country) return null;
		return { stadium, city, country };
	} catch {
		return null;
	}
}
