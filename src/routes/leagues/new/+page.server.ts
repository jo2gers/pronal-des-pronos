import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) redirect(303, '/auth/login');

	// V2: a league belongs to one active competition — the creator picks which.
	const { data: competitions } = await supabase
		.from('competitions')
		.select('id, slug, name_fr, name_en')
		.eq('active', true)
		.order('starts_at', { ascending: true, nullsFirst: false });

	return { competitions: competitions ?? [] };
};

export const actions: Actions = {
	default: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user) return fail(401, { error: 'Non authentifié' });

		const form = await request.formData();
		const name = ((form.get('name') as string) ?? '').trim();
		const description = ((form.get('description') as string) ?? '').trim();
		const is_public = form.get('is_public') !== 'false';
		const competition_id = ((form.get('competition_id') as string) ?? '').trim();

		if (name.length < 2) return fail(400, { error: 'Le nom est obligatoire (≥ 2 caractères)' });
		if (!competition_id) return fail(400, { error: 'Choisis une compétition' });

		// Atomic SECURITY DEFINER RPC: inserts group + creator admin membership in one tx.
		// Avoids the chicken-and-egg RLS hole where the second insert would fail leaving an orphan.
		const { data: rpcResult, error: rpcErr } = await supabase
			.rpc('create_group', {
				p_name: name,
				p_description: description,
				p_is_public: is_public,
				p_competition_id: competition_id
			});

		if (rpcErr) return fail(500, { error: rpcErr.message });
		const result = rpcResult as { status: string; group_id?: string };
		if (result.status === 'invalid_name') return fail(400, { error: 'Le nom est obligatoire' });
		if (result.status === 'invalid_competition') return fail(400, { error: 'Compétition invalide' });
		if (result.status !== 'created' || !result.group_id) {
			return fail(500, { error: 'Création échouée' });
		}

		redirect(303, `/leagues/${result.group_id}`);
	}
};
