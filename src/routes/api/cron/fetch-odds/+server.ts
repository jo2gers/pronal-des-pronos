import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { syncCompetitionOdds } from '$lib/server/sync-odds';
import { syncKickoffTimes } from '$lib/server/syncLiveScores';
import type { RequestHandler } from './$types';

// Vercel Hobby plan: 10s function timeout. Keep this hint explicit so future
// changes don't accidentally rely on long-running work.
export const config = { maxDuration: 10 };

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

// V2 daily cron: per-competition odds + Polymarket slugs (every active
// competition with a polymarket_series_id — PL now, UCL once its 2026-27
// series exists and the id is set on the competitions row), kickoff
// reconciliation for the coming week, and bracket resolution (no-op until the
// UCL knockout). The WC-era single-series sync lives on in git history; the
// archive competition is inactive so it is simply never synced again.
export const GET: RequestHandler = async ({ request }) => {
	const cronSecret = process.env.CRON_SECRET;
	if (cronSecret) {
		const auth = request.headers.get('authorization') ?? '';
		const ua = request.headers.get('user-agent') ?? '';
		if (auth !== `Bearer ${cronSecret}` && !ua.includes('vercel-cron')) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}
	}

	if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
		return json({ error: 'Missing Supabase env' }, { status: 500 });
	}

	const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

	const { data: bracketResolved, error: bracketErr } = await supabase.rpc('resolve_bracket');

	const [competitions, kickoffsRescheduled] = await Promise.all([
		syncCompetitionOdds(supabase),
		syncKickoffTimes(supabase, 7 * 24 * 60 * 60 * 1000).catch(() => 0)
	]);

	return json({
		ts: new Date().toISOString(),
		bracket: bracketErr ? { ok: false, error: bracketErr.message } : { ok: true, ...(bracketResolved as object) },
		competitions,
		kickoffsRescheduled
	});
};
