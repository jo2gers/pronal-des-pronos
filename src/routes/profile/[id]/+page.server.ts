import { error, fail } from '@sveltejs/kit';
import { STAGE_BONUS } from '$lib/server/scoring';
import { resolveCurrentComp } from '$lib/server/currentComp';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url, cookies, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();

	// The profile is scoped to the GAME you're in (Premier League / Champions
	// League) — never the finished World Cup. PL and UCL stay two separate games:
	// your club, points and history here are THIS competition's. `?comp=` (the
	// game switcher) overrides the /[comp] cookie.
	const { current, active } = await resolveCurrentComp(supabase, cookies, url.searchParams.get('comp'));
	const compId = current?.id ?? null;

	const { data: profile } = await supabase
		.from('profiles')
		.select('id, username, display_name, avatar_url, country')
		.eq('id', params.id)
		.single();

	if (!profile) error(404, 'Profil introuvable');

	// This user's club + accrued bonus in the current game (favorite_teams, NOT
	// the retired WC profiles.favorite_team).
	const { data: fav } = compId
		? await supabase
				.from('favorite_teams')
				.select('team, bonus_points')
				.eq('user_id', params.id)
				.eq('competition_id', compId)
				.maybeSingle()
		: { data: null };
	const favTeam = (fav?.team as string | null) ?? null;
	const teamBonus = parseFloat(String(fav?.bonus_points ?? 0));

	// Club crest (competition_teams) + title multiplier (competition_winner_odds).
	let favTeamCrest: string | null = null;
	let favTeamShort: string | null = null;
	let teamOdds: number | null = null;
	if (favTeam && compId) {
		const [{ data: crestRow }, { data: oddsRow }] = await Promise.all([
			supabase
				.from('competition_teams')
				.select('short_name, logo_url')
				.eq('competition_id', compId)
				.eq('name_en', favTeam)
				.maybeSingle(),
			supabase
				.from('competition_winner_odds')
				.select('multiplier')
				.eq('competition_id', compId)
				.eq('team_name_en', favTeam)
				.maybeSingle()
		]);
		favTeamCrest = (crestRow?.logo_url as string | null) ?? null;
		favTeamShort = (crestRow?.short_name as string | null) ?? null;
		if (oddsRow) teamOdds = parseFloat(String(oddsRow.multiplier));
	}
	const favTeamMultiplier = teamOdds ?? 1.0;

	// Aggregate stats for the current game — the per-competition view, so these
	// match that game's leaderboard exactly.
	const { data: stats } = compId
		? await supabase
				.from('competition_pronostic_stats')
				.select('prono_points, winners, exact')
				.eq('user_id', params.id)
				.eq('competition_id', compId)
				.maybeSingle()
		: { data: null };
	const pronoPoints = parseFloat(String(stats?.prono_points ?? 0));
	const exactScores = (stats?.exact as number) ?? 0;
	const winners = (stats?.winners as number) ?? 0;
	const totalPoints = parseFloat((pronoPoints + teamBonus).toFixed(2));

	// Pick history + live picks, current game only (scope by this competition's
	// match ids — keeps WC picks out of the current profile).
	const { data: compMatches } = compId
		? await supabase.from('matches').select('id').eq('competition_id', compId)
		: { data: [] as { id: string }[] };
	const matchIds = (compMatches ?? []).map((m) => m.id);

	const { data: pronostics } = matchIds.length
		? await supabase
				.from('pronostics')
				.select(
					`id, predicted_home, predicted_away, points_earned, is_scored,
					match:matches(id, home_team, away_team, home_score, away_score, ft_home_score, ft_away_score, pen_home, pen_away, match_datetime, stage, status)`
				)
				.eq('user_id', params.id)
				.in('match_id', matchIds)
		: { data: [] };

	const scored = (pronostics ?? [])
		.filter((p) => p.is_scored)
		.sort(
			(a, b) =>
				new Date((b.match as any)?.match_datetime ?? 0).getTime() -
				new Date((a.match as any)?.match_datetime ?? 0).getTime()
		);

	const nowMs = Date.now();
	const livePicks = (pronostics ?? [])
		.filter((p) => {
			if (p.is_scored) return false;
			const m = p.match as any;
			if (!m) return false;
			return (
				m.status === 'live' ||
				m.status === 'finished' ||
				new Date(m.match_datetime).getTime() - nowMs < 5 * 60000
			);
		})
		.sort(
			(a, b) =>
				new Date((a.match as any)?.match_datetime ?? 0).getTime() -
				new Date((b.match as any)?.match_datetime ?? 0).getTime()
		);

	const totalPronoCount = (pronostics ?? []).length;

	// Per-match club-bonus annotation (current game): if the fav club won a given
	// finished match, attach the bonus it paid (STAGE_BONUS × title multiplier).
	const scoredWithBonus = scored.map((p) => {
		const m = p.match as any;
		let matchTeamBonus: number | null = null;
		if (favTeam && m && m.home_score != null && m.away_score != null) {
			const effH = m.pen_home ?? m.ft_home_score ?? m.home_score;
			const effA = m.pen_away ?? m.ft_away_score ?? m.away_score;
			let w: string | null = null;
			if (effH > effA) w = m.home_team;
			else if (effA > effH) w = m.away_team;
			if (w === favTeam) {
				const sb = STAGE_BONUS[m.stage] ?? 0;
				if (sb > 0) matchTeamBonus = parseFloat((sb * favTeamMultiplier).toFixed(2));
			}
		}
		return { ...p, teamBonus: matchTeamBonus };
	});

	// Friendship status between the logged-in viewer and this profile.
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
			.or(
				`and(requester_id.eq.${user.id},addressee_id.eq.${params.id}),and(requester_id.eq.${params.id},addressee_id.eq.${user.id})`
			)
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
		favTeam,
		favTeamCrest,
		favTeamShort,
		currentComp: current,
		activeComps: active,
		pronostics: scoredWithBonus,
		livePicks,
		pronoPoints,
		teamBonus,
		totalPoints,
		exactScores,
		winners,
		totalPronoCount,
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
