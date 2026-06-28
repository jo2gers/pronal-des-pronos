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

// ── Knockout stage gate ───────────────────────────────────────────────────
// A stage unlocks only when EVERY match in the previous stage is finished.
// Mirrors the natural tournament flow: you can't predict R32 until all
// group matches are done (even if a few R32 slots are already populated
// by resolve_bracket), R16 stays locked until R32 is done, etc.
//
// Returns a map { stage -> boolean } where true = picks allowed.
export const STAGE_PROGRESSION: Record<string, string | null> = {
	group:        null,            // always unlocked, no predecessor
	round_of_32:  'group',
	round_of_16:  'round_of_32',
	quarters:     'round_of_16',
	semis:        'quarters',
	third:        'semis',
	final:        'semis'
};

export function computeStageUnlocks(
	matches: { stage: string; status: 'upcoming' | 'live' | 'finished' }[]
): Record<string, boolean> {
	// Count unfinished matches per stage (any non-finished status blocks).
	const unfinishedByStage: Record<string, number> = {};
	for (const m of matches) {
		if (m.status !== 'finished') {
			unfinishedByStage[m.stage] = (unfinishedByStage[m.stage] ?? 0) + 1;
		}
	}
	const unlocks: Record<string, boolean> = {};
	for (const stage of Object.keys(STAGE_PROGRESSION)) {
		const prev = STAGE_PROGRESSION[stage];
		unlocks[stage] = prev === null || (unfinishedByStage[prev] ?? 0) === 0;
	}
	return unlocks;
}

// Derived match status that respects the wall clock: once kickoff time has
// passed, treat a still-'upcoming' row as 'live'. Admins don't always flip the
// DB status the second a match starts, but picks are already locked and 0-0
// is the right default — we shouldn't keep showing it in the upcoming list.
export function effectiveStatus(
	match: { status: 'upcoming' | 'live' | 'finished'; match_datetime: string }
): 'upcoming' | 'live' | 'finished' {
	if (match.status === 'upcoming' && new Date(match.match_datetime).getTime() <= Date.now()) {
		return 'live';
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
	syncedAt?: string | null
): string | null {
	if (period === 'HT') return lang === 'fr' ? 'MT' : 'HT';
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
