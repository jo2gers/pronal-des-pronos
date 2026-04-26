import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) redirect(303, '/auth/login');

	const [{ data: profile }, { data: firstMatch }, { data: oddsData }, { data: scorerData }] = await Promise.all([
		supabase.from('profiles').select('*').eq('id', user.id).single(),
		supabase
			.from('matches')
			.select('match_datetime')
			.eq('status', 'upcoming')
			.order('match_datetime', { ascending: true })
			.limit(1)
			.maybeSingle(),
		supabase.from('wc_winner_odds').select('team_name_en, multiplier'),
		supabase.from('wc_top_scorers').select('player_name, odds, multiplier').order('odds', { ascending: true })
	]);

	// Lock favorite_team & top_scorer permanently 2 days before the first WC match
	const firstMatchTime = firstMatch?.match_datetime ? new Date(firstMatch.match_datetime) : null;
	const lockCutoff = firstMatchTime ? new Date(firstMatchTime.getTime() - 2 * 24 * 60 * 60 * 1000) : null;
	const teamLocked = lockCutoff ? new Date() >= lockCutoff : false;
	const scorerLocked = teamLocked;

	const oddsMap = Object.fromEntries(
		(oddsData ?? []).map((o) => [o.team_name_en, parseFloat(String(o.multiplier))])
	);

	const scorers = (scorerData ?? []).map((s) => ({
		player_name: s.player_name as string,
		odds: parseFloat(String(s.odds)),
		multiplier: parseFloat(String(s.multiplier))
	}));

	return { profile, teamLocked, scorerLocked, firstMatchTime: firstMatchTime?.toISOString() ?? null, oddsMap, scorers };
};

export const actions: Actions = {
	update: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user) return fail(401, { error: 'Non authentifié' });

		const form = await request.formData();
		const display_name = (form.get('display_name') as string).trim();
		const favorite_team = form.get('favorite_team') as string;
		const top_scorer = ((form.get('top_scorer') as string) ?? '').trim();
		const country = form.get('country') as string;

		// Check lock status server-side
		const { data: firstMatch } = await supabase
			.from('matches')
			.select('match_datetime')
			.eq('status', 'upcoming')
			.order('match_datetime', { ascending: true })
			.limit(1)
			.maybeSingle();

		const firstMatchTime = firstMatch?.match_datetime ? new Date(firstMatch.match_datetime) : null;
		const lockCutoff = firstMatchTime ? new Date(firstMatchTime.getTime() - 2 * 24 * 60 * 60 * 1000) : null;
		const teamLocked = lockCutoff ? new Date() >= lockCutoff : false;
		const scorerLocked = teamLocked;

		// Get current values to preserve if locked
		const { data: currentProfile } = await supabase
			.from('profiles')
			.select('favorite_team, top_scorer')
			.eq('id', user.id)
			.single();

		const finalTeam = teamLocked ? (currentProfile?.favorite_team ?? null) : (favorite_team || null);
		const finalScorer = scorerLocked
			? (currentProfile?.top_scorer ?? null)
			: (top_scorer || null);

		// Compute initial top_scorer_bonus_points if scorer changed
		const updateData: Record<string, unknown> = {
			display_name,
			favorite_team: finalTeam,
			country,
			top_scorer: finalScorer
		};

		if (finalScorer) {
			const { data: scorerRow } = await supabase
				.from('wc_top_scorers')
				.select('multiplier, goals_scored')
				.eq('player_name', finalScorer)
				.maybeSingle();
			if (scorerRow) {
				const m = parseFloat(String(scorerRow.multiplier ?? 0));
				const g = parseInt(String(scorerRow.goals_scored ?? 0));
				updateData.top_scorer_bonus_points = parseFloat((m * g).toFixed(2));
			}
		} else {
			updateData.top_scorer_bonus_points = 0;
		}

		const { error } = await supabase
			.from('profiles')
			.update(updateData)
			.eq('id', user.id);

		if (error) return fail(500, { error: error.message });
		return { success: true };
	},

	avatar: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user) return fail(401, { error: 'Non authentifié' });

		const form = await request.formData();
		const file = form.get('avatar') as File;

		if (!file || file.size === 0) return fail(400, { error: 'Aucun fichier sélectionné' });
		if (file.size > 2 * 1024 * 1024) return fail(400, { error: 'Fichier trop grand (max 2MB)' });

		const ext = file.name.split('.').pop();
		const path = `${user.id}/avatar.${ext}`;

		const { error: uploadError } = await supabase.storage
			.from('avatars')
			.upload(path, file, { upsert: true });

		if (uploadError) return fail(500, { error: uploadError.message });

		const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);

		await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);

		return { success: true };
	}
};
