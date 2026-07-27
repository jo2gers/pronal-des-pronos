import { redirect, fail } from '@sveltejs/kit';
import { STAGE_BONUS } from '$lib/server/scoring';
import type { Actions, PageServerLoad } from './$types';

// Favourite club per competition — pickable (and changeable) until the season
// starts; from then on the pick is frozen and earns the per-win bonus
// (multiplier × stage value, accrued on favorite_teams.bonus_points).
export const load: PageServerLoad = async ({ params, parent, locals: { supabase, safeGetSession } }) => {
	const { competition } = await parent();
	const { user } = await safeGetSession();
	if (!user) redirect(302, '/auth/login?next=' + encodeURIComponent(`/${params.comp}/team`));

	const [{ data: teams }, { data: odds }, { data: mine }] = await Promise.all([
		supabase
			.from('competition_teams')
			.select('name_en, short_name, logo_url')
			.eq('competition_id', competition.id)
			.order('name_en'),
		supabase
			.from('competition_winner_odds')
			.select('team_name_en, multiplier')
			.eq('competition_id', competition.id),
		supabase
			.from('favorite_teams')
			.select('team, bonus_points')
			.eq('competition_id', competition.id)
			.eq('user_id', user.id)
			.maybeSingle()
	]);

	// The badge shows the REAL points a win pays, not the raw title-odds
	// multiplier: per-win = STAGE_BONUS.league × multiplier (league coefficient is
	// 0.5, so an Arsenal ×1.0 pays 0.5/win, a Newcastle ×5.2 pays ~2.6/win).
	// Single-sourced from scoring.ts so the advertised rate can never drift from
	// what actually accrues.
	const leagueCoef = STAGE_BONUS.league ?? 1;
	const perWinByTeam: Record<string, number> = {};
	for (const o of odds ?? []) {
		const mult = parseFloat(String(o.multiplier));
		perWinByTeam[o.team_name_en] = Math.round(mult * leagueCoef * 10) / 10;
	}

	const locked = !!competition.starts_at && Date.now() >= new Date(competition.starts_at).getTime();

	return {
		teams: teams ?? [],
		perWinByTeam,
		myTeam: mine?.team ?? null,
		myBonus: mine ? parseFloat(String(mine.bonus_points ?? 0)) : 0,
		locked,
		startsAt: competition.starts_at
	};
};

export const actions: Actions = {
	pick: async ({ params, request, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user) return fail(401, { error: 'Non authentifié' });

		const { data: competition } = await supabase
			.from('competitions')
			.select('id, starts_at')
			.eq('slug', params.comp)
			.maybeSingle();
		if (!competition) return fail(404, { error: 'Compétition inconnue' });
		if (competition.starts_at && Date.now() >= new Date(competition.starts_at).getTime())
			return fail(400, { error: 'La saison a commencé — équipe verrouillée' });

		const team = String((await request.formData()).get('team') ?? '');
		const { data: valid } = await supabase
			.from('competition_teams')
			.select('name_en')
			.eq('competition_id', competition.id)
			.eq('name_en', team)
			.maybeSingle();
		if (!valid) return fail(400, { error: 'Équipe invalide' });

		const { error } = await supabase
			.from('favorite_teams')
			.upsert(
				{ user_id: user.id, competition_id: competition.id, team },
				{ onConflict: 'user_id,competition_id' }
			);
		if (error) return fail(500, { error: error.message });
		return { success: true };
	}
};
