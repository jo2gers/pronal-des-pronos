import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) redirect(303, '/auth/login');

	const { data: friendships } = await supabase
		.from('friendships')
		.select(`
			id, status, requester_id, addressee_id,
			requester:profiles!friendships_requester_id_fkey(id, username, display_name, avatar_url),
			addressee:profiles!friendships_addressee_id_fkey(id, username, display_name, avatar_url)
		`)
		.or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

	const accepted = (friendships ?? [])
		.filter((f) => f.status === 'accepted')
		.map((f) => f.requester_id === user.id ? f.addressee : f.requester);

	const pendingReceived = (friendships ?? [])
		.filter((f) => f.status === 'pending' && f.addressee_id === user.id)
		.map((f) => ({ ...f, from: f.requester }));

	const pendingSent = (friendships ?? [])
		.filter((f) => f.status === 'pending' && f.requester_id === user.id);

	return { accepted, pendingReceived, pendingSent, user };
};

export const actions: Actions = {
	search: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user) return fail(401, { error: 'Non authentifié' });

		const form = await request.formData();
		const query = (form.get('query') as string).trim();

		if (!query || query.length < 2) return fail(400, { searchError: 'Minimum 2 caractères', query });

		const { data: results } = await supabase
			.from('profiles')
			.select('id, username, display_name, avatar_url')
			.ilike('username', `%${query}%`)
			.neq('id', user.id)
			.limit(10);

		return { searchResults: results ?? [], query };
	},

	request: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user) return fail(401, { error: 'Non authentifié' });

		const form = await request.formData();
		const addresseeId = form.get('addressee_id') as string;

		const { error } = await supabase
			.from('friendships')
			.insert({ requester_id: user.id, addressee_id: addresseeId, status: 'pending' });

		if (error) return fail(400, { error: error.message });
		return { requestSent: true };
	},

	respond: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user) return fail(401, { error: 'Non authentifié' });

		const form = await request.formData();
		const friendshipId = form.get('friendship_id') as string;
		const action = form.get('action') as 'accepted' | 'declined';

		await supabase
			.from('friendships')
			.update({ status: action })
			.eq('id', friendshipId)
			.eq('addressee_id', user.id);

		return { responded: true };
	}
};
