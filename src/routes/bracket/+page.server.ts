import { effectiveStatus } from '$lib/utils';
import { KNOCKOUT_ROUNDS } from '$lib/bracketMap';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();

	const { data: rows } = await supabase
		.from('matches')
		.select(
			'id, slot_code, stage, home_team, away_team, home_flag, away_flag, home_source, away_source, match_datetime, status, home_score, away_score, ft_home_score, ft_away_score, pen_home, pen_away'
		)
		.in('stage', KNOCKOUT_ROUNDS as unknown as string[]);

	const slotNum = (s: string) => {
		const m = (s ?? '').match(/\d+/);
		return m ? parseInt(m[0], 10) : 0;
	};

	const all = (rows ?? []).map((m) => ({ ...m, status: effectiveStatus(m as any) }));

	const rounds = KNOCKOUT_ROUNDS.map((stage) => ({
		stage,
		matches: all
			.filter((m) => m.stage === stage)
			.sort((a, b) => slotNum(a.slot_code) - slotNum(b.slot_code))
	}));

	// Open on the earliest round that still has an undecided/in-progress match.
	const defaultRound =
		rounds.find((r) => r.matches.some((m) => m.status !== 'finished'))?.stage ?? 'round_of_32';

	const decided = all.filter((m) => m.home_team !== 'TBD' && m.away_team !== 'TBD').length;

	return { rounds, defaultRound, decided, total: all.length, user };
};
