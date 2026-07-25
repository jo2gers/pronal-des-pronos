// Sanitize a user-supplied post-auth redirect target. Only same-origin absolute
// PATHS are allowed: must start with a single '/', never '//' (protocol-relative
// → off-site) nor '/\' (some browsers normalise the backslash to a slash), and
// never a scheme. Anything else falls back to the home page, so a crafted
// ?next=https://evil.com can't turn login/register into an open redirect.
export function safeNext(next: string | null | undefined): string {
	if (!next || !next.startsWith('/')) return '/';
	if (next.startsWith('//') || next.startsWith('/\\')) return '/';
	return next;
}

export function isoToFlag(iso: string | null | undefined): string {
	if (!iso || iso === 'TBD') return '🏳';
	return iso
		.toUpperCase()
		.split('')
		.map((c) => String.fromCodePoint(c.charCodeAt(0) + 127397))
		.join('');
}

export function formatDate(datetime: string, lang: 'fr' | 'en' = 'fr'): string {
	return new Date(datetime).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', {
		weekday: 'short',
		day: 'numeric',
		month: 'short',
		hour: '2-digit',
		minute: '2-digit'
	});
}

// Just the hour:minute portion — used inside a day-grouped list where the
// full date already appears in the section header.
export function formatTime(datetime: string, lang: 'fr' | 'en' = 'fr'): string {
	return new Date(datetime).toLocaleTimeString(lang === 'fr' ? 'fr-FR' : 'en-GB', {
		hour: '2-digit',
		minute: '2-digit'
	});
}

// Calendar-day countdown ("J-X" / "today" / "tomorrow") for the day-header
// label. Returns null for past dates.
export function daysUntilMatch(datetime: string, lang: 'fr' | 'en' = 'fr'): string | null {
	const target = new Date(datetime);
	const now = new Date();
	// Compare at midnight to avoid hour drift around the day boundary.
	const a = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
	const b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
	const days = Math.round((a - b) / 86400000);
	if (days < 0) return null;
	if (days === 0) return lang === 'fr' ? "Aujourd'hui" : 'Today';
	if (days === 1) return lang === 'fr' ? 'Demain'       : 'Tomorrow';
	return `J-${days}`;
}

// "2026-6-11" key for grouping matches by calendar day in the user's tz.
export function dayKey(datetime: string): string {
	const d = new Date(datetime);
	return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

// "lundi 29 juin" / "Monday 29 June" — full-word day label for section headers.
export function dayLabel(datetime: string, lang: 'fr' | 'en' = 'fr'): string {
	return new Date(datetime).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', {
		weekday: 'long',
		day: 'numeric',
		month: 'long'
	});
}

// Group an array of objects with a `.match_datetime` field into day buckets,
// preserving array order. Returns one bucket per calendar day with the
// localised label ready to render as a section header.
export function groupByDay<T extends { match_datetime: string }>(
	items: T[],
	lang: 'fr' | 'en' = 'fr'
): { key: string; label: string; items: T[] }[] {
	const out: { key: string; label: string; items: T[] }[] = [];
	for (const item of items) {
		const k = dayKey(item.match_datetime);
		const last = out[out.length - 1];
		if (last && last.key === k) last.items.push(item);
		else out.push({ key: k, label: dayLabel(item.match_datetime, lang), items: [item] });
	}
	return out;
}

// Knockout result beyond 90 minutes. Returns the deciding score (extra time or
// penalties) and which side advanced, or null when the match was settled in
// regulation (then the 90-min score in home_score/away_score is all there is).
export function knockoutOutcome(m: {
	ft_home_score?: number | null;
	ft_away_score?: number | null;
	pen_home?: number | null;
	pen_away?: number | null;
}): { decided: 'aet' | 'pens'; home: number; away: number; winner: 'home' | 'away' } | null {
	if (m.pen_home != null && m.pen_away != null) {
		return { decided: 'pens', home: m.pen_home, away: m.pen_away, winner: m.pen_home > m.pen_away ? 'home' : 'away' };
	}
	if (m.ft_home_score != null && m.ft_away_score != null) {
		return { decided: 'aet', home: m.ft_home_score, away: m.ft_away_score, winner: m.ft_home_score > m.ft_away_score ? 'home' : 'away' };
	}
	return null;
}

// Match locks 5 minutes before kickoff
export const MATCH_LOCK_MS = 5 * 60 * 1000;

export function isMatchLocked(matchDatetime: string): boolean {
	return new Date(matchDatetime).getTime() - Date.now() < MATCH_LOCK_MS;
}

// Pick the odds that apply to a (predicted_home, predicted_away) outcome, with
// a 1.0 floor. `match.odds_*` can legitimately be missing (null) when the
// Polymarket cron hasn't ingested the match yet, OR — the bug we just fixed —
// stored as 0 if the upstream feed gave us a zero. `?? 1.0` only catches null,
// so a stored 0 would silently zero out the user's points (1 * 0 = 0).
export function resolveOddsUsed(
	predicted_home: number,
	predicted_away: number,
	match: { odds_home?: number | null; odds_draw?: number | null; odds_away?: number | null }
): number {
	const outcome = Math.sign(predicted_home - predicted_away);
	let raw: number | null | undefined;
	if      (outcome > 0)  raw = match.odds_home;
	else if (outcome === 0) raw = match.odds_draw;
	else                   raw = match.odds_away;
	const odds = typeof raw === 'number' ? raw : Number(raw);
	return Number.isFinite(odds) && odds >= 1 ? odds : 1.0;
}

// Knockout picks are no longer gated by whole-stage progression — a match opens
// as soon as its two teams are confirmed (home_team/away_team ≠ 'TBD', filled by
// resolve_bracket the moment its feeder matches finish). See the pick actions +
// MatchPickRow. (Removed computeStageUnlocks / STAGE_PROGRESSION.)

// Derived match status that respects the wall clock: once kickoff time has
// passed, treat a still-'upcoming' row as 'live'. Admins don't always flip the
// DB status the second a match starts, but picks are already locked and 0-0
// is the right default — we shouldn't keep showing it in the upcoming list.
//
// Bounded window: a match many hours past kickoff that's STILL 'upcoming' means
// the live sync never ran for it (e.g. it never got a Polymarket slug), so there
// is no real score/clock — faking a perpetual "LIVE 90+'" is worse than leaving
// the raw status. 3h comfortably covers the longest real match (90' + stoppage +
// extra time + penalties). A properly synced live match carries DB status='live'
// and is unaffected by this cap.
export const LIVE_HEURISTIC_WINDOW_MS = 3 * 60 * 60 * 1000;
export function effectiveStatus(
	match: { status: 'upcoming' | 'live' | 'finished'; match_datetime: string }
): 'upcoming' | 'live' | 'finished' {
	if (match.status === 'upcoming') {
		const sinceKickoff = Date.now() - new Date(match.match_datetime).getTime();
		if (sinceKickoff >= 0 && sinceKickoff <= LIVE_HEURISTIC_WINDOW_MS) return 'live';
	}
	return match.status;
}

// Real match clock from Polymarket (matches.live_elapsed / live_period).
// Returns "67′", "45+2′", "MT"/"HT" at halftime… or null when no data yet —
// callers fall back to their own estimate.
//
// `syncedAt` (matches.last_score_sync_at) lets us extrapolate between polls:
// gamma's CDN snapshots can lag a few minutes, so we add the time elapsed
// since the value was fetched. Only safe for plain numeric minutes in open
// play — stoppage-time strings ("45+2") and halftime are shown as-is.
export function liveClock(
	elapsed: string | null | undefined,
	period: string | null | undefined,
	lang: 'fr' | 'en' = 'fr',
	syncedAt?: string | null,
	matchDatetime?: string | null
): string | null {
	// Knockout overtime — live_period 'ET'/'PENS' is written from ESPN's status
	// (period 3-4 = extra time, 5 = shootout), overriding Polymarket's labels.
	if (period === 'PENS') return lang === 'fr' ? 'TAB' : 'Pens';
	if (period === 'ET') {
		if (elapsed && /^\d+$/.test(elapsed)) {
			const driftMin = syncedAt
				? Math.max(0, Math.floor((Date.now() - new Date(syncedAt).getTime()) / 60000))
				: 0;
			const minute = Math.min(120, parseInt(elapsed, 10) + driftMin);
			return `${lang === 'fr' ? 'Prol.' : 'ET'} ${minute}′`;
		}
		return lang === 'fr' ? 'Prolongation' : 'Extra time';
	}
	if (period === 'HT') {
		// Polymarket labels the break before extra time 'HT' too. A "halftime"
		// 100+ min after kickoff can only be that break — call it what it is.
		if (matchDatetime && Date.now() - new Date(matchDatetime).getTime() > 100 * 60 * 1000) {
			return lang === 'fr' ? 'Prolongation' : 'Extra time';
		}
		return lang === 'fr' ? 'MT' : 'HT';
	}
	if (period === 'FT' || period === 'VFT') return null; // finished — no clock
	if (!elapsed) return null;

	if (/^\d+$/.test(elapsed) && syncedAt && (period === '1H' || period === '2H')) {
		const driftMin = Math.max(0, Math.floor((Date.now() - new Date(syncedAt).getTime()) / 60000));
		const cap = period === '1H' ? 45 : 90;
		const minute = parseInt(elapsed, 10) + driftMin;
		return minute > cap ? `${cap}+′` : `${minute}′`;
	}
	return `${elapsed}′`;
}

export function timeUntilMatch(matchDatetime: string): string {
	const diff = new Date(matchDatetime).getTime() - Date.now();
	if (diff <= 0) return 'Commencé';
	const days = Math.floor(diff / 86400000);
	const hours = Math.floor((diff % 86400000) / 3600000);
	const mins = Math.floor((diff % 3600000) / 60000);
	if (days > 0) return `J-${days}`;
	if (hours > 0) return `${hours}h${mins.toString().padStart(2, '0')}`;
	return `${mins} min`;
}
