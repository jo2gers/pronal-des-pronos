import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) redirect(303, '/auth/login');

	const [{ data: profile }, { data: firstMatch }] = await Promise.all([
		supabase.from('profiles').select('*').eq('id', user.id).single(),
		supabase
			.from('matches')
			.select('match_datetime')
			.eq('status', 'upcoming')
			.order('match_datetime', { ascending: true })
			.limit(1)
			.maybeSingle()
	]);

	// Lock favorite_team 2 hours before the first match of the competition
	const firstMatchTime = firstMatch?.match_datetime ? new Date(firstMatch.match_datetime) : null;
	const lockCutoff = firstMatchTime ? new Date(firstMatchTime.getTime() - 2 * 60 * 60 * 1000) : null;
	const teamLocked = lockCutoff ? new Date() >= lockCutoff : false;

	return { profile, teamLocked, firstMatchTime: firstMatchTime?.toISOString() ?? null };
};

export const actions: Actions = {
	update: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user) return fail(401, { error: 'Non authentifié' });

		const form = await request.formData();
		const display_name = (form.get('display_name') as string).trim();
		const favorite_team = form.get('favorite_team') as string;
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
		const lockCutoff = firstMatchTime ? new Date(firstMatchTime.getTime() - 2 * 60 * 60 * 1000) : null;
		const teamLocked = lockCutoff ? new Date() >= lockCutoff : false;

		// Get current team to preserve if locked
		const { data: currentProfile } = await supabase
			.from('profiles')
			.select('favorite_team')
			.eq('id', user.id)
			.single();

		const finalTeam = teamLocked ? (currentProfile?.favorite_team ?? null) : (favorite_team || null);

		const { error } = await supabase
			.from('profiles')
			.update({ display_name, favorite_team: finalTeam, country })
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
