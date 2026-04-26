<script lang="ts">
	import { enhance } from '$app/forms';
	import { formatDate, isMatchLocked } from '$lib/utils';
	import { STAGE_LABELS_FR, STAGE_LABELS_EN } from '$lib/wc2026';
	import { t, getLang } from '$lib/i18n.svelte';

	function flagSrc(iso: string | null | undefined) {
		return iso ? `https://flagcdn.com/w80/${iso.toLowerCase()}.png` : '';
	}

	let { data, form } = $props();

	let home      = $state(data.userPronostic?.predicted_home ?? 0);
	let away      = $state(data.userPronostic?.predicted_away ?? 0);
	let loading   = $state(false);
	let pronoFilter = $state<'friends' | 'all'>('friends');

	const locked = $derived(isMatchLocked(data.match.match_datetime));

	function getCountdown(dt: string) {
		const diff = new Date(dt).getTime() - Date.now();
		if (diff <= 0) return null;
		return {
			diff,
			days:  Math.floor(diff / 86400000),
			hours: Math.floor((diff % 86400000) / 3600000),
			mins:  Math.floor((diff % 3600000) / 60000),
			secs:  Math.floor((diff % 60000) / 1000)
		};
	}

	let countdown = $state(
		data.match.status === 'upcoming' ? getCountdown(data.match.match_datetime) : null
	);

	$effect(() => {
		if (data.match.status !== 'upcoming') return;
		const timer = setInterval(() => { countdown = getCountdown(data.match.match_datetime); }, 1000);
		return () => clearInterval(timer);
	});

	const urgency = $derived(() => {
		if (!countdown) return 'none';
		if (countdown.diff < 5 * 60000)    return 'locked';
		if (countdown.diff < 6 * 3600000)  return 'critical';
		if (countdown.diff < 24 * 3600000) return 'warning';
		return 'normal';
	});

	const urgencyColor: Record<string, string> = {
		locked: 'text-faint', critical: 'text-live', warning: 'text-warn',
		normal: 'text-accent', none: 'text-accent'
	};

	// Friends + self set for filtering
	const friendSet = $derived(new Set([...(data.friendIds ?? []), data.user?.id ?? '']));

	// Filtered pronostics
	const visiblePronostics = $derived(() => {
		if (!data.allPronostics) return [];
		if (pronoFilter === 'friends') return data.allPronostics.filter((p: any) => friendSet.has(p.user_id));
		return data.allPronostics;
	});

	// Whether the user's own pick is already in the list
	const myPronoInList = $derived(
		data.allPronostics?.some((p: any) => p.user_id === data.user?.id) ?? false
	);

	function isMe(userId: string) { return userId === data.user?.id; }
	function isFriend(userId: string) { return (data.friendIds ?? []).includes(userId); }

	function rowBadge(pts: number | null, predicted_home: number, predicted_away: number) {
		if (pts === null) return null;
		const m = data.match;
		if (predicted_home === m.home_score && predicted_away === m.away_score) return 'exact';
		if (pts > 0) return 'correct';
		return 'wrong';
	}
</script>

<div class="max-w-2xl mx-auto space-y-5">

	<!-- Match header -->
	<div class="rounded-xl bg-panel border border-wire p-6">
		<div class="flex items-center justify-between mb-5 text-xs text-faint">
			<span>
				{(getLang() === 'fr' ? STAGE_LABELS_FR : STAGE_LABELS_EN)[data.match.stage] ?? data.match.stage}
				{data.match.group_label ? ` · ${t('group_short')} ${data.match.group_label}` : ''}
			</span>
			{#if data.match.venue}
				<span class="hidden sm:block truncate ml-4 max-w-[200px]">{data.match.venue}</span>
			{/if}
		</div>

		<!-- Teams + score -->
		<div class="flex items-center justify-center gap-6 sm:gap-10">
			<div class="text-center flex-1">
				{#if flagSrc(data.match.home_flag)}
					<img src={flagSrc(data.match.home_flag)} alt={data.match.home_team}
						class="w-16 h-11 object-cover rounded mx-auto mb-2" />
				{/if}
				<p class="font-bold text-base text-fg leading-tight">{data.match.home_team}</p>
			</div>

			<div class="text-center shrink-0">
				{#if data.match.status === 'finished' && data.match.home_score != null}
					<p class="text-5xl font-bold text-accent tabular-nums leading-none"
						style="font-family: var(--font-display)">
						{data.match.home_score}<span class="text-wire-hi mx-2">–</span>{data.match.away_score}
					</p>
					<p class="text-xs text-faint mt-2">{t('ended')}</p>
				{:else if data.match.status === 'live'}
					<p class="text-5xl font-bold text-live tabular-nums leading-none"
						style="font-family: var(--font-display)">
						{data.match.home_score ?? 0}<span class="text-wire-hi mx-2">–</span>{data.match.away_score ?? 0}
					</p>
					<span class="inline-flex items-center gap-1.5 mt-2">
						<span class="w-1.5 h-1.5 rounded-full bg-live animate-pulse"></span>
						<span class="text-xs font-bold text-live uppercase tracking-widest">LIVE</span>
					</span>
				{:else}
					{#if countdown}
						<div class="space-y-1">
							{#if countdown.days > 0}
								<p class="text-3xl font-bold tabular-nums {urgencyColor[urgency()]} min-w-[8rem] text-center"
									style="font-family: var(--font-display)">
									J–{countdown.days}
									<span class="text-xl text-faint">
										{String(countdown.hours).padStart(2, '0')}h{String(countdown.mins).padStart(2, '0')}
									</span>
								</p>
							{:else}
								<p class="text-4xl font-bold {urgencyColor[urgency()]} min-w-[7rem] text-center"
									style="font-family: var(--font-display)">
									{String(countdown.hours).padStart(2, '0')}:{String(countdown.mins).padStart(2, '0')}:{String(countdown.secs).padStart(2, '0')}
								</p>
							{/if}
							<p class="text-xs text-faint">{formatDate(data.match.match_datetime)}</p>
						</div>
					{:else}
						<p class="text-sm text-muted">{formatDate(data.match.match_datetime)}</p>
					{/if}
				{/if}
			</div>

			<div class="text-center flex-1">
				{#if flagSrc(data.match.away_flag)}
					<img src={flagSrc(data.match.away_flag)} alt={data.match.away_team}
						class="w-16 h-11 object-cover rounded mx-auto mb-2" />
				{/if}
				<p class="font-bold text-base text-fg leading-tight">{data.match.away_team}</p>
			</div>
		</div>

		<!-- Polymarket odds (probabilities) -->
		{#if data.match.odds_home && data.match.odds_draw && data.match.odds_away}
			{@const pHome = Math.round(100 / (data.match.odds_home ?? 1))}
			{@const pDraw = Math.round(100 / (data.match.odds_draw ?? 1))}
			{@const pAway = Math.round(100 / (data.match.odds_away ?? 1))}
			<div class="mt-6 pt-4 border-t border-wire">
				<p class="text-xs text-faint text-center mb-3">{t('match_polymarket')}</p>
				<div class="flex items-end gap-2">
					<!-- Home bar -->
					<div class="flex-1 text-center">
						<p class="text-xs text-muted mb-1 truncate">{data.match.home_team}</p>
						<div class="h-1.5 rounded-full bg-raised overflow-hidden mb-1.5">
							<div class="h-full rounded-full bg-accent transition-all" style="width: {pHome}%"></div>
						</div>
						<p class="text-lg font-bold text-fg tabular-nums leading-none" style="font-family: var(--font-display)">{pHome}%</p>
					</div>
					<!-- Draw bar -->
					<div class="w-14 text-center shrink-0">
						<p class="text-xs text-muted mb-1">{t('match_draw')}</p>
						<div class="h-1.5 rounded-full bg-raised overflow-hidden mb-1.5">
							<div class="h-full rounded-full bg-wire-hi transition-all" style="width: {pDraw}%"></div>
						</div>
						<p class="text-lg font-bold text-fg tabular-nums leading-none" style="font-family: var(--font-display)">{pDraw}%</p>
					</div>
					<!-- Away bar -->
					<div class="flex-1 text-center">
						<p class="text-xs text-muted mb-1 truncate">{data.match.away_team}</p>
						<div class="h-1.5 rounded-full bg-raised overflow-hidden mb-1.5">
							<div class="h-full rounded-full bg-accent transition-all" style="width: {pAway}%"></div>
						</div>
						<p class="text-lg font-bold text-fg tabular-nums leading-none" style="font-family: var(--font-display)">{pAway}%</p>
					</div>
				</div>
			</div>
		{/if}
	</div>

	<!-- My pronostic -->
	{#if data.user}
		<div class="rounded-xl bg-panel border border-wire p-6">
			<div class="flex items-center justify-between mb-5">
				<h2 class="text-base font-semibold text-fg" style="font-family: var(--font-display)">{t('match_my_pronostic')}</h2>
				{#if locked || data.match.status !== 'upcoming'}
					<span class="text-xs text-faint border border-wire rounded px-2 py-0.5">{t('match_closed')}</span>
				{:else}
					<span class="text-xs border border-current rounded px-2 py-0.5" style="color: var(--color-success)">{t('match_open')}</span>
				{/if}
			</div>

			{#if data.match.status === 'finished' && data.userPronostic}
				<!-- Finished: show result prominently -->
				{@const badge = rowBadge(data.userPronostic.points_earned, data.userPronostic.predicted_home, data.userPronostic.predicted_away)}
				<div class="flex items-center justify-center gap-8">
					<div class="text-center">
						<p class="text-xs text-faint mb-2">{t('match_my_pick')}</p>
						<p class="text-4xl font-bold text-fg tabular-nums" style="font-family: var(--font-display)">
							{data.userPronostic.predicted_home} – {data.userPronostic.predicted_away}
						</p>
						{#if badge === 'exact'}
							<span class="inline-block mt-2 text-xs font-semibold text-accent border border-accent/30 rounded px-2 py-0.5">{t('match_score_exact')}</span>
						{:else if badge === 'correct'}
							<span class="inline-block mt-2 text-xs font-semibold text-muted border border-wire rounded px-2 py-0.5">{t('match_winner_ok')}</span>
						{:else}
							<span class="inline-block mt-2 text-xs text-faint border border-wire/50 rounded px-2 py-0.5">{t('match_missed')}</span>
						{/if}
					</div>
					<div class="text-center">
						<p class="text-xs text-faint mb-2">{t('match_points_earned')}</p>
						<p class="text-5xl font-bold tabular-nums
							{badge === 'exact' ? 'text-accent' : badge === 'correct' ? 'text-fg' : 'text-muted'}"
							style="font-family: var(--font-display)">
							{data.userPronostic.points_earned?.toFixed(2) ?? '0.00'}
						</p>
					</div>
				</div>

			{:else if data.match.status !== 'finished'}
				<!-- Upcoming / live: prediction form -->
				{#if form?.error}
					<div class="mb-4 rounded bg-err/10 border border-err/20 px-3 py-2.5 text-sm text-err">{form.error}</div>
				{/if}
				{#if form?.success}
					<div class="mb-4 rounded px-3 py-2.5 text-sm font-medium border"
						style="background: oklch(from var(--color-success) l c h / 0.08); border-color: oklch(from var(--color-success) l c h / 0.25); color: var(--color-success)">
						{t('match_saved')}
					</div>
				{/if}

				<form method="POST" action="?/pronostic" use:enhance={() => {
					loading = true;
					return async ({ update }) => { loading = false; await update(); };
				}}>
					<div class="flex items-center justify-center gap-8 mb-5">
						<div class="text-center">
							<p class="text-xs text-muted mb-3">{data.match.home_team}</p>
							<div class="flex items-center gap-3">
								<button type="button" disabled={locked || home === 0} onclick={() => home--}
									class="w-9 h-9 rounded-full bg-raised hover:bg-wire-hi disabled:opacity-20 text-fg text-lg font-bold transition-colors cursor-pointer">−</button>
								<span class="text-4xl font-bold text-fg w-12 text-center tabular-nums" style="font-family: var(--font-display)">{home}</span>
								<button type="button" disabled={locked || home >= 20} onclick={() => home++}
									class="w-9 h-9 rounded-full bg-raised hover:bg-wire-hi disabled:opacity-20 text-fg text-lg font-bold transition-colors cursor-pointer">+</button>
							</div>
							<input type="hidden" name="predicted_home" value={home} />
						</div>

						<span class="text-2xl text-faint font-bold mt-4" style="font-family: var(--font-display)">–</span>

						<div class="text-center">
							<p class="text-xs text-muted mb-3">{data.match.away_team}</p>
							<div class="flex items-center gap-3">
								<button type="button" disabled={locked || away === 0} onclick={() => away--}
									class="w-9 h-9 rounded-full bg-raised hover:bg-wire-hi disabled:opacity-20 text-fg text-lg font-bold transition-colors cursor-pointer">−</button>
								<span class="text-4xl font-bold text-fg w-12 text-center tabular-nums" style="font-family: var(--font-display)">{away}</span>
								<button type="button" disabled={locked || away >= 20} onclick={() => away++}
									class="w-9 h-9 rounded-full bg-raised hover:bg-wire-hi disabled:opacity-20 text-fg text-lg font-bold transition-colors cursor-pointer">+</button>
							</div>
							<input type="hidden" name="predicted_away" value={away} />
						</div>
					</div>

					{#if !locked}
						{#if data.match.odds_home && data.match.odds_draw && data.match.odds_away}
							{@const outcome = Math.sign(home - away)}
							{@const oddsUsed = outcome > 0 ? data.match.odds_home : outcome === 0 ? data.match.odds_draw : data.match.odds_away}
							<p class="text-xs text-center text-faint mb-4">
								{t('match_odds')} <span class="text-accent font-semibold">{oddsUsed?.toFixed(2) ?? '1.00'}</span>
								· {t('match_exact_score')} <span class="text-accent font-semibold">{((oddsUsed ?? 1) * 3).toFixed(2)} {t('match_pts')}</span>
								· {t('match_winner')} <span class="text-muted">{((oddsUsed ?? 1) * 1).toFixed(2)} {t('match_pts')}</span>
							</p>
						{/if}
						<button type="submit" disabled={loading}
							class="w-full rounded-lg bg-accent hover:bg-accent-hi disabled:opacity-50 px-4 py-3 font-semibold text-canvas transition-colors cursor-pointer">
							{loading ? t('saving') : data.userPronostic ? t('match_modify') : t('match_submit')}
						</button>
					{:else}
						<p class="text-center text-sm text-faint">{t('match_picks_closed')}</p>
					{/if}
				</form>
			{:else}
				<p class="text-sm text-faint text-center">{t('match_no_pick')}</p>
			{/if}
		</div>
	{:else}
		<div class="rounded-xl bg-panel border border-wire p-6 text-center">
			<p class="text-muted mb-3">{t('match_login_to_pick')}</p>
			<a href="/auth/login" class="inline-block rounded-lg bg-accent hover:bg-accent-hi px-5 py-2 text-sm font-semibold text-canvas transition-colors">
				{t('login_cta')}
			</a>
		</div>
	{/if}

	<!-- Post-match leaderboard -->
	{#if data.allPronostics && data.allPronostics.length > 0}
		<div>
			<div class="flex items-center justify-between mb-3">
				<h2 class="text-base font-semibold text-fg" style="font-family: var(--font-display)">
					{t('match_pronostics')} <span class="text-faint font-normal text-sm tabular-nums">{data.allPronostics.length}</span>
				</h2>
				<!-- Friends / All filter (only if user has friends) -->
				{#if data.user && (data.friendIds ?? []).length > 0}
					<div class="flex gap-0.5 rounded-lg bg-raised border border-wire p-0.5">
						<button onclick={() => pronoFilter = 'friends'}
							class="rounded px-3 py-1 text-xs font-semibold transition-colors cursor-pointer
								{pronoFilter === 'friends' ? 'bg-panel text-fg shadow-sm' : 'text-faint hover:text-muted'}">
							{t('match_friends_filter')}
						</button>
						<button onclick={() => pronoFilter = 'all'}
							class="rounded px-3 py-1 text-xs font-semibold transition-colors cursor-pointer
								{pronoFilter === 'all' ? 'bg-panel text-fg shadow-sm' : 'text-faint hover:text-muted'}">
							{t('match_all_filter')}
						</button>
					</div>
				{/if}
			</div>

			<div class="-mx-4 sm:mx-0 sm:rounded-xl sm:bg-panel/40 sm:border sm:border-wire overflow-hidden border-y border-wire sm:border-y-0">
				{#if visiblePronostics().length === 0}
					<p class="px-4 py-6 text-sm text-faint text-center">{t('match_no_friend_picks')}</p>
				{:else}
					{#each visiblePronostics() as p, i (p.user_id)}
						{@const me = isMe(p.user_id)}
						{@const friend = isFriend(p.user_id)}
						{@const badge = rowBadge(p.points_earned, p.predicted_home, p.predicted_away)}
						<a href="/profile/{p.user_id}"
							class="flex items-center gap-3 px-4 py-3 border-b border-wire/40 last:border-0 transition-colors
								{me ? 'bg-accent-lo/60 hover:bg-accent-lo' : 'hover:bg-raised'}">

							<!-- Rank -->
							<span class="text-xs text-faint w-5 tabular-nums shrink-0">{i + 1}</span>

							<!-- Avatar -->
							{#if (p.profiles as any)?.avatar_url}
								<img src={(p.profiles as any).avatar_url} alt=""
									class="w-7 h-7 rounded-full object-cover shrink-0 {me ? 'ring-1 ring-accent' : ''}" />
							{:else}
								<span class="w-7 h-7 rounded-full bg-raised border border-wire flex items-center justify-center text-xs font-bold text-muted shrink-0">
									{((p.profiles as any)?.display_name ?? (p.profiles as any)?.username ?? '?')[0]?.toUpperCase()}
								</span>
							{/if}

							<!-- Name -->
							<span class="flex-1 text-sm truncate {me ? 'text-accent font-semibold' : friend ? 'text-fg' : 'text-muted'}">
								{(p.profiles as any)?.display_name ?? (p.profiles as any)?.username ?? '?'}
								{#if me}<span class="text-faint font-normal ml-1 text-xs">(moi)</span>{/if}
							</span>

							<!-- Prediction -->
							<span class="font-mono text-sm tabular-nums
								{badge === 'exact' ? 'text-accent font-bold' : badge === 'correct' ? 'text-fg' : 'text-muted'}">
								{p.predicted_home} – {p.predicted_away}
							</span>

							<!-- Badge -->
							{#if badge === 'exact'}
								<span class="text-[10px] font-bold text-accent shrink-0">exact</span>
							{:else if badge === 'correct'}
								<span class="w-1.5 h-1.5 rounded-full shrink-0" style="background: var(--color-success)"></span>
							{/if}

							<!-- Points -->
							<span class="font-bold tabular-nums w-14 text-right shrink-0 {badge === 'exact' ? 'text-accent' : badge === 'correct' ? 'text-fg' : 'text-faint'}"
								style="font-family: var(--font-display)">
								{p.points_earned?.toFixed(2) ?? '0.00'}
							</span>
						</a>
					{/each}
				{/if}
			</div>
		</div>
	{/if}
</div>
