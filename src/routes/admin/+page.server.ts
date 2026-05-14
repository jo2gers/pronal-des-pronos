import { createServerClient } from '@supabase/ssr';
import { fail, redirect } from '@sveltejs/kit';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import type { Actions, PageServerLoad } from './$types';
import {
	syncMatchOdds as runSyncMatchOdds,
	syncWCWinnerOdds as runSyncWCWinnerOdds,
	syncTopScorerOdds as runSyncTopScorerOdds
} from '$lib/server/sync-odds';

function adminClient() {
	return createServerClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
		cookies: { getAll: () => [], setAll: () => {} }
	});
}

// Base bonus points per stage win, mirrors the calculate-scores edge function.
const STAGE_BONUS: Record<string, number> = {
	group:       1,
	round_of_32: 2,
	round_of_16: 3,
	quarters:    5,
	semis:       8,
	final:       13,
	third:       3
};

// Re-score every pronostic on a match + (idempotently) award the team bonus.
// Replicates the calculate-scores edge function with the 1.0 floor on odds_used,
// so the admin doesn't need to redeploy the edge function for the fix to land.
async function scoreMatch(
	supabase: ReturnType<typeof adminClient>,
	match: {
		id: string;
		home_team: string;
		away_team: string;
		home_score: number | null;
		away_score: number | null;
		stage: string;
		bonus_calculated: boolean;
	}
): Promise<{ scored: number; bonusAwarded: number }> {
	if (match.home_score == null || match.away_score == null) return { scored: 0, bonusAwarded: 0 };

	// 1. Per-pronostic points
	const { data: pronostics } = await supabase
		.from('pronostics')
		.select('id, predicted_home, predicted_away, odds_used')
		.eq('match_id', match.id);

	let scored = 0;
	for (const p of pronostics ?? []) {
		const ph = p.predicted_home;
		const pa = p.predicted_away;
		const mh = match.home_score;
		const ma = match.away_score;
		const basePoints =
			ph === mh && pa === ma ? 3 :
			Math.sign(ph - pa) === Math.sign(mh - ma) ? 1 :
			0;

		const odds = typeof p.odds_used === 'number' ? p.odds_used : Number(p.odds_used);
		const safeOdds = Number.isFinite(odds) && odds >= 1 ? odds : 1.0;
		const points = basePoints === 0 ? 0 : parseFloat((basePoints * safeOdds).toFixed(2));

		await supabase
			.from('pronostics')
			.update({ points_earned: points, is_scored: true })
			.eq('id', p.id);
		scored++;
	}

	// 2. Team bonus — only if not already calculated for this match
	let bonusAwarded = 0;
	if (!match.bonus_calculated) {
		const stageBonus = STAGE_BONUS[match.stage] ?? 0;
		if (stageBonus > 0) {
			let winnerTeamEn: string | null = null;
			if (match.home_score > match.away_score) winnerTeamEn = match.home_team;
			else if (match.away_score > match.home_score) winnerTeamEn = match.away_team;

			if (winnerTeamEn) {
				const { data: oddsRow } = await supabase
					.from('wc_winner_odds')
					.select('multiplier')
					.eq('team_name_en', winnerTeamEn)
					.maybeSingle();

				const multiplier = parseFloat(String(oddsRow?.multiplier ?? 1.0));
				const bonusToAward = parseFloat((multiplier * stageBonus).toFixed(2));

				const { data: supporters } = await supabase
					.from('profiles')
					.select('id, team_bonus_points')
					.eq('favorite_team', winnerTeamEn);

				for (const profile of supporters ?? []) {
					await supabase
						.from('profiles')
						.update({
							team_bonus_points: parseFloat(((profile.team_bonus_points ?? 0) + bonusToAward).toFixed(2))
						})
						.eq('id', profile.id);
					bonusAwarded++;
				}
			}
		}
		await supabase.from('matches').update({ bonus_calculated: true }).eq('id', match.id);
	}

	return { scored, bonusAwarded };
}

export const load: PageServerLoad = async ({ locals: { safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) redirect(303, '/auth/login');

	const supabase = adminClient();

	const [
		{ data: matches }, { data: scorers }, { data: groups },
		oddsTs, wcTs, scorerTs
	] = await Promise.all([
		supabase
			.from('matches')
			.select('id, home_team, away_team, home_flag, away_flag, stage, group_label, match_datetime, status, home_score, away_score')
			.neq('home_team', 'TBD')
			.order('match_datetime', { ascending: true }),
		supabase
			.from('wc_top_scorers')
			.select('player_name, team, odds, multiplier, goals_scored')
			.order('goals_scored', { ascending: false }),
		supabase
			.from('groups')
			.select('id, name, description, invite_code, is_public, created_at, group_members(count)')
			.order('created_at', { ascending: false }),
		supabase.from('matches')
			.select('odds_updated_at').not('odds_updated_at','is',null)
			.order('odds_updated_at', { ascending: false }).limit(1).maybeSingle(),
		supabase.from('wc_winner_odds')
			.select('updated_at').order('updated_at', { ascending: false }).limit(1).maybeSingle(),
		supabase.from('wc_top_scorers')
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
		matches: matches ?? [],
		scorers: scorers ?? [],
		groups: groupsWithCount,
		oddsFreshness: {
			matchOdds: (oddsTs.data as any)?.odds_updated_at ?? null,
			wcWinnerOdds: (wcTs.data as any)?.updated_at ?? null,
			topScorerOdds: (scorerTs.data as any)?.updated_at ?? null
		}
	};
};

export const actions: Actions = {
	update: async ({ request }) => {
		const supabase = adminClient();
		const form = await request.formData();

		const id = form.get('id') as string;
		const status = form.get('status') as string;
		const home_score = form.get('home_score') !== '' ? parseInt(form.get('home_score') as string) : null;
		const away_score = form.get('away_score') !== '' ? parseInt(form.get('away_score') as string) : null;

		const update: Record<string, unknown> = { status };
		if (status === 'live' || status === 'finished') {
			update.home_score = isNaN(home_score as number) ? null : home_score;
			update.away_score = isNaN(away_score as number) ? null : away_score;
		}
		if (status === 'upcoming') {
			update.home_score = null;
			update.away_score = null;
		}

		const { error } = await supabase.from('matches').update(update).eq('id', id);
		if (error) return fail(500, { error: error.message });

		return { success: true };
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

	syncTopScorerOdds: async () => {
		const r = await runSyncTopScorerOdds(adminClient());
		if (!r.ok) return fail(500, { error: r.error });
		return { topScorerSync: true, updated: r.updated, skipped: r.skipped };
	},

	updateScorerGoals: async ({ request }) => {
		const supabase = adminClient();
		const form = await request.formData();
		const playerName = form.get('player_name') as string;
		const goals = parseInt(form.get('goals_scored') as string);

		if (!playerName || isNaN(goals) || goals < 0) {
			return fail(400, { error: 'Données invalides' });
		}

		const { error } = await supabase
			.from('wc_top_scorers')
			.update({ goals_scored: goals, updated_at: new Date().toISOString() })
			.eq('player_name', playerName);

		if (error) return fail(500, { error: error.message });

		// Recompute top_scorer_bonus_points for every profile that picked this player
		const { data: scorerRow } = await supabase
			.from('wc_top_scorers')
			.select('multiplier')
			.eq('player_name', playerName)
			.single();

		const multiplier = parseFloat(String(scorerRow?.multiplier ?? 0));
		const bonus = parseFloat((multiplier * goals).toFixed(2));

		await supabase
			.from('profiles')
			.update({ top_scorer_bonus_points: bonus })
			.eq('top_scorer', playerName);

		return { goalsUpdated: true, player: playerName, goals, bonus };
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

		// 3. Reset all team bonus points + top scorer bonus points
		const { error: e3 } = await supabase.from('profiles').update({
			team_bonus_points: 0,
			top_scorer_bonus_points: 0
		}).not('id', 'is', null);
		if (e3) return fail(500, { error: `Profils: ${e3.message}` });

		// 4. Reset goals scored for top scorers
		await supabase.from('wc_top_scorers').update({ goals_scored: 0 }).gt('goals_scored', 0);

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
