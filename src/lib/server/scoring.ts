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
};

export async function scoreMatch(
	supabase: SupabaseClient,
	match: ScorableMatch
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
