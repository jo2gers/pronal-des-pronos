export function isoToFlag(iso: string | null | undefined): string {
	if (!iso || iso === 'TBD') return '🏳';
	return iso
		.toUpperCase()
		.split('')
		.map((c) => String.fromCodePoint(c.charCodeAt(0) + 127397))
		.join('');
}

export function formatDate(datetime: string): string {
	return new Date(datetime).toLocaleDateString('fr-FR', {
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
