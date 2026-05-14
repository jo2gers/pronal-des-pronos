// Fetch live scores from Polymarket's gamma API for any match with
// `polymarket_event_slug` set + status='live' (or upcoming but past kickoff,
// so the cron picks up the second a match starts).
//
// Polymarket event response includes:
//   { score: "1-1", elapsed: "45", period: "1H", live: true, ended: false, ... }
//
// We parse `score`, write `home_score`/`away_score`, and on `ended === true`
// flip status to 'finished'.
//
// Rate-limited per Vercel function instance: skip syncs <20s apart. Each
// serverless cold-start gets a fresh limiter, which is fine — duplicate work
// is harmless (idempotent updates).

import type { SupabaseClient } from '@supabase/supabase-js';
import { scoreMatch } from './scoring';

const MIN_SYNC_INTERVAL_MS = 20_000;
let lastSyncAt = 0;

type LiveMatchRow = {
	id: string;
	home_team: string;
	away_team: string;
	match_datetime: string;
	status: 'upcoming' | 'live' | 'finished';
	home_score: number | null;
	away_score: number | null;
	stage: string;
	bonus_calculated: boolean;
	polymarket_event_slug: string;
};

type PolymarketEvent = {
	id: string;
	slug?: string;
	score?: string;       // "1-1"
	elapsed?: string;     // "45"
	period?: string;      // "1H" | "2H" | "HT" | "FT" | ...
	live?: boolean;
	ended?: boolean;
};

function parseScore(s: string | undefined): [number, number] | null {
	if (!s || typeof s !== 'string') return null;
	const m = s.match(/^(\d+)\s*-\s*(\d+)$/);
	if (!m) return null;
	const h = parseInt(m[1], 10), a = parseInt(m[2], 10);
	if (!Number.isFinite(h) || !Number.isFinite(a)) return null;
	return [h, a];
}

async function fetchPolymarketEvent(slug: string): Promise<PolymarketEvent | null> {
	try {
		const res = await fetch(`https://gamma-api.polymarket.com/events?slug=${encodeURIComponent(slug)}`, {
			headers: { Accept: 'application/json' }
		});
		if (!res.ok) return null;
		const raw = await res.json();
		const events: PolymarketEvent[] = Array.isArray(raw) ? raw : raw.events ?? [];
		return events[0] ?? null;
	} catch {
		return null;
	}
}

export async function syncLiveScores(
	supabase: SupabaseClient,
	opts: { force?: boolean } = {}
): Promise<{ ok: boolean; scanned: number; updated: number; ended: number; scoredPronostics?: number; skipped?: string }> {
	const now = Date.now();
	if (!opts.force && now - lastSyncAt < MIN_SYNC_INTERVAL_MS) {
		return { ok: true, scanned: 0, updated: 0, ended: 0, skipped: 'rate-limited' };
	}
	lastSyncAt = now;

	const nowIso = new Date(now).toISOString();

	// Live OR (upcoming + past kickoff) — covers the gap between kickoff and
	// admin flipping the row to 'live'.
	const { data: rawMatches } = await supabase
		.from('matches')
		.select('id, home_team, away_team, match_datetime, status, home_score, away_score, stage, bonus_calculated, polymarket_event_slug')
		.not('polymarket_event_slug', 'is', null)
		.or(`status.eq.live,and(status.eq.upcoming,match_datetime.lte.${nowIso})`);

	const matches = (rawMatches ?? []) as LiveMatchRow[];
	let updated = 0;
	let ended = 0;
	let scoredPronostics = 0;

	for (const m of matches) {
		const ev = await fetchPolymarketEvent(m.polymarket_event_slug);
		if (!ev) continue;

		const pair = parseScore(ev.score);
		if (!pair) continue;

		const [home_score, away_score] = pair;
		const isFinished = ev.ended === true;
		const willTransitionToFinished = isFinished && m.status !== 'finished';

		const patch: Record<string, unknown> = {};
		if (home_score !== m.home_score) patch.home_score = home_score;
		if (away_score !== m.away_score) patch.away_score = away_score;
		if (willTransitionToFinished) patch.status = 'finished';
		else if (!isFinished && m.status === 'upcoming') patch.status = 'live';

		if (Object.keys(patch).length === 0) continue;

		const { error } = await supabase.from('matches').update(patch).eq('id', m.id);
		if (error) continue;
		updated++;

		// Auto-score on the FT transition. scoreMatch is idempotent (the team
		// bonus is guarded by bonus_calculated), so retries are safe if the
		// rate-limit window lapses while a match's ended flag stays true.
		if (willTransitionToFinished) {
			ended++;
			try {
				const { scored } = await scoreMatch(supabase, {
					id: m.id,
					home_team: m.home_team,
					away_team: m.away_team,
					home_score,
					away_score,
					stage: m.stage,
					bonus_calculated: m.bonus_calculated
				});
				scoredPronostics += scored;
			} catch {
				// non-fatal — admin can still run "Calculer tous" by hand
			}
		}
	}

	return { ok: true, scanned: matches.length, updated, ended, scoredPronostics };
}
