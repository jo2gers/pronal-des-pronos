import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { safeGetSession }, url }) => {
	const { user } = await safeGetSession();
	const next = url.searchParams.get('next') ?? '/';
	if (user) redirect(303, next);
	return { next };
};

export const actions: Actions = {
	default: async ({ request, locals: { supabase } }) => {
		const form = await request.formData();
		const email = form.get('email') as string;
		const password = form.get('password') as string;
		const next = (form.get('next') as string) || '/';

		const { error } = await supabase.auth.signInWithPassword({ email, password });

		if (error) return fail(400, { error: error.message, next });

		redirect(303, next);
	}
};
