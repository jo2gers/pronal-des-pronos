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

export const STAGE_BONUS: Record<string, number> = {
	group:       1,
	round_of_32: 2,
	round_of_16: 3,
	quarters:    5,
	semis:       8,
	final:       13,
	third:       3
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
	match: ScorableMatch
): Promise<{ scored: number; bonusAwarded: number }> {
	if (match.home_score == null || match.away_score == null) return { scored: 0, bonusAwarded: 0 };

	// Everyone is scored against the SAME odds: the match odds frozen 5 min
	// before kickoff (the odds-sync lock), NOT the odds at pick time. Fetch
	// them from the match row if the caller didn't pass them along.
	let { odds_home, odds_draw, odds_away } = match;
	if (odds_home === undefined) {
		const { data: oddsRow } = await supabase
			.from('matches')
			.select('odds_home, odds_draw, odds_away')
			.eq('id', match.id)
			.single();
		odds_home = oddsRow?.odds_home ?? null;
		odds_draw = oddsRow?.odds_draw ?? null;
		odds_away = oddsRow?.odds_away ?? null;
	}
	const oddsSource = { odds_home, odds_draw, odds_away };

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
		const basePoints =
			ph === mh && pa === ma ? 3 :
			Math.sign(ph - pa) === Math.sign(mh - ma) ? 1 :
			0;

		// resolveOddsUsed picks home/draw/away odds for the predicted outcome,
		// with a 1.0 floor when odds are missing. odds_used is overwritten with the
		// final locked odds so every surface shows the value points came from.
		const finalOdds = resolveOddsUsed(ph, pa, oddsSource);
		const points = basePoints === 0 ? 0 : parseFloat((basePoints * finalOdds).toFixed(2));

		return supabase
			.from('pronostics')
			.update({ points_earned: points, is_scored: true, odds_used: finalOdds })
			.eq('id', p.id);
	});
	const results = await Promise.all(writes);
	const scored = results.filter((r) => !r.error).length;

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
