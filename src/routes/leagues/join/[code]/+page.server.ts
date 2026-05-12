import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) redirect(303, `/auth/login?next=/leagues/join/${encodeURIComponent(params.code)}`);

	// Single atomic RPC handles all cases (invalid / already-member / public-join /
	// pending-created / pending-existing). Bypasses RLS via SECURITY DEFINER.
	const code = params.code.trim().toLowerCase();
	const { data: rpcResult } = await supabase
		.rpc('join_group_by_code', { code_input: code });

	const result = rpcResult as {
		status: 'joined' | 'already_member' | 'pending_created' | 'pending_existing' | 'invalid_code' | 'unauthenticated';
		group_id?: string;
		group_name?: string;
	} | null;

	if (!result || result.status === 'invalid_code') error(404, "Code d'invitation invalide");
	if (result.status === 'joined' || result.status === 'already_member') {
		redirect(303, `/leagues/${result.group_id}`);
	}
	// pending_created or pending_existing → both private; nudge to /leagues
	redirect(303, `/leagues?requested=${encodeURIComponent(result.group_name ?? '')}`);
};
