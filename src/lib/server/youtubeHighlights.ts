// Official FIFA World Cup highlights from a public YouTube playlist.
//
// The playlist's RSS feed (keyless, no API quota) lists its most recent ~15
// videos with title + videoId. Highlights publish within hours of a match, and
// we only need to match each video to a match ONCE (then store the id), so the
// rolling 15-video window always contains a just-published highlight when we
// look. Titles carry English team names, e.g.:
//   "USA vs. Paraguay | Match in 5 | FIFA World Cup 2026"
//   "Canada v Bosnia and Herzegovina | Match in 5 | FIFA World Cup 2026"
//   "Korea Republic vs. Czechia | Match in 5 | FIFA World Cup 2026"
//
// Videos are embedded via youtube-nocookie on the match page — YouTube's
// official, intended iframe embed (legal, unlike hotlinking a CDN stream).
//
// Non-fatal by design: any failure just means "no highlight match this tick".

const PLAYLIST_ID = 'PLrknD2SRMNPkuMlrH-9bt6Djgxvyn2mib';
const RSS_URL = `https://www.youtube.com/feeds/videos.xml?playlist_id=${PLAYLIST_ID}`;

// YouTube title name → our DB English name (only where they differ).
const YT_NAME_MAP: Record<string, string> = {
	Czechia: 'Czech Republic',
	'Korea Republic': 'South Korea',
	'Republic of Korea': 'South Korea',
	'United States': 'USA',
	'United States of America': 'USA',
	"Côte d'Ivoire": 'Ivory Coast',
	'Cote d’Ivoire': 'Ivory Coast',
	'Congo DR': 'DR Congo',
	'DR Congo': 'DR Congo',
	Türkiye: 'Turkey',
	Turkiye: 'Turkey',
	'Cabo Verde': 'Cape Verde',
	'IR Iran': 'Iran',
	'Bosnia-Herzegovina': 'Bosnia and Herzegovina'
};
const norm = (n: string) => {
	const t = n.trim();
	return YT_NAME_MAP[t] ?? t;
};

const key = (a: string, b: string) => `${a.toLowerCase()}|${b.toLowerCase()}`;

function decodeEntities(s: string): string {
	return s
		.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#0?39;/g, "'");
}

// "USA vs. Paraguay | Match in 5 | ..." → ["USA","Paraguay"] (our EN names)
function parseTeams(title: string): [string, string] | null {
	const matchup = decodeEntities(title).split('|')[0].trim();
	// Non-greedy first team, then " vs. " / " vs " / " v " separator.
	const m = matchup.match(/^(.+?)\s+(?:vs\.?|v)\s+(.+)$/i);
	if (!m) return null;
	const a = norm(m[1]);
	const b = norm(m[2]);
	if (!a || !b) return null;
	return [a, b];
}

/**
 * One RSS fetch → map keyed by "teamA|teamB" (our EN names, lowercased, both
 * orientations) → YouTube videoId.
 */
export async function fetchHighlightVideos(): Promise<Map<string, string>> {
	const out = new Map<string, string>();
	try {
		const res = await fetch(`${RSS_URL}&_=${Date.now()}`, { headers: { Accept: 'application/xml' } });
		if (!res.ok) return out;
		const xml = await res.text();

		// Each <entry> has <yt:videoId> and <title>. Parse per-entry so a title
		// is paired with the right id (the feed's own <title> is the playlist).
		const entries = xml.split('<entry>').slice(1);
		for (const entry of entries) {
			const vid = entry.match(/<yt:videoId>(.*?)<\/yt:videoId>/)?.[1];
			const title = entry.match(/<title>(.*?)<\/title>/)?.[1];
			if (!vid || !title) continue;
			const teams = parseTeams(title);
			if (!teams) continue;
			const [a, b] = teams;
			if (!out.has(key(a, b))) out.set(key(a, b), vid);
			if (!out.has(key(b, a))) out.set(key(b, a), vid);
		}
	} catch {
		// non-fatal
	}
	return out;
}
