import { json } from '@sveltejs/kit';
import { createServerClient } from '@supabase/ssr';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { syncLiveScores } from '$lib/server/syncLiveScores';
import type { RequestHandler } from './$types';

// Vercel Hobby: 10s function timeout. Live-score sync fetches one gamma-api
// event per live match; keep this hint explicit.
export const config = { maxDuration: 10 };

function adminClient() {
	return createServerClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
		cookies: { getAll: () => [], setAll: () => {} }
	});
}

export const GET: RequestHandler = async ({ request }) => {
	// Same auth pattern as fetch-odds: Vercel-cron user-agent or matching secret.
	const cronSecret = process.env.CRON_SECRET;
	if (cronSecret) {
		const auth = request.headers.get('authorization') ?? '';
		const ua = request.headers.get('user-agent') ?? '';
		if (auth !== `Bearer ${cronSecret}` && !ua.includes('vercel-cron')) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}
	}

	const supabase = adminClient();
	// Force-bypass the in-process rate limit for explicit cron invocations.
	const result = await syncLiveScores(supabase, { force: true });
	return json({ ts: new Date().toISOString(), ...result });
};
