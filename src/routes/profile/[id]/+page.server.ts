import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();

	const { data: profile } = await supabase
		.from('profiles')
		.select('id, username, display_name, avatar_url, favorite_team, country, team_bonus_points')
		.eq('id', params.id)
		.single();

	if (!profile) error(404, 'Profil introuvable');

	// Fetch ALL pronostics (scored ones for history, + count of unscored ones)
	const { data: pronostics } = await supabase
		.from('pronostics')
		.select(`
			id, predicted_home, predicted_away, points_earned, is_scored,
			match:matches(id, home_team, away_team, home_flag, away_flag, home_score, away_score, match_datetime, stage, status)
		`)
		.eq('user_id', params.id);

	const scored    = (pronostics ?? []).filter((p) => p.is_scored).sort((a, b) => {
		const dateA = new Date((a.match as any)?.match_datetime ?? 0).getTime();
		const dateB = new Date((b.match as any)?.match_datetime ?? 0).getTime();
		return dateB - dateA; // Newest first
	});

	// Picks on locked-but-not-yet-scored matches (live, or kickoff within 5 min).
	// RLS only returns other users' picks once the match is locked, so this list
	// never leaks an open pick — for non-self profiles everything we received is
	// already public.
	const nowMs = Date.now();
	const livePicks = (pronostics ?? [])
		.filter((p) => {
			if (p.is_scored) return false;
			const m = p.match as any;
			if (!m) return false;
			return m.status === 'live' || m.status === 'finished' ||
				new Date(m.match_datetime).getTime() - nowMs < 5 * 60000;
		})
		.sort((a, b) =>
			new Date((a.match as any)?.match_datetime ?? 0).getTime() -
			new Date((b.match as any)?.match_datetime ?? 0).getTime()
		);
	const pronoPoints  = scored.reduce((sum, p) => sum + (p.points_earned ?? 0), 0);
	const teamBonus    = profile.team_bonus_points ?? 0;
	const totalPoints  = pronoPoints + teamBonus;
	const exactScores = scored.filter((p) => {
		const m = p.match as any;
		return m && p.predicted_home === m.home_score && p.predicted_away === m.away_score;
	}).length;

	// Per-match team-bonus annotation: if the user's favourite team won a given
	// finished match, attach the bonus amount that match contributed. Helps the
	// match-history table explain why the user's profile total is higher than
	// the pure prediction-points column suggests.
	const STAGE_BONUS: Record<string, number> = {
		group: 1, round_of_32: 2, round_of_16: 3, quarters: 5, semis: 8, final: 13, third: 3
	};
	let favTeamMultiplier = 1.0;
	if (profile.favorite_team) {
		const { data: oddsRow } = await supabase
			.from('wc_winner_odds')
			.select('multiplier')
			.eq('team_name_en', profile.favorite_team)
			.maybeSingle();
		favTeamMultiplier = parseFloat(String(oddsRow?.multiplier ?? 1.0));
	}
	const scoredWithBonus = scored.map((p) => {
		const m = p.match as any;
		let teamBonus: number | null = null;
		if (profile.favorite_team && m && m.home_score != null && m.away_score != null) {
			let winner: string | null = null;
			if (m.home_score > m.away_score) winner = m.home_team;
			else if (m.away_score > m.home_score) winner = m.away_team;
			if (winner === profile.favorite_team) {
				const stageBonus = STAGE_BONUS[m.stage] ?? 0;
				if (stageBonus > 0) teamBonus = parseFloat((stageBonus * favTeamMultiplier).toFixed(2));
			}
		}
		return { ...p, teamBonus };
	});

	// Fetch WC winner odds from DB (populated by admin sync from Polymarket)
	// odds column = 1/probability (decimal odds, e.g. 6.25 for Spain)
	let teamOdds: number | null = null;
	if (profile.favorite_team) {
		const { data: oddsRows } = await supabase
			.from('wc_winner_odds')
			.select('odds, multiplier, team_name_en');

		// Match by exact name first, then fallback to case-insensitive contains
		const row =
			(oddsRows ?? []).find((r) => r.team_name_en === profile.favorite_team) ??
			(oddsRows ?? []).find((r) =>
				r.team_name_en.toLowerCase().includes(profile.favorite_team!.toLowerCase().split(' ')[0])
			);

		if (row) teamOdds = parseFloat(String(row.multiplier ?? row.odds));
	}

	// Friendship status between the logged-in viewer and this profile.
	// 'self'                — viewing your own profile
	// 'none'                — not logged in or no friendship row
	// 'pending_sent'        — you sent a request to this profile
	// 'pending_received'    — they sent you a request
	// 'accepted'            — you're friends
	// 'declined'            — a previous request was declined (treat as 'none' for re-request)
	type FriendStatus = 'self' | 'none' | 'pending_sent' | 'pending_received' | 'accepted' | 'declined';
	let friendStatus: FriendStatus = 'none';
	let friendshipId: string | null = null;
	if (!user) {
		friendStatus = 'none';
	} else if (user.id === params.id) {
		friendStatus = 'self';
	} else {
		const { data: f } = await supabase
			.from('friendships')
			.select('id, status, requester_id, addressee_id')
			.or(`and(requester_id.eq.${user.id},addressee_id.eq.${params.id}),and(requester_id.eq.${params.id},addressee_id.eq.${user.id})`)
			.maybeSingle();
		if (f) {
			friendshipId = f.id;
			if (f.status === 'accepted') friendStatus = 'accepted';
			else if (f.status === 'declined') friendStatus = 'declined';
			else if (f.status === 'pending') {
				friendStatus = f.requester_id === user.id ? 'pending_sent' : 'pending_received';
			}
		}
	}

	return {
		profile,
		pronostics: scoredWithBonus,
		livePicks,
		pronoPoints,
		teamBonus,
		totalPoints,
		exactScores,
		totalPronoCount: (pronostics ?? []).length,
		isOwnProfile: user?.id === params.id,
		teamOdds,
		friendStatus,
		friendshipId
	};
};

export const actions: Actions = {
	request: async ({ params, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user) return fail(401, { error: 'Non authentifié' });
		if (user.id === params.id) return fail(400, { error: 'Tu ne peux pas t\'envoyer une demande à toi-même.' });

		// Upsert-style: if a declined row exists between these two, flip it back to pending.
		// Otherwise insert fresh.
		const { data: existing } = await supabase
			.from('friendships')
			.select('id, status')
			.or(`and(requester_id.eq.${user.id},addressee_id.eq.${params.id}),and(requester_id.eq.${params.id},addressee_id.eq.${user.id})`)
			.maybeSingle();

		if (existing) {
			if (existing.status === 'pending')  return fail(400, { error: 'Demande déjà en attente.' });
			if (existing.status === 'accepted') return fail(400, { error: 'Vous êtes déjà amis.' });
			// declined: reopen as pending from the current user
			const { error: upErr } = await supabase
				.from('friendships')
				.update({ status: 'pending', requester_id: user.id, addressee_id: params.id })
				.eq('id', existing.id);
			if (upErr) return fail(500, { error: upErr.message });
		} else {
			const { error: insErr } = await supabase
				.from('friendships')
				.insert({ requester_id: user.id, addressee_id: params.id, status: 'pending' });
			if (insErr) return fail(500, { error: insErr.message });
		}

		return { requestSent: true };
	},

	respond: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		if (!user) return fail(401, { error: 'Non authentifié' });

		const form = await request.formData();
		const friendshipId = form.get('friendship_id') as string;
		const action = form.get('action') as 'accepted' | 'declined';

		const { error: respondErr } = await supabase
			.from('friendships')
			.update({ status: action })
			.eq('id', friendshipId)
			.eq('addressee_id', user.id);
		if (respondErr) return fail(500, { error: respondErr.message });

		return { responded: true };
	}
};
