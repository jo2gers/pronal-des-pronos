import type { PageServerLoad } from './$types';

type Standing = {
	group_label: string;
	pos: number;
	team: string;
	flag: string | null;
	played: number;
	won: number;
	drawn: number;
	lost: number;
	gf: number;
	ga: number;
	gd: number;
	pts: number;
};

type Match = {
	id: string;
	group_label: string | null;
	home_team: string;
	away_team: string;
	home_flag: string | null;
	away_flag: string | null;
	home_score: number | null;
	away_score: number | null;
	status: string;
	match_datetime: string;
};

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	const [standingsRes, matchesRes] = await Promise.all([
		supabase.rpc('compute_group_standings'),
		supabase
			.from('matches')
			.select('id, group_label, home_team, away_team, home_flag, away_flag, home_score, away_score, status, match_datetime')
			.eq('stage', 'group')
			.order('match_datetime', { ascending: true })
	]);

	const standings = (standingsRes.data ?? []) as Standing[];
	const matches = (matchesRes.data ?? []) as Match[];

	const labels = Array.from(new Set(standings.map((s) => s.group_label))).sort();

	const groups = labels.map((label) => {
		const rows = standings
			.filter((s) => s.group_label === label)
			.sort((a, b) => a.pos - b.pos);
		const groupMatches = matches.filter((m) => m.group_label === label);
		const played = groupMatches.filter((m) => m.status === 'finished').length;
		return { label, rows, matches: groupMatches, played, total: groupMatches.length };
	});

	return { groups };
};
