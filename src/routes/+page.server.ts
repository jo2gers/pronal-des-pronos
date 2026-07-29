import { resolveCurrentComp } from '$lib/server/currentComp';
import type { PageServerLoad } from './$types';

const MATCH_COLS =
	'id, home_team, away_team, match_datetime, status, home_score, away_score, odds_home, odds_draw, odds_away, matchday, stage';

// The home is the HALL of the game you're in: a banner naming the current
// competition, YOUR dashboard (points / rank / last week), and the CURRENT
// matchweek's fixtures — pickable inline. A switch pill changes games. Scoped
// to the current game; the finished WC lives on at /leaderboard, /matches.
export const load: PageServerLoad = async ({ url, cookies, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	const { current, active } = await resolveCurrentComp(supabase, cookies, url.searchParams.get('comp'));

	if (!current) {
		return {
			user, current: null, active,
			matchCount: 0, startsAt: null as string | null, myTeam: null as string | null,
			currentMatchday: null as number | null,
			matches: [] as any[],
			teamMap: {} as Record<string, { short: string | null; logo: string | null }>,
			pronosticsMap: {} as Record<string, { predicted_home: number; predicted_away: number }>,
			stats: null as { totalPoints: number; weekPoints: number; rank: number | null } | null
		};
	}

	const [{ data: firstMd }, { data: lastMd }, { data: nextUnplayed }, { count: matchCount }, { data: teams }, favRes] =
		await Promise.all([
			supabase.from('matches').select('matchday').eq('competition_id', current.id).not('matchday', 'is', null).order('matchday', { ascending: true }).limit(1).maybeSingle(),
			supabase.from('matches').select('matchday').eq('competition_id', current.id).not('matchday', 'is', null).order('matchday', { ascending: false }).limit(1).maybeSingle(),
			supabase.from('matches').select('matchday').eq('competition_id', current.id).not('matchday', 'is', null).neq('status', 'finished').order('match_datetime', { ascending: true }).limit(1).maybeSingle(),
			supabase.from('matches').select('id', { count: 'exact', head: true }).eq('competition_id', current.id),
			supabase.from('competition_teams').select('name_en, short_name, logo_url').eq('competition_id', current.id),
			user
				? supabase.from('favorite_teams').select('team, bonus_points').eq('competition_id', current.id).eq('user_id', user.id).maybeSingle()
				: Promise.resolve({ data: null })
		]);

	const minMatchday = (firstMd?.matchday as number | null) ?? null;
	const maxMatchday = (lastMd?.matchday as number | null) ?? null;
	const hasMatchdays = minMatchday != null && maxMatchday != null;
	const currentMatchday = hasMatchdays ? ((nextUnplayed?.matchday as number | null) ?? maxMatchday) : null;

	const teamMap: Record<string, { short: string | null; logo: string | null }> = {};
	for (const t of teams ?? []) teamMap[t.name_en] = { short: t.short_name, logo: t.logo_url };
	const myTeam = (favRes.data as any)?.team ?? null;

	// The current matchweek's fixtures (or, for a no-matchday comp like UCL before
	// its draw, the next few upcoming).
	let matches: any[] = [];
	if (currentMatchday != null) {
		const { data } = await supabase.from('matches').select(MATCH_COLS).eq('competition_id', current.id).eq('matchday', currentMatchday).order('match_datetime', { ascending: true });
		matches = data ?? [];
	} else {
		const { data } = await supabase.from('matches').select(MATCH_COLS).eq('competition_id', current.id).eq('status', 'upcoming').order('match_datetime', { ascending: true }).limit(10);
		matches = data ?? [];
	}

	let pronosticsMap: Record<string, { predicted_home: number; predicted_away: number }> = {};
	if (user && matches.length > 0) {
		const ids = matches.map((m) => m.id);
		const { data: pronos } = await supabase.from('pronostics').select('match_id, predicted_home, predicted_away').eq('user_id', user.id).in('match_id', ids);
		for (const p of pronos ?? []) pronosticsMap[p.match_id] = { predicted_home: p.predicted_home, predicted_away: p.predicted_away };
	}

	// Dashboard: total points, rank in the competition, last-7-days points — all
	// scoped to the current game.
	let stats: { totalPoints: number; weekPoints: number; rank: number | null } | null = null;
	if (user) {
		const sevenDaysAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
		const nowIso = new Date().toISOString();
		const [{ data: allStats }, { data: allBonus }, { data: recent }] = await Promise.all([
			supabase.from('competition_pronostic_stats').select('user_id, prono_points').eq('competition_id', current.id),
			supabase.from('favorite_teams').select('user_id, bonus_points').eq('competition_id', current.id),
			supabase.from('matches').select('id').eq('competition_id', current.id).gte('match_datetime', sevenDaysAgo).lte('match_datetime', nowIso)
		]);

		const totals = new Map<string, number>();
		for (const s of allStats ?? []) totals.set(s.user_id, (totals.get(s.user_id) ?? 0) + parseFloat(String((s as any).prono_points ?? 0)));
		for (const b of allBonus ?? []) totals.set(b.user_id, (totals.get(b.user_id) ?? 0) + parseFloat(String((b as any).bonus_points ?? 0)));
		const myTotal = totals.get(user.id) ?? 0;
		const anyPoints = [...totals.values()].some((v) => v > 0);
		const rank = anyPoints ? 1 + [...totals.values()].filter((v) => v > myTotal).length : null;

		let weekPoints = 0;
		const recentIds = (recent ?? []).map((m) => m.id);
		if (recentIds.length > 0) {
			const { data: wp } = await supabase.from('pronostics').select('points_earned').eq('user_id', user.id).eq('is_scored', true).in('match_id', recentIds);
			weekPoints = (wp ?? []).reduce((s, p) => s + (p.points_earned ?? 0), 0);
		}

		stats = { totalPoints: parseFloat(myTotal.toFixed(2)), weekPoints: parseFloat(weekPoints.toFixed(2)), rank };
	}

	return {
		user, current, active,
		matchCount: matchCount ?? 0,
		startsAt: current.starts_at,
		myTeam,
		currentMatchday,
		matches,
		teamMap,
		pronosticsMap,
		stats
	};
};
