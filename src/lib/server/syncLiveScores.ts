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
import { fetchAllScoredPronostics } from './pronostics';
import { backfillPolymarketSlugs, syncMatchOdds } from './sync-odds';
import { fetchEspnEvents, fetchEspnLineups, fetchEspnVenue, resolveEspnGameId } from './espnEvents';
import { fetchHighlightVideos } from './youtubeHighlights';

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
		// Cache-buster: gamma's CDN serves ~5-min-stale snapshots otherwise,
		// which lags the live score/minute behind the real match.
		const res = await fetch(`https://gamma-api.polymarket.com/events?slug=${encodeURIComponent(slug)}&_=${Date.now()}`, {
			headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' }
		});
		if (!res.ok) return null;
		const raw = await res.json();
		const events: PolymarketEvent[] = Array.isArray(raw) ? raw : raw.events ?? [];
		return events[0] ?? null;
	} catch {
		return null;
	}
}

// Map ESPN's home/away (lineups + substitution timeline) onto OUR home/away
// by team name, flipping the subs' side when the orientation is swapped.
function alignLineups(lu: any, ourHomeTeam: string) {
	const swap = String(lu.homeTeam).toLowerCase() !== ourHomeTeam.toLowerCase();
	const subs = (lu.subs ?? []).map((x: any) =>
		swap ? { ...x, side: x.side === 'home' ? 'away' : 'home' } : x
	);
	return swap
		? { home: lu.away, away: lu.home, subs }
		: { home: lu.home, away: lu.away, subs };
}

export async function syncLiveScores(
	supabase: SupabaseClient,
	opts: { force?: boolean } = {}
): Promise<{
	ok: boolean;
	scanned: number;
	due: number;
	updated: number;
	ended: number;
	scoredPronostics: number;
	eventsUpdated?: number;
	lineupsUpdated?: number;
	venuesUpdated?: number;
	videosUpdated?: number;
	bracketUpdated?: number;
	slugsUpdated?: number;
	oddsUpdated?: number;
	rescoredMatches?: number;
	error?: string;
}> {
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

	// Capture every player's total points the FIRST time a match is about to be
	// scored this run — i.e. the standings BEFORE this run's result(s). The
	// leaderboard compares live standings to the latest snapshot to show per-player
	// rank deltas (+N / -N) for the most recent match. Non-fatal.
	let rankSnapshotTaken = false;
	async function ensureRankSnapshot() {
		if (rankSnapshotTaken) return;
		rankSnapshotTaken = true;
		try {
			const [pr, { data: pf }] = await Promise.all([
				fetchAllScoredPronostics<{ user_id: string; points_earned: number | null }>(supabase, 'user_id, points_earned'),
				supabase.from('profiles').select('id, team_bonus_points')
			]);
			const totals: Record<string, number> = {};
			for (const row of pf ?? []) totals[(row as any).id] = (row as any).team_bonus_points ?? 0;
			for (const row of pr ?? []) {
				const uid = (row as any).user_id;
				totals[uid] = (totals[uid] ?? 0) + ((row as any).points_earned ?? 0);
			}
			await supabase.from('rank_snapshots').insert({ totals });
		} catch {
			// non-fatal — rank deltas just won't update for this match
		}
	}

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

		// Real match clock: written on every live poll so the UI shows
		// Polymarket's minute (handles halftime, stoppage, extra time) instead
		// of a computed estimate. Cleared at FT.
		if (isFinished) {
			patch.live_elapsed = null;
			patch.live_period = 'FT';
		} else {
			patch.live_elapsed = ev.elapsed ?? null;
			patch.live_period = ev.period ?? null;
		}

		if (Object.keys(patch).length === 0) continue;

		const { error } = await supabase.from('matches').update(patch).eq('id', m.id);
		if (error) continue;
		updated++;

		if (willTransitionToFinished) {
			// Snapshot pre-result standings before the first scoring of this run.
			await ensureRankSnapshot();
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

	// ── Timeline (goals + cards) from ESPN ─────────────────────────────────
	// One scoreboard request covers every match of the day. Runs whenever a
	// match is in play (or just ended this tick, to capture stoppage-time
	// events in the final write). Non-fatal.
	let eventsUpdated = 0;
	let lineupsUpdated = 0;
	const timelineCandidates = matches.filter(
		(m) => m.status !== 'upcoming' || new Date(m.match_datetime).getTime() <= nowMs
	);
	if (timelineCandidates.length > 0) {
		try {
			const { events: espn, gameIds } = await fetchEspnEvents();
			if (espn.size > 0 || gameIds.size > 0) {
				const { data: currentRows } = await supabase
					.from('matches')
					.select('id, home_team, away_team, status, live_events, lineups, espn_game_id')
					.in('id', timelineCandidates.map((m) => m.id));

				for (const row of currentRows ?? []) {
					const k = `${row.home_team.toLowerCase()}|${row.away_team.toLowerCase()}`;
					const patch: Record<string, unknown> = {};

					const events = espn.get(k);
					if (events && events.length > 0 && JSON.stringify(row.live_events ?? []) !== JSON.stringify(events)) {
						patch.live_events = events;
					}

					const gid = gameIds.get(k) ?? row.espn_game_id;
					if (gid && row.espn_game_id !== gid) patch.espn_game_id = gid;

					// Formations, lineups + substitution timeline (ESPN summary).
					// Substitutions live ONLY in the summary's keyEvents — the per-minute
					// scoreboard carries goals/cards but never subs — so we refresh the
					// summary on every tick while a match is in play. That lands new subs
					// in the live timeline within ~1 min (same freshness as goals/cards)
					// and also catches stoppage-time subs on the FT tick. currentRows is
					// already limited to in-play / just-ended matches; the JSON diff below
					// skips no-op writes.
					if (gid) {
						const lu = await fetchEspnLineups(gid);
						if (lu) {
							// Align ESPN home/away to OUR home/away by team name.
							const aligned = alignLineups(lu, row.home_team);
							if (JSON.stringify(row.lineups ?? {}) !== JSON.stringify(aligned)) {
								patch.lineups = aligned;
							}
						}
					}

					if (Object.keys(patch).length === 0) continue;
					const { error } = await supabase.from('matches').update(patch).eq('id', row.id);
					if (!error) {
						if (patch.live_events) eventsUpdated++;
						if (patch.lineups) lineupsUpdated++;
					}
				}
			}
		} catch {
			// non-fatal — timeline/lineups simply don't update this tick
		}
	}

	// ── Official highlights from the FIFA YouTube playlist ─────────────────
	// For finished matches (last 7 days) without a highlight yet, match against
	// the playlist's RSS feed by team names and store the videoId. The feed is
	// one cheap keyless call, fetched only when there's an unmatched match.
	let videosUpdated = 0;
	try {
		const since = new Date(nowMs - 7 * 86400_000).toISOString();
		const { data: needHighlight } = await supabase
			.from('matches')
			.select('id, home_team, away_team')
			.eq('status', 'finished')
			.is('youtube_video_id', null)
			.gte('match_datetime', since);

		if ((needHighlight ?? []).length > 0) {
			const videos = await fetchHighlightVideos();
			if (videos.size > 0) {
				for (const row of needHighlight ?? []) {
					const vid = videos.get(`${row.home_team.toLowerCase()}|${row.away_team.toLowerCase()}`);
					if (!vid) continue;
					const { error } = await supabase
						.from('matches')
						.update({ youtube_video_id: vid })
						.eq('id', row.id);
					if (!error) videosUpdated++;
				}
			}
		}
	} catch {
		// non-fatal — highlights simply don't match this tick
	}

	// ── Lineups backfill for finished matches ──────────────────────────────
	// Live matches get lineups during play (timeline pass above). Matches that
	// finished without lineups (e.g. before this feature) are backfilled here:
	// resolve the gameId from the dated scoreboard, fetch the summary rosters.
	// Capped to a couple per tick so the per-minute cron stays light.
	try {
		const since = new Date(nowMs - 7 * 86400_000).toISOString();
		const { data: needLineups } = await supabase
			.from('matches')
			.select('id, home_team, away_team, match_datetime, espn_game_id')
			.eq('status', 'finished')
			.is('lineups', null)
			.gte('match_datetime', since)
			.limit(2);

		for (const row of needLineups ?? []) {
			const gid = row.espn_game_id ?? await resolveEspnGameId(row.home_team, row.away_team, row.match_datetime);
			if (!gid) continue;
			const lu = await fetchEspnLineups(gid);
			if (!lu) continue;
			const aligned = alignLineups(lu, row.home_team);
			await supabase.from('matches').update({ lineups: aligned, espn_game_id: gid }).eq('id', row.id);
			lineupsUpdated++;
		}
	} catch {
		// non-fatal — lineups backfill simply doesn't run this tick
	}

	// ── Venue / host location backfill ─────────────────────────────────────
	// Stadium + host city/country are static, so we fill them once per match
	// (any status, real teams) then never refetch. Capped at 3 per tick — over
	// ~40 min the whole calendar fills in.
	let venuesUpdated = 0;
	try {
		const { data: needVenue } = await supabase
			.from('matches')
			.select('id, home_team, away_team, match_datetime, espn_game_id')
			.is('venue_country', null)
			.neq('home_team', 'TBD')
			.order('match_datetime', { ascending: true })
			.limit(3);

		for (const row of needVenue ?? []) {
			const gid = row.espn_game_id ?? await resolveEspnGameId(row.home_team, row.away_team, row.match_datetime);
			if (!gid) continue;
			const v = await fetchEspnVenue(gid);
			if (!v) continue;
			await supabase
				.from('matches')
				.update({ venue: v.stadium, venue_city: v.city, venue_country: v.country, espn_game_id: gid })
				.eq('id', row.id);
			venuesUpdated++;
		}
	} catch {
		// non-fatal — venue backfill simply doesn't run this tick
	}

	// ── Safety: re-score finished matches with leftover unscored predictions ───
	// A scoreMatch run that was cut off (function time limit / transient error)
	// leaves some picks is_scored=false on a finished match, and nothing retries
	// them — scoring only fires on the FT transition, which is already past. Find
	// finished matches that still have unscored picks and re-score them. Idempotent
	// (already-scored picks recompute to the same points; the team bonus is gated
	// by bonus_calculated, so no double-award). Capped per tick so this pass can't
	// itself stall the cron.
	let rescoredMatches = 0;
	try {
		const { data: needRescore } = await supabase
			.from('matches')
			.select('id, home_team, away_team, home_score, away_score, stage, bonus_calculated, odds_home, odds_draw, odds_away, pronostics!inner(id)')
			.eq('status', 'finished')
			.eq('pronostics.is_scored', false)
			.limit(5);

		for (const m of needRescore ?? []) {
			try {
				await scoreMatch(supabase, m as any);
				rescoredMatches++;
			} catch {
				// non-fatal — next tick retries (re-scoring is idempotent)
			}
		}
	} catch {
		// non-fatal — safety re-score simply doesn't run this tick
	}

	// ── Cascade after any FT transition ────────────────────────────────────
	// When a match ends, the bracket may now be ready to fill one or more
	// knockout slots (e.g. last group match → R32 pairings, last R32 → R16).
	// We chain resolve_bracket → backfillPolymarketSlugs → syncMatchOdds so
	// the newly-named matches are immediately tracked by future cron ticks
	// — no admin click required between rounds.
	let bracketUpdated = 0;
	let slugsUpdated = 0;
	let oddsUpdated = 0;
	if (ended > 0) {
		try {
			const { data: bracketResult } = await supabase.rpc('resolve_bracket');
			bracketUpdated = ((bracketResult as any)?.updated ?? 0) as number;
		} catch {
			// non-fatal — daily 06:00 cron will retry
		}

		if (bracketUpdated > 0) {
			try {
				const r = await backfillPolymarketSlugs(supabase);
				if (r.ok) slugsUpdated = r.updated;
			} catch { /* non-fatal */ }
			try {
				const r = await syncMatchOdds(supabase);
				if (r.ok) oddsUpdated = r.updated;
			} catch { /* non-fatal */ }
		}
	}

	return {
		ok: true,
		scanned: matches.length,
		due: due.length,
		updated,
		ended,
		scoredPronostics,
		eventsUpdated,
		lineupsUpdated,
		venuesUpdated,
		videosUpdated,
		bracketUpdated,
		slugsUpdated,
		oddsUpdated,
		rescoredMatches
	};
}
