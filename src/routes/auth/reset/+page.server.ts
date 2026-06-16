import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

// The user lands here after clicking the recovery link → /auth/callback exchanged
// the code for a (recovery) session and forwarded here, so they're authenticated.
export const load: PageServerLoad = async ({ locals: { safeGetSession } }) => {
	const { user } = await safeGetSession();
	return { authed: !!user };
};

export const actions: Actions = {
	update: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		// No valid recovery session → the link was invalid/expired or never followed.
		if (!user) return fail(401, { error: 'invalid' });

		const form = await request.formData();
		const password = (form.get('password') as string) ?? '';
		const confirm = (form.get('confirm') as string) ?? '';

		if (password.length < 6) return fail(400, { error: 'too_short' });
		if (password !== confirm) return fail(400, { error: 'mismatch' });

		const { error } = await supabase.auth.updateUser({ password });
		if (error) return fail(500, { error: error.message });

		// Password set — the recovery session is now a normal one. Drop them home.
		redirect(303, '/');
	}
};
