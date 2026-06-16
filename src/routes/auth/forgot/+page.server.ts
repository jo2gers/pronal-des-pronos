import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, url, locals: { supabase } }) => {
		const form = await request.formData();
		const email = ((form.get('email') as string) ?? '').trim();
		if (!email) return fail(400, { error: 'Email requis', email });

		// Route the recovery link through the already-allowlisted OAuth callback,
		// which exchanges the code for a session and forwards to /auth/reset.
		const redirectTo = `${url.origin}/auth/callback?next=${encodeURIComponent('/auth/reset')}`;

		// Never reveal whether an account exists for this email — always confirm.
		// resetPasswordForEmail no-ops silently for unknown addresses by design.
		await supabase.auth.resetPasswordForEmail(email, { redirectTo });

		return { sent: true, email };
	}
};
