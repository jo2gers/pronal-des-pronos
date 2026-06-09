import { createServerClient } from '@supabase/ssr';
import { fail, redirect } from '@sveltejs/kit';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY, ADMIN_PASSWORD } from '$env/static/private';
import type { Actions, PageServerLoad } from './$types';

const ADMIN_COOKIE = 'tifo_admin';
// Cookie holds the env password (httpOnly so client JS can't read it).
// Compared against $env/static/private at every request — change the env to
// rotate everyone out.
import {
	syncMatchOdds as runSyncMatchOdds,
	syncWCWinnerOdds as runSyncWCWinnerOdds,
	backfillPolymarketSlugs as runBackfillPolymarketSlugs
} from '$lib/server/sync-odds';
import { scoreMatch } from '$lib/server/scoring';

function adminClient() {
	return createServerClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
		cookies: { getAll: () => [], setAll: () => {} }
	});
}

export const load: PageServerLoad = async ({ locals: { safeGetSession }, cookies }) => {
	const { user } = await safeGetSession();
	if (!user) redirect(303, '/auth/login');

	// Password gate — admin must enter ADMIN_PASSWORD env var.
	// Cookie is httpOnly so even XSS can't steal the password.
	if (cookies.get(ADMIN_COOKIE) !== ADMIN_PASSWORD) {
		return { locked: true as const };
	}

	const supabase = adminClient();

	const [
		{ data: matches }, { data: groups },
		oddsTs, wcTs
	] = await Promise.all([
		supabase
			.from('matches')
			.select('id, home_team, away_team, home_flag, away_flag, stage, group_label, match_datetime, status, home_score, away_score')
			.neq('home_team', 'TBD')
			.order('match_datetime', { ascending: true }),
		supabase
			.from('groups')
			.select('id, name, description, invite_code, is_public, created_at, group_members(count)')
			.order('created_at', { ascending: false }),
		supabase.from('matches')
			.select('odds_updated_at').not('odds_updated_at','is',null)
			.order('odds_updated_at', { ascending: false }).limit(1).maybeSingle(),
		supabase.from('wc_winner_odds')
			.select('updated_at').order('updated_at', { ascending: false }).limit(1).maybeSingle()
	]);

	const groupsWithCount = (groups ?? []).map((g: any) => ({
		id: g.id,
		name: g.name,
		description: g.description,
		invite_code: g.invite_code,
		is_public: g.is_public,
		created_at: g.created_at,
		member_count: g.group_members?.[0]?.count ?? 0
	}));

	return {
		locked: false as const,
		matches: matches ?? [],
		groups: groupsWithCount,
		oddsFreshness: {
			matchOdds: (oddsTs.data as any)?.odds_updated_at ?? null,
			wcWinnerOdds: (wcTs.data as any)?.updated_at ?? null
		}
	};
};

export const actions: Actions = {
	// Password gate — accepts a 'password' form field, sets the cookie if it matches.
	unlock: async ({ request, cookies }) => {
		const form = await request.formData();
		const pw = (form.get('password') as string ?? '').trim();
		if (!pw || pw !== ADMIN_PASSWORD) {
			return fail(401, { wrong: true });
		}
		cookies.set(ADMIN_COOKIE, pw, {
			path: '/admin',
			httpOnly: true,
			sameSite: 'strict',
			secure: true,
			maxAge: 60 * 60 * 24 * 7 // 7 days
		});
		redirect(303, '/admin');
	},

	lock: async ({ cookies }) => {
		cookies.delete(ADMIN_COOKIE, { path: '/admin' });
		redirect(303, '/admin');
	},

	update: async ({ request }) => {
		const supabase = adminClient();
		const form = await request.formData();

		const id = form.get('id') as string;
		const status = form.get('status') as string;
		const home_score = form.get('home_score') !== '' ? parseInt(form.get('home_score') as string) : null;
		const away_score = form.get('away_score') !== '' ? parseInt(form.get('away_score') as string) : null;

		const patch: Record<string, unknown> = { status };
		if (status === 'live' || status === 'finished') {
			patch.home_score = isNaN(home_score as number) ? null : home_score;
			patch.away_score = isNaN(away_score as number) ? null : away_score;
		}
		if (status === 'upcoming') {
			patch.home_score = null;
			patch.away_score = null;
		}

		// Whenever we save a finished match (new or correction), reset the bonus
		// flag so scoreMatch re-evaluates team bonuses against the correct score.
		const isFinishedWithScores =
			status === 'finished' &&
			patch.home_score != null &&
			patch.away_score != null;
		if (isFinishedWithScores) {
			patch.bonus_calculated = false;
		}

		const { error } = await supabase.from('matches').update(patch).eq('id', id);
		if (error) return fail(500, { error: error.message });

		// Auto-score immediately — no separate "Calculer" step needed.
		let scored = 0;
		let bonusAwarded = 0;
		if (isFinishedWithScores) {
			const { data: match } = await supabase
				.from('matches')
				.select('id, home_team, away_team, home_score, away_score, stage, bonus_calculated')
				.eq('id', id)
				.single();
			if (match) {
				const result = await scoreMatch(supabase, match);
				scored = result.scored;
				bonusAwarded = result.bonusAwarded;
				// Non-fatal: sync match odds in case a knockout slot just opened.
				try { await runSyncMatchOdds(supabase); } catch { /* swallow */ }
			}
		}

		return { success: true, scored, bonusAwarded };
	},

	// Score one match directly via the admin client. Bypasses the
	// calculate-scores edge function so the fixes (1.0 floor on odds_used,
	// force-rescore of already-scored rows) land without redeploying the edge
	// function. Team-bonus double-award is guarded server-side via
	// matches.bonus_calculated.
	calculate: async ({ request }) => {
		const form = await request.formData();
		const matchId = form.get('match_id') as string;
		const supabase = adminClient();

		const { data: match, error: matchErr } = await supabase
			.from('matches')
			.select('id, home_team, away_team, home_score, away_score, status, stage, bonus_calculated')
			.eq('id', matchId)
			.single();
		if (matchErr || !match) return fail(400, { error: matchErr?.message ?? 'Match introuvable' });
		if (match.status !== 'finished') {
			return fail(400, { error: `Statut actuel: "${match.status}". Marque le match Terminé et attends que le score soit enregistré.` });
		}
		if (match.home_score == null || match.away_score == null) {
			return fail(400, { error: 'Scores manquants en base. Mets les deux scores puis recalcule.' });
		}

		const { scored } = await scoreMatch(supabase, match);

		// Cascade odds-sync for any knockout slot this match unlocked. Non-fatal.
		try { await runSyncMatchOdds(supabase); } catch { /* swallow */ }

		return { calculated: true, scored };
	},

	// Bulk: re-score every match currently marked as finished. Runs scoreMatch
	// in-process for each — no edge-function dependency.
	//
	// Bonus state is fully reset before recomputing so any previously-awarded
	// (possibly buggy) team bonuses are replaced by a fresh idempotent pass over
	// every finished match. This makes the action the canonical "fix everything"
	// button: pronostic points + team bonuses both end up correct.
	calculateAll: async () => {
		const supabase = adminClient();

		const { data: finished, error: listErr } = await supabase
			.from('matches')
			.select('id, home_team, away_team, home_score, away_score, status, stage, bonus_calculated')
			.eq('status', 'finished');
		if (listErr) return fail(500, { error: listErr.message });

		// Reset all team_bonus_points so the per-match loop below re-awards correct
		// totals from scratch. PostgREST refuses unfiltered UPDATEs, so we fetch
		// the id list and use .in() — explicit but cheap (profile count is small).
		const { data: profileIds } = await supabase.from('profiles').select('id');
		const allProfileIds = (profileIds ?? []).map((r) => r.id);
		if (allProfileIds.length > 0) {
			await supabase
				.from('profiles')
				.update({ team_bonus_points: 0 })
				.in('id', allProfileIds);
		}

		// Clear bonus_calculated on every match that has it set so scoreMatch
		// awards the bonus again. Filtering by `.eq('bonus_calculated', true)`
		// is the predicate PostgREST requires.
		await supabase
			.from('matches')
			.update({ bonus_calculated: false })
			.eq('bonus_calculated', true);

		let totalScored = 0;
		let totalBonusAwarded = 0;
		let errors = 0;
		const list = finished ?? [];

		// Re-read after the reset so the loop sees bonus_calculated=false.
		for (const m of list) {
			try {
				const { scored, bonusAwarded } = await scoreMatch(supabase, { ...m, bonus_calculated: false });
				totalScored += scored;
				totalBonusAwarded += bonusAwarded;
			} catch {
				errors++;
			}
		}

		try { await runSyncMatchOdds(supabase); } catch { /* swallow */ }

		return { matches: list.length, totalScored, errors, bonusAwarded: totalBonusAwarded };
	},

	syncWCWinnerOdds: async () => {
		const r = await runSyncWCWinnerOdds(adminClient());
		if (!r.ok) return fail(500, { error: r.error });
		return { wcOddsSync: true, updated: r.updated, unmatched: r.unmatched };
	},

	syncOdds: async () => {
		const r = await runSyncMatchOdds(adminClient());
		if (!r.ok) return fail(500, { error: r.error });
		return { oddsSync: true, updated: r.updated, unmatched: r.unmatched };
	},

	// One-shot backfill: pull Polymarket event slugs for every WC match and
	// write them onto `matches.polymarket_event_slug`.
	syncPolymarketSlugs: async () => {
		const r = await runBackfillPolymarketSlugs(adminClient());
		if (!r.ok) return fail(500, { error: r.error });
		return { slugSync: true, updated: r.updated, alreadySet: r.alreadySet, unmatched: r.unmatched };
	},

	resolveBracket: async () => {
		const supabase = adminClient();
		const { data, error } = await supabase.rpc('resolve_bracket');
		if (error) return fail(500, { error: error.message });
		const result = data as { inspected: number; updated: number };
		return { bracketResolved: true, inspected: result.inspected, updated: result.updated };
	},

	resetAll: async () => {
		const supabase = adminClient();

		// 1. Delete all pronostics
		const { error: e1 } = await supabase.from('pronostics').delete().not('id', 'is', null);
		if (e1) return fail(500, { error: `Pronostics: ${e1.message}` });

		// 2. Reset all match results
		const { error: e2 } = await supabase.from('matches').update({
			status: 'upcoming',
			home_score: null,
			away_score: null,
			bonus_calculated: false
		}).not('id', 'is', null);
		if (e2) return fail(500, { error: `Matchs: ${e2.message}` });

		// 3. Reset team bonus points
		const { error: e3 } = await supabase.from('profiles').update({
			team_bonus_points: 0
		}).not('id', 'is', null);
		if (e3) return fail(500, { error: `Profils: ${e3.message}` });

		return { reset: true };
	},

	deleteGroup: async ({ request }) => {
		const supabase = adminClient();
		const form = await request.formData();
		const groupId = form.get('group_id') as string;
		if (!groupId) return fail(400, { error: 'ID de ligue requis' });

		await Promise.all([
			supabase.from('group_invites').delete().eq('group_id', groupId),
			supabase.from('group_join_requests').delete().eq('group_id', groupId),
			supabase.from('group_members').delete().eq('group_id', groupId)
		]);

		const { error } = await supabase.from('groups').delete().eq('id', groupId);
		if (error) return fail(500, { error: error.message });

		return { groupDeleted: true, groupId };
	}
};
