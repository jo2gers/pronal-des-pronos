import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) redirect(303, '/auth/login');

	const { data: group } = await supabase
		.from('groups')
		.select('*')
		.eq('id', params.id)
		.single();

	if (!group) error(404, 'Groupe introuvable');

	const [{ data: members }, pronosticsResult] = await Promise.all([
		supabase
			.from('group_members')
			.select('role, joined_at, profiles(id, username, display_name, avatar_url)')
			.eq('group_id', params.id),
		supabase
			.from('pronostics')
			.select('user_id, points_earned')
			.eq('is_scored', true)
	]);

	const memberIds = (members ?? []).map((m) => (m.profiles as any)?.id);
	const isMember = memberIds.includes(user.id);
	if (!isMember) redirect(303, '/groups');

	const myMembership = (members ?? []).find((m) => (m.profiles as any)?.id === user.id);
	const isAdmin = myMembership?.role === 'admin';

	// Scoreboard: aggregate points for members
	const memberPoints = new Map<string, number>();
	for (const id of memberIds) memberPoints.set(id, 0);
	for (const row of pronosticsResult.data ?? []) {
		if (memberPoints.has(row.user_id)) {
			memberPoints.set(row.user_id, (memberPoints.get(row.user_id) ?? 0) + (row.points_earned ?? 0));
		}
	}

	const scoreboard = (members ?? [])
		.map((m) => ({
			profile: m.profiles,
			role: m.role,
			points: memberPoints.get((m.profiles as any)?.id ?? '') ?? 0
		}))
		.sort((a, b) => b.points - a.points);

	return { group, scoreboard, isAdmin, user };
};

export const actions: Actions = {
	leave: async ({ params, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user) return fail(401, { error: 'Non authentifié' });

		await supabase
			.from('group_members')
			.delete()
			.eq('group_id', params.id)
			.eq('user_id', user.id);

		redirect(303, '/groups');
	}
};
