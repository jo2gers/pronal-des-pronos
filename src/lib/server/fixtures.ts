// V2 season-fixture ingestion — pulls a competition's calendar from ESPN and
// upserts matches + competition_teams. Idempotent: matches key on
// espn_game_id (unique partial index, migration 041), so re-running updates
// reschedules in place instead of duplicating; scores/status of matches
// already past kickoff are owned by the live-sync loop and never clobbered.
//
// Works for any competitions row with an espn_league slug ('eng.1',
// 'uefa.champions'…) — the same scoreboard shape the WC pipeline already
// consumes. Range queries (dates=YYYYMMDD-YYYYMMDD) are supported by ESPN and
// fetched in ≤30-day chunks.

import type { SupabaseClient } from '@supabase/supabase-js';

const BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer';

const fmtDay = (x: Date) =>
	`${x.getUTCFullYear()}${String(x.getUTCMonth() + 1).padStart(2, '0')}${String(x.getUTCDate()).padStart(2, '0')}`;

const espnState = (e: any): string => String(e?.competitions?.[0]?.status?.type?.state ?? e?.status?.type?.state ?? 'pre');

export async function syncCompetitionFixtures(
	supabase: SupabaseClient,
	slug: string,
	window: { from: string; to: string }
): Promise<
	| { ok: false; error: string }
	| { ok: true; total: number; teams: number; inserted: number; updated: number; skippedLive: number }
> {
	const { data: comp } = await supabase
		.from('competitions')
		.select('id, espn_league, format')
		.eq('slug', slug)
		.maybeSingle();
	if (!comp?.espn_league) return { ok: false, error: `unknown competition or espn_league: ${slug}` };

	// ── Fetch the whole window, deduped by ESPN event id ─────────────────────
	const events = new Map<string, any>();
	let cursor = new Date(window.from);
	const end = new Date(window.to);
	while (cursor <= end) {
		const chunkEnd = new Date(Math.min(end.getTime(), cursor.getTime() + 29 * 86400000));
		const res = await fetch(
			`${BASE}/${comp.espn_league}/scoreboard?dates=${fmtDay(cursor)}-${fmtDay(chunkEnd)}&limit=400`,
			{ headers: { Accept: 'application/json' } }
		);
		if (res.ok) {
			const data = await res.json();
			for (const e of data?.events ?? []) if (e?.id) events.set(String(e.id), e);
		}
		cursor = new Date(chunkEnd.getTime() + 86400000);
	}
	if (events.size === 0) return { ok: true, total: 0, teams: 0, inserted: 0, updated: 0, skippedLive: 0 };

	// ── Teams → competition_teams (crest, short name, espn id) ───────────────
	const teams = new Map<string, { short_name: string | null; espn_team_id: string | null; logo_url: string | null }>();
	for (const e of events.values()) {
		for (const c of e?.competitions?.[0]?.competitors ?? []) {
			const t = c?.team;
			const name = t?.displayName;
			if (!name || teams.has(name)) continue;
			teams.set(name, {
				short_name: t?.shortDisplayName ?? null,
				espn_team_id: t?.id != null ? String(t.id) : null,
				logo_url: t?.logo ?? null
			});
		}
	}
	const { error: teamErr } = await supabase.from('competition_teams').upsert(
		[...teams.entries()].map(([name_en, t]) => ({ competition_id: comp.id, name_en, ...t })),
		{ onConflict: 'competition_id,name_en' }
	);
	if (teamErr) return { ok: false, error: `teams upsert: ${teamErr.message}` };

	// ── Matches: insert new, update rescheduled ──────────────────────────────
	const { data: existingRows, error: exErr } = await supabase
		.from('matches')
		.select('id, espn_game_id, match_datetime, venue, status')
		.eq('competition_id', comp.id)
		.not('espn_game_id', 'is', null);
	if (exErr) return { ok: false, error: `existing select: ${exErr.message}` };
	const existing = new Map((existingRows ?? []).map((r) => [String(r.espn_game_id), r]));

	const stage = comp.format === 'league' || comp.format === 'league_then_knockout' ? 'league' : 'group';
	let inserted = 0;
	let updated = 0;
	let skippedLive = 0;
	const toInsert: any[] = [];

	for (const [gid, e] of events) {
		const comp0 = e.competitions?.[0];
		const cs: any[] = comp0?.competitors ?? [];
		const home = cs.find((c) => c.homeAway === 'home')?.team?.displayName;
		const away = cs.find((c) => c.homeAway === 'away')?.team?.displayName;
		if (!home || !away || !e.date) continue;

		const row = existing.get(gid);
		if (!row) {
			toInsert.push({
				competition_id: comp.id,
				espn_game_id: gid,
				home_team: home,
				away_team: away,
				stage,
				status: 'upcoming',
				match_datetime: new Date(e.date).toISOString(),
				venue: comp0?.venue?.fullName ?? null,
				venue_city: comp0?.venue?.address?.city ?? null
			});
			continue;
		}

		// Existing fixture: only chase reschedules/venue while it hasn't started —
		// once live/finished the live-sync loop owns the row.
		if (row.status !== 'upcoming' || espnState(e) !== 'pre') {
			skippedLive++;
			continue;
		}
		const newIso = new Date(e.date).toISOString();
		const patch: Record<string, unknown> = {};
		if (new Date(row.match_datetime).toISOString() !== newIso) patch.match_datetime = newIso;
		const venue = comp0?.venue?.fullName ?? null;
		if (venue && venue !== row.venue) patch.venue = venue;
		if (Object.keys(patch).length > 0) {
			const { error } = await supabase.from('matches').update(patch).eq('id', row.id);
			if (!error) updated++;
		}
	}

	for (let i = 0; i < toInsert.length; i += 100) {
		const chunk = toInsert.slice(i, i + 100);
		const { error } = await supabase.from('matches').insert(chunk);
		if (error) return { ok: false, error: `insert (batch ${i / 100}): ${error.message}` };
		inserted += chunk.length;
	}

	return { ok: true, total: events.size, teams: teams.size, inserted, updated, skippedLive };
}
