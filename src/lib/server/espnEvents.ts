// Match timeline (goals + cards) from ESPN's public scoreboard API.
//
// ESPN exposes an unauthenticated JSON endpoint covering every World Cup
// match of the day — one request returns goals, own goals, penalties and
// yellow/red cards with player names and the match clock. Polymarket only
// carries score/minute, so this fills the gap for free, without an API key.
//
// Non-fatal by design: any failure here just means "no timeline this tick".

const SCOREBOARD_URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';

export type MatchEvent = {
	minute: string;             // "9'", "45'+2'"
	type: 'goal' | 'og' | 'pen' | 'yellow' | 'red';
	side: 'home' | 'away';      // relative to OUR match row
	player: string | null;
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
export async function fetchEspnEvents(): Promise<Map<string, MatchEvent[]>> {
	const out = new Map<string, MatchEvent[]>();
	try {
		const res = await fetch(`${SCOREBOARD_URL}?_=${Date.now()}`, {
			headers: { Accept: 'application/json' }
		});
		if (!res.ok) return out;
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
		}
	} catch {
		// non-fatal — timeline simply doesn't update this tick
	}
	return out;
}
