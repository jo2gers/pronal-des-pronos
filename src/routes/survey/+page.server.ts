import { redirect, fail } from '@sveltejs/kit';
import { SURVEY_KEY, SURVEY_QUESTIONS } from '$lib/survey';
import type { Actions, PageServerLoad } from './$types';

// The survey is per-account (one response, then it stops being proposed), so
// anonymous visitors go through login first and come straight back.
export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) redirect(302, '/auth/login?next=' + encodeURIComponent('/survey'));

	const { data: existing } = await supabase
		.from('survey_responses')
		.select('user_id')
		.eq('user_id', user.id)
		.maybeSingle();

	return { done: !!existing };
};

export const actions: Actions = {
	submit: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user) return fail(401, { error: 'Non authentifié' });

		const form = await request.formData();
		const answers: Record<string, boolean> = {};
		for (const q of SURVEY_QUESTIONS) {
			const v = form.get(q);
			if (v !== 'yes' && v !== 'no') return fail(400, { error: 'missing' });
			answers[q] = v === 'yes';
		}
		const rawComment = String(form.get('comment') ?? '').trim();
		const comment = rawComment ? rawComment.slice(0, 2000) : null;

		const { error } = await supabase
			.from('survey_responses')
			.insert({ user_id: user.id, survey_key: SURVEY_KEY, answers, comment });

		// 23505 (unique violation) = this account already answered — treat as done
		// rather than an error; the one-shot rule is the point.
		if (error && error.code !== '23505') return fail(500, { error: error.message });
		return { success: true };
	}
};
