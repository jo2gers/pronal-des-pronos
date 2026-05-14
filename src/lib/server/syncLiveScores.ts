// Fetch live scores from Polymarket's gamma API for any match with
// `polymarket_event_slug` set + status='live' (or upcoming but past kickoff).
//
// Polling cadence is per-match, computed from elapsed-time since kickoff:
//   <45 min   → skip (pre-HT, no info expected)
//   45-90 min → poll once / 60 min (catches the halftime score)
//   90+ min   → poll every 5 min until ended (catches FT)
//
// Each successful fetch stamps matches.last_score_sync_at so the cooldown is
// persisted across Vercel cold starts. On the FT transition (`ended:true`),
// scoreMatch runs in the same tick — pronostics get points, fans of the
// winner get team_bonus_points, no admin click needed.

import type { SupabaseClient } from '@supabase/supabase-js';
import { scoreMatch } from './scoring';

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
	last_score_sync_at: string | null;
	polymarket_event_slug: string;
};

type PolymarketEvent = {
	id: string;
	slug?: string;
	score?: string;       // "1-1"
	elapsed?: string;     // "45"
	period?: string;      // "1H" | "2H" | "HT" | "FT" | "VFT" | ...
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

// Returns true if the match should be polled now given how long ago we last
// fetched it. See module header for the cadence table.
function isDueForSync(match: LiveMatchRow, nowMs: number): boolean {
	const kickoffMs = new Date(match.match_datetime).getTime();
	const elapsedMin = (nowMs - kickoffMs) / 60_000;

	// Pre-HT: nothing useful to fetch yet
	if (elapsedMin < 45) return false;

	const lastSyncMs = match.last_score_sync_at
		? new Date(match.last_score_sync_at).getTime()
		: 0;
	const sinceLastSyncMin = (nowMs - lastSyncMs) / 60_000;

	// 45-90 min: catch the HT score with one poll per hour
	// 90+: tight loop to catch FT
	const cooldownMin = elapsedMin < 90 ? 60 : 5;
	return sinceLastSyncMin >= cooldownMin;
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
): Promise<{ ok: boolean; scanned: number; due: number; updated: number; ended: number; scoredPronostics: number; error?: string }> {
	const nowMs = Date.now();
	const nowIso = new Date(nowMs).toISOString();

	// Pull both 'live' and 'upcoming' rows with a slug — filter past-kickoff
	// upcoming rows in code. (Using PostgREST .or() with a nested .and() and
	// an inline ISO timestamp doesn't work: the dots in 2026-05-14T22:36:33.303Z
	// collide with PostgREST's field.op.value delimiter.)
	const { data: rawMatches, error: selectError } = await supabase
		.from('matches')
		.select('id, home_team, away_team, match_datetime, status, home_score, away_score, stage, bonus_calculated, last_score_sync_at, polymarket_event_slug')
		.not('polymarket_event_slug', 'is', null)
		.in('status', ['live', 'upcoming']);

	if (selectError) {
		return { ok: false, scanned: 0, due: 0, updated: 0, ended: 0, scoredPronostics: 0, error: selectError.message };
	}

	const matches = ((rawMatches ?? []) as LiveMatchRow[]).filter((m) =>
		m.status === 'live' || (m.status === 'upcoming' && new Date(m.match_datetime).getTime() <= nowMs)
	);
	const due = opts.force ? matches : matches.filter((m) => isDueForSync(m, nowMs));

	let updated = 0;
	let ended = 0;
	let scoredPronostics = 0;

	for (const m of due) {
		const ev = await fetchPolymarketEvent(m.polymarket_event_slug);
		// Stamp the timestamp even if the fetch returned nothing — otherwise
		// every page load past the cooldown would re-hit Polymarket for the
		// same dead slug. Use service-role client so RLS doesn't block.
		await supabase.from('matches').update({ last_score_sync_at: nowIso }).eq('id', m.id);

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

	return { ok: true, scanned: matches.length, due: due.length, updated, ended, scoredPronostics };
}
