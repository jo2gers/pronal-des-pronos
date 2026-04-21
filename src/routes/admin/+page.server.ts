import { createServerClient } from '@supabase/ssr';
import { fail, redirect } from '@sveltejs/kit';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import type { Actions, PageServerLoad } from './$types';

function adminClient() {
	return createServerClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
		cookies: { getAll: () => [], setAll: () => {} }
	});
}

export const load: PageServerLoad = async ({ locals: { safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) redirect(303, '/auth/login');

	const supabase = adminClient();

	const { data: matches } = await supabase
		.from('matches')
		.select('id, home_team, away_team, home_flag, away_flag, stage, group_label, match_datetime, status, home_score, away_score')
		.neq('home_team', 'TBD')
		.order('match_datetime', { ascending: true });

	return { matches: matches ?? [] };
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

	calculate: async ({ request }) => {
		const form = await request.formData();
		const matchId = form.get('match_id') as string;

		const supabaseUrl = PUBLIC_SUPABASE_URL;

		const res = await fetch(`${supabaseUrl}/functions/v1/calculate-scores`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
			},
			body: JSON.stringify({ match_id: matchId })
		});

		const data = await res.json();
		if (!res.ok) return fail(500, { error: data.error ?? 'Erreur calcul' });

		return { calculated: true, scored: data.scored };
	},

	resetAll: async () => {
		const supabase = adminClient();

		// 1. Delete all pronostics
		const { error: e1 } = await supabase.from('pronostics').delete().neq('id', '');
		if (e1) return fail(500, { error: `Pronostics: ${e1.message}` });

		// 2. Reset all match results
		const { error: e2 } = await supabase.from('matches').update({
			status: 'upcoming',
			home_score: null,
			away_score: null,
			bonus_calculated: false
		}).neq('id', '');
		if (e2) return fail(500, { error: `Matchs: ${e2.message}` });

		// 3. Reset all team bonus points
		const { error: e3 } = await supabase.from('profiles').update({ team_bonus_points: 0 }).neq('id', '');
		if (e3) return fail(500, { error: `Profils: ${e3.message}` });

		return { reset: true };
	}
};
