/**
 * Scoring logic shared between the admin "Calculate" actions and the live-
 * score auto-sync. Re-scores every pronostic on a match, then idempotently
 * awards the team-bonus to fans of the winning team (gated by the per-match
 * `bonus_calculated` flag so re-runs don't double-award).
 *
 * Used to live inside admin/+page.server.ts as a private helper; lifted here
 * so syncLiveScores can call it the moment a match transitions to ended.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveOddsUsed } from '$lib/utils';

// SINGLE SOURCE OF TRUTH for the per-win team bonus. MUST match the published
// table on the rules page (src/routes/rules/+page.svelte) — that's the contract
// players signed up on. An older Fibonacci scale (…R16 3, QF 5, SF 8, final 13)
// lived here and under-paid every knockout win vs the rules (QF paid 5× instead
// of 8× — Spain fans got 9 pts for a ×1.8 quarter-final instead of 14.4).
export const STAGE_BONUS: Record<string, number> = {
	group:       1,
	round_of_32: 2,
	round_of_16: 4,
	quarters:    8,
	semis:       13,
	third:       5,
	final:       21
};

export type ScorableMatch = {
	id: string;
	home_team: string;
	away_team: string;
	home_score: number | null;
	away_score: number | null;
	stage: string;
	bonus_calculated: boolean;
	odds_home?: number | null;
	odds_draw?: number | null;
	odds_away?: number | null;
};

export async function scoreMatch(
	supabase: SupabaseClient,
	match: ScorableMatch,
	// skipBonus: grade the pronostics only, leaving the team bonus AND its
	// bonus_calculated gate untouched. Used when grading EARLY at the end of
	// regulation (knockout draw heading to extra time): the 90-min score the
	// picks are graded on is final, but who advances isn't — awarding (or
	// null-ing) the bonus now would burn the gate before the real winner exists.
	opts: { skipBonus?: boolean } = {}
): Promise<{ scored: number; bonusAwarded: number }> {
	if (match.home_score == null || match.away_score == null) return { scored: 0, bonusAwarded: 0 };

	// Everyone is scored against the SAME odds: the match odds frozen 5 min
	// before kickoff (the odds-sync lock), NOT the odds at pick time. Fetch
	// them from the match row if the caller didn't pass them along. The V2
	// scoreline matrix (frozen at lock too) is always read fresh — callers
	// never carry it.
	let { odds_home, odds_draw, odds_away } = match;
	const { data: matchRow } = await supabase
		.from('matches')
		.select('odds_home, odds_draw, odds_away, scoreline_multipliers')
		.eq('id', match.id)
		.single();
	if (odds_home === undefined) {
		odds_home = matchRow?.odds_home ?? null;
		odds_draw = matchRow?.odds_draw ?? null;
		odds_away = matchRow?.odds_away ?? null;
	}
	const oddsSource = { odds_home, odds_draw, odds_away };
	const scorelineMults = (matchRow?.scoreline_multipliers ?? null) as Record<string, number> | null;

	// 1. Per-pronostic points
	const { data: pronostics } = await supabase
		.from('pronostics')
		.select('id, predicted_home, predicted_away')
		.eq('match_id', match.id);

	// Compute each pronostic's points, then write them CONCURRENTLY. This was a
	// sequential await-per-row loop; on a big match it could be cut off by the
	// cron function's time limit partway, leaving some picks is_scored=false with
	// no retry. Firing the writes together keeps the whole pass short, and the
	// finished-match re-score safety pass in syncLiveScores backstops any that
	// still slip through (re-scoring is idempotent).
	const mh = match.home_score;
	const ma = match.away_score;
	const writes = (pronostics ?? []).map((p) => {
		const ph = p.predicted_home;
		const pa = p.predicted_away;
		const exact = ph === mh && pa === ma;
		const winner = exact || Math.sign(ph - pa) === Math.sign(mh - ma);

		// resolveOddsUsed picks home/draw/away odds for the predicted outcome,
		// with a 1.0 floor when odds are missing. odds_used is overwritten with the
		// final locked odds so every surface shows the value points came from.
		const finalOdds = resolveOddsUsed(ph, pa, oddsSource);

		// Exact-score payout:
		//  - V2 (scoreline matrix frozen at lock): ADDITIVE — winner points plus
		//    the scoreline's own multiplier ln(1/P) (see docs/v2-next-season.md:
		//    P(score) already prices the outcome, so it must not multiply the
		//    outcome odds again; additive also guarantees exact > winner-only).
		//  - Legacy (WC archive, or matrix missing): flat 3 × outcome odds.
		let points = 0;
		let exactMult: number | null = null;
		if (exact) {
			exactMult = scorelineMults?.[`${mh}-${ma}`] ?? null;
			points = exactMult != null
				? parseFloat((1 * finalOdds + exactMult).toFixed(2))
				: parseFloat((3 * finalOdds).toFixed(2));
		} else if (winner) {
			points = parseFloat((1 * finalOdds).toFixed(2));
		}

		return supabase
			.from('pronostics')
			.update({ points_earned: points, is_scored: true, odds_used: finalOdds, exact_multiplier: exactMult })
			.eq('id', p.id);
	});
	const results = await Promise.all(writes);
	const scored = results.filter((r) => !r.error).length;

	// 2. Team bonus — only if not already calculated for this match
	let bonusAwarded = 0;
	if (!opts.skipBonus && !match.bonus_calculated) {
		const stageBonus = STAGE_BONUS[match.stage] ?? 0;
		// The team bonus follows who ADVANCED — penalties > extra time > 90-min —
		// even though predictions above are graded on the 90-min score. (Read the
		// deciding columns fresh; this runs at most once per match.)
		const { data: dec } = await supabase
			.from('matches')
			.select('ft_home_score, ft_away_score, pen_home, pen_away')
			.eq('id', match.id)
			.single();
		const effHome = (dec?.pen_home ?? dec?.ft_home_score ?? match.home_score) as number;
		const effAway = (dec?.pen_away ?? dec?.ft_away_score ?? match.away_score) as number;
		let winnerTeamEn: string | null = null;
		if (effHome > effAway) winnerTeamEn = match.home_team;
		else if (effAway > effHome) winnerTeamEn = match.away_team;

		if (winnerTeamEn && stageBonus > 0) {
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

		// A KNOCKOUT match can't truly end level: an effective draw here means the
		// result isn't final yet (shootout / extra time pending, or a stale score
		// at the FT transition). Leave bonus_calculated=false so the NEXT run —
		// once the real result lands — awards the bonus, instead of locking the
		// winner's fans out. (This is the bug that under-credited France/Argentina/…
		// and over-credited Morocco.) A GROUP draw is legitimate — no winner, no
		// bonus — and is marked done.
		const knockoutDrawPending = effHome === effAway && match.stage !== 'group';
		if (!knockoutDrawPending) {
			await supabase.from('matches').update({ bonus_calculated: true }).eq('id', match.id);
		}
	}

	return { scored, bonusAwarded };
}
