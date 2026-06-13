<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { formatDate, isMatchLocked, liveClock } from '$lib/utils';
	import { STAGE_LABELS_FR, STAGE_LABELS_EN, teamLabel } from '$lib/wc2026';
	import { t, getLang } from '$lib/i18n.svelte';
	import Flag from '$lib/components/Flag.svelte';
	import FilterCarousel from '$lib/components/FilterCarousel.svelte';

	function flagSrc(iso: string | null | undefined) {
		return iso ? `https://flagcdn.com/w80/${iso.toLowerCase()}.png` : '';
	}

	let { data, form } = $props();

	// Auto-refresh every 30s while this match is live
	$effect(() => {
		if (data.match.status !== 'live') return;
		const interval = setInterval(() => invalidateAll(), 30_000);
		return () => clearInterval(interval);
	});

	let home      = $state(data.userPronostic?.predicted_home ?? 0);
	let away      = $state(data.userPronostic?.predicted_away ?? 0);

	// Auto-save: every stepper tap schedules a debounced submit — no explicit
	// save button. Status line below the steppers gives the feedback.
	let pickFormEl = $state<HTMLFormElement | null>(null);
	let saveStatus = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');
	let saveTimer: ReturnType<typeof setTimeout> | null = null;

	function scheduleSave() {
		if (saveTimer) clearTimeout(saveTimer);
		saveStatus = 'saving';
		saveTimer = setTimeout(() => pickFormEl?.requestSubmit(), 700);
	}
	// 'all' | 'friends' | a league id — tabs render in that order (leagues in the middle)
	let pronoFilter = $state<string>('all');

	const pronoFilterItems = $derived([
		{ id: 'all', label: t('match_all_filter') },
		...(data.myLeagues ?? []).map((l: any) => ({ id: l.id, label: l.name })),
		...((data.friendIds ?? []).length > 0 ? [{ id: 'friends', label: t('match_friends_filter') }] : [])
	]);

	// Locked when: kickoff lock fired, OR teams are still TBD, OR the whole
	// stage hasn't opened yet (previous round still has unfinished matches —
	// e.g. you can't predict R32 while group L is still playing). The
	// stage gate is computed server-side via computeStageUnlocks.
	const locked = $derived(
		isMatchLocked(data.match.match_datetime)
		|| data.match.home_team === 'TBD'
		|| data.match.away_team === 'TBD'
		|| (data.match as any).stage_locked === true
	);

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

	// Filtered pronostics: all | friends | one league's members
	const visiblePronostics = $derived(() => {
		if (!data.allPronostics) return [];
		if (pronoFilter === 'friends') return data.allPronostics.filter((p: any) => friendSet.has(p.user_id));
		const league = (data.myLeagues ?? []).find((l: any) => l.id === pronoFilter);
		if (league) {
			const members = new Set(league.memberIds);
			return data.allPronostics.filter((p: any) => members.has(p.user_id));
		}
		return data.allPronostics;
	});

	// Points/badges only mean something once the match result is in.
	const isScoredView = $derived(data.match.status === 'finished');

	// Real Polymarket match clock for the LIVE badge (null until first poll).
	const liveMatchClock = $derived(
		liveClock(data.match.live_elapsed, data.match.live_period, getLang() as 'fr' | 'en', data.match.last_score_sync_at)
	);

	// Highlights player: lite facade — the YouTube iframe only mounts on click.
	let highlightPlaying = $state(false);

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

	<!-- Back to where the user came from (homepage, /matches, etc.) -->
	<button type="button" onclick={() => history.back()}
		class="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg transition-colors cursor-pointer -mb-1 group/back">
		<svg class="w-4 h-4 group-hover/back:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" aria-hidden="true">
			<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
		</svg>
		<span>{t('back')}</span>
	</button>

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

		<!-- Teams + score. items-start pins both flags to the same row — a
		     two-line team name ("South Africa") must never push its flag up. -->
		<div class="flex items-start justify-center gap-6 sm:gap-10">
			<div class="text-center flex-1 min-w-0 flex flex-col items-center">
				{#if data.match.home_team !== 'TBD'}
					<a href="/teams/{encodeURIComponent(data.match.home_team)}"
						class="flex flex-col items-center group/team w-full" title={teamLabel(data.match.home_team)}>
						<Flag code={data.match.home_flag} size={88} alt={teamLabel(data.match.home_team)} class="mb-2 group-hover/team:scale-105 transition-transform" />
						<p class="font-bold text-base text-fg leading-tight group-hover/team:text-accent transition-colors">{teamLabel(data.match.home_team)}</p>
					</a>
				{:else}
					<Flag code={data.match.home_flag} size={88} alt={teamLabel(data.match.home_team)} class="mb-2" />
					<p class="font-bold text-base text-fg leading-tight">{teamLabel(data.match.home_team)}</p>
				{/if}
			</div>

			<div class="text-center shrink-0 self-center">
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
						{#if liveMatchClock}
							<span class="text-xs font-bold text-live tabular-nums">· {liveMatchClock}</span>
						{/if}
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
							{:else if countdown.hours > 0}
								<!-- Hours left: hours + minutes only — narrower, the flags keep
								     their room. Seconds only appear inside the final hour. -->
								<p class="text-4xl font-bold tabular-nums {urgencyColor[urgency()]} text-center"
									style="font-family: var(--font-display)">
									{countdown.hours}<span class="text-2xl">h</span>{String(countdown.mins).padStart(2, '0')}
								</p>
							{:else}
								<p class="text-4xl font-bold tabular-nums {urgencyColor[urgency()]} text-center"
									style="font-family: var(--font-display)">
									{String(countdown.mins).padStart(2, '0')}:{String(countdown.secs).padStart(2, '0')}
								</p>
							{/if}
							<p class="text-xs text-faint">{formatDate(data.match.match_datetime)}</p>
						</div>
					{:else}
						<p class="text-sm text-muted">{formatDate(data.match.match_datetime)}</p>
					{/if}
				{/if}
			</div>

			<div class="text-center flex-1 min-w-0 flex flex-col items-center">
				{#if data.match.away_team !== 'TBD'}
					<a href="/teams/{encodeURIComponent(data.match.away_team)}"
						class="flex flex-col items-center group/team w-full" title={teamLabel(data.match.away_team)}>
						<Flag code={data.match.away_flag} size={88} alt={teamLabel(data.match.away_team)} class="mb-2 group-hover/team:scale-105 transition-transform" />
						<p class="font-bold text-base text-fg leading-tight group-hover/team:text-accent transition-colors">{teamLabel(data.match.away_team)}</p>
					</a>
				{:else}
					<Flag code={data.match.away_flag} size={88} alt={teamLabel(data.match.away_team)} class="mb-2" />
					<p class="font-bold text-base text-fg leading-tight">{teamLabel(data.match.away_team)}</p>
				{/if}
			</div>
		</div>

		<!-- Market odds — favourite in accent, underdog muted -->
		{#if data.match.odds_home && data.match.odds_draw && data.match.odds_away}
			{@const pHome = Math.round(100 / (data.match.odds_home ?? 1))}
			{@const pDraw = Math.round(100 / (data.match.odds_draw ?? 1))}
			{@const pAway = Math.round(100 / (data.match.odds_away ?? 1))}
			{@const homeFav = (data.match.odds_home ?? 99) <= (data.match.odds_away ?? 99)}
			<div class="mt-6 pt-4 border-t border-wire">
				<p class="text-xs text-faint text-center mb-3">{t('match_polymarket')}</p>
				<div class="flex items-end gap-2">
					<!-- Home bar -->
					<div class="flex-1 text-center">
						<p class="text-xs text-muted mb-1 truncate">{teamLabel(data.match.home_team)}</p>
						<div class="h-1.5 rounded-full bg-raised overflow-hidden mb-1.5">
							<div class="h-full rounded-full transition-all {homeFav ? 'bg-accent' : 'bg-wire-hi'}" style="width: {pHome}%"></div>
						</div>
						<p class="text-lg font-bold tabular-nums leading-none {homeFav ? 'text-accent' : 'text-muted'}" style="font-family: var(--font-display)">{data.match.odds_home.toFixed(2)}</p>
					</div>
					<!-- Draw bar -->
					<div class="w-14 text-center shrink-0">
						<p class="text-xs text-faint mb-1">{t('match_draw')}</p>
						<div class="h-1.5 rounded-full bg-raised overflow-hidden mb-1.5">
							<div class="h-full rounded-full bg-wire transition-all" style="width: {pDraw}%"></div>
						</div>
						<p class="text-sm font-semibold text-faint tabular-nums leading-none mt-1" style="font-family: var(--font-display)">{data.match.odds_draw.toFixed(2)}</p>
					</div>
					<!-- Away bar -->
					<div class="flex-1 text-center">
						<p class="text-xs text-muted mb-1 truncate">{teamLabel(data.match.away_team)}</p>
						<div class="h-1.5 rounded-full bg-raised overflow-hidden mb-1.5">
							<div class="h-full rounded-full transition-all {homeFav ? 'bg-wire-hi' : 'bg-accent'}" style="width: {pAway}%"></div>
						</div>
						<p class="text-lg font-bold tabular-nums leading-none {homeFav ? 'text-muted' : 'text-accent'}" style="font-family: var(--font-display)">{data.match.odds_away.toFixed(2)}</p>
					</div>
				</div>
			</div>
		{/if}

		<!-- Timeline: goals + cards (ESPN), home events left / away events right.
		     Updates live: the cron writes live_events every minute during the
		     match and the page auto-refreshes every 30s while status is live. -->
		{#if (data.match.live_events ?? []).length > 0}
			<div class="mt-6 pt-4 border-t border-wire">
				<div class="flex items-center justify-center gap-1.5 mb-3">
					{#if data.match.status === 'live'}
						<span class="w-1.5 h-1.5 rounded-full bg-live animate-pulse"></span>
						<span class="text-xs font-bold text-live uppercase tracking-widest">{t('match_timeline_live')}</span>
					{:else}
						<span class="text-xs text-faint">{t('match_timeline')}</span>
					{/if}
				</div>
				<div class="space-y-1.5">
					{#each data.match.live_events as ev}
						{@const isHome = ev.side === 'home'}
						<div class="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm">
							<div class="text-right min-w-0 {isHome ? '' : 'invisible'}">
								<span class="inline-flex items-center gap-1.5 max-w-full">
									<span class="text-fg truncate">{ev.player ?? '—'}</span>
									{#if ev.type === 'goal' || ev.type === 'og' || ev.type === 'pen'}
										<span class="shrink-0">⚽</span>
										{#if ev.type === 'og'}<span class="text-[10px] text-faint shrink-0">{t('match_og')}</span>{/if}
										{#if ev.type === 'pen'}<span class="text-[10px] text-faint shrink-0">{t('match_pen')}</span>{/if}
									{:else}
										<span class="w-2.5 h-3.5 rounded-[2px] shrink-0 {ev.type === 'red' ? 'bg-err' : ''}"
											style={ev.type === 'yellow' ? 'background: var(--color-warn, #eab308)' : ''}></span>
									{/if}
								</span>
							</div>
							<span class="text-[11px] text-faint tabular-nums w-12 text-center shrink-0">{ev.minute}</span>
							<div class="text-left min-w-0 {isHome ? 'invisible' : ''}">
								<span class="inline-flex items-center gap-1.5 max-w-full">
									{#if ev.type === 'goal' || ev.type === 'og' || ev.type === 'pen'}
										<span class="shrink-0">⚽</span>
										{#if ev.type === 'og'}<span class="text-[10px] text-faint shrink-0">{t('match_og')}</span>{/if}
										{#if ev.type === 'pen'}<span class="text-[10px] text-faint shrink-0">{t('match_pen')}</span>{/if}
									{:else}
										<span class="w-2.5 h-3.5 rounded-[2px] shrink-0 {ev.type === 'red' ? 'bg-err' : ''}"
											style={ev.type === 'yellow' ? 'background: var(--color-warn, #eab308)' : ''}></span>
									{/if}
									<span class="text-fg truncate">{ev.player ?? '—'}</span>
								</span>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</div>

	<!-- Official highlights — embedded YouTube player (lite facade: the iframe
	     only loads on click, so the heavy YT player never costs a page load). -->
	{#if data.match.youtube_video_id}
		<section class="pt-2">
			<h2 class="text-base font-bold text-fg uppercase tracking-widest text-xs mb-3">{t('match_highlights')}</h2>
			<div class="relative rounded-xl overflow-hidden bg-black border border-wire aspect-video">
				{#if highlightPlaying}
					<iframe
						class="absolute inset-0 w-full h-full"
						src="https://www.youtube-nocookie.com/embed/{data.match.youtube_video_id}?autoplay=1&rel=0"
						title={t('match_highlights')}
						frameborder="0"
						allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
						allowfullscreen></iframe>
				{:else}
					<button type="button" onclick={() => (highlightPlaying = true)}
						class="absolute inset-0 w-full h-full group/play cursor-pointer"
						aria-label={t('match_highlights_play')}>
						<img src="https://i.ytimg.com/vi/{data.match.youtube_video_id}/hqdefault.jpg" alt=""
							class="absolute inset-0 w-full h-full object-cover group-hover/play:scale-105 transition-transform duration-300" />
						<span class="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent"></span>
						<span class="absolute inset-0 flex items-center justify-center">
							<span class="w-16 h-16 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center
								group-hover/play:bg-accent group-hover/play:scale-110 transition-all">
								<svg class="w-7 h-7 text-fg group-hover/play:text-canvas ml-1" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
									<path d="M8 5v14l11-7z" />
								</svg>
							</span>
						</span>
					</button>
				{/if}
			</div>
			<p class="text-[11px] text-faint mt-2">{t('match_highlights_via')}</p>
		</section>
	{/if}

	<!-- My pronostic -->
	{#if data.user}
		<section class="pt-2">
			<div class="flex items-center justify-between mb-5">
				<h2 class="text-base font-bold text-fg uppercase tracking-widest text-xs">{t('match_my_pronostic')}</h2>
				{#if locked || data.match.status !== 'upcoming'}
					<span class="text-xs text-faint border border-wire rounded px-2 py-0.5">{t('match_closed')}</span>
				{:else}
					<span class="text-xs border border-current rounded px-2 py-0.5" style="color: var(--color-success)">{t('match_open')}</span>
				{/if}
			</div>

			{#if data.match.status === 'finished' && data.userPronostic}
				<!-- Finished: show result prominently — pick + points balanced -->
				{@const badge = rowBadge(data.userPronostic.points_earned, data.userPronostic.predicted_home, data.userPronostic.predicted_away)}
				<div class="grid grid-cols-2 gap-6 items-start">
					<div class="text-center">
						<p class="text-xs text-faint mb-2">{t('match_my_pick')}</p>
						<p class="text-4xl sm:text-5xl font-bold text-fg tabular-nums leading-none" style="font-family: var(--font-display)">
							{data.userPronostic.predicted_home}<span class="text-wire-hi mx-1.5">–</span>{data.userPronostic.predicted_away}
						</p>
						<div class="mt-3 min-h-[1.5rem]">
							{#if badge === 'exact'}
								<span class="inline-block text-xs font-semibold text-accent border border-accent/30 rounded px-2 py-0.5">{t('match_score_exact')}</span>
							{:else if badge === 'correct'}
								<span class="inline-block text-xs font-semibold text-muted border border-wire rounded px-2 py-0.5">{t('match_winner_ok')}</span>
							{:else}
								<span class="inline-block text-xs text-faint border border-wire/50 rounded px-2 py-0.5">{t('match_missed')}</span>
							{/if}
						</div>
					</div>
					<div class="text-center border-l border-wire">
						<p class="text-xs text-faint mb-2">{t('match_points_earned')}</p>
						<p class="text-4xl sm:text-5xl font-bold tabular-nums leading-none
							{badge === 'exact' ? 'text-accent' : badge === 'correct' ? 'text-fg' : 'text-muted'}"
							style="font-family: var(--font-display)">
							{data.userPronostic.points_earned?.toFixed(2) ?? '0.00'}
						</p>
						<p class="text-[11px] text-faint mt-3">{t('match_pts')}</p>
					</div>
				</div>

			{:else if data.match.status !== 'finished'}
				<!-- Upcoming / live: prediction form -->
				<form bind:this={pickFormEl} method="POST" action="?/pronostic" use:enhance={() => {
					saveStatus = 'saving';
					return async ({ result, update }) => {
						saveStatus = result.type === 'success' ? 'saved' : 'error';
						await update({ reset: false });
					};
				}}>
					<div class="flex items-center justify-center gap-4 sm:gap-5 mb-5">
						<div class="text-center">
							<p class="text-xs text-muted mb-3">{teamLabel(data.match.home_team)}</p>
							<div class="flex items-center gap-2 sm:gap-2.5">
								<button type="button" disabled={locked || home === 0} onclick={() => { home--; scheduleSave(); }}
									class="w-10 h-10 sm:w-9 sm:h-9 rounded-lg bg-canvas hover:bg-wire-hi disabled:opacity-25 text-fg text-base font-bold transition-colors cursor-pointer border border-wire active:scale-95 tabular-nums">−</button>
								<span class="text-4xl font-bold text-fg w-10 sm:w-12 text-center tabular-nums" style="font-family: var(--font-display)">{home}</span>
								<button type="button" disabled={locked || home >= 20} onclick={() => { home++; scheduleSave(); }}
									class="w-10 h-10 sm:w-9 sm:h-9 rounded-lg bg-canvas hover:bg-wire-hi disabled:opacity-25 text-fg text-base font-bold transition-colors cursor-pointer border border-wire active:scale-95 tabular-nums">+</button>
							</div>
							<input type="hidden" name="predicted_home" value={home} />
						</div>

						<span class="text-2xl text-faint font-bold mt-4" style="font-family: var(--font-display)">–</span>

						<div class="text-center">
							<p class="text-xs text-muted mb-3">{teamLabel(data.match.away_team)}</p>
							<div class="flex items-center gap-2 sm:gap-2.5">
								<button type="button" disabled={locked || away === 0} onclick={() => { away--; scheduleSave(); }}
									class="w-10 h-10 sm:w-9 sm:h-9 rounded-lg bg-canvas hover:bg-wire-hi disabled:opacity-25 text-fg text-base font-bold transition-colors cursor-pointer border border-wire active:scale-95 tabular-nums">−</button>
								<span class="text-4xl font-bold text-fg w-10 sm:w-12 text-center tabular-nums" style="font-family: var(--font-display)">{away}</span>
								<button type="button" disabled={locked || away >= 20} onclick={() => { away++; scheduleSave(); }}
									class="w-10 h-10 sm:w-9 sm:h-9 rounded-lg bg-canvas hover:bg-wire-hi disabled:opacity-25 text-fg text-base font-bold transition-colors cursor-pointer border border-wire active:scale-95 tabular-nums">+</button>
							</div>
							<input type="hidden" name="predicted_away" value={away} />
						</div>
					</div>

					{#if !locked}
						{#if data.match.odds_home && data.match.odds_draw && data.match.odds_away}
							{@const outcome = Math.sign(home - away)}
							{@const oddsUsed = outcome > 0 ? data.match.odds_home : outcome === 0 ? data.match.odds_draw : data.match.odds_away}
							<p class="text-xs text-center text-faint mb-4">
								{t('match_exact_score')} <span class="text-accent font-semibold">{((oddsUsed ?? 1) * 3).toFixed(2)} {t('match_pts')}</span>
								· {t('match_winner')} <span class="text-muted">{((oddsUsed ?? 1) * 1).toFixed(2)} {t('match_pts')}</span>
							</p>
						{/if}
						<!-- Auto-save status — replaces the old explicit submit button -->
						<div class="min-h-[2rem] flex items-center justify-center text-sm" aria-live="polite">
							{#if saveStatus === 'saving'}
								<span class="text-faint flex items-center gap-2">
									<span class="w-1.5 h-1.5 rounded-full bg-accent animate-pulse"></span>
									{t('saving')}
								</span>
							{:else if saveStatus === 'saved' || (saveStatus === 'idle' && data.userPronostic)}
								<span class="flex items-center gap-1.5 font-medium" style="color: var(--color-success)">
									<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" aria-hidden="true">
										<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
									</svg>
									{t('match_autosaved')}
								</span>
							{:else if saveStatus === 'error'}
								<span class="text-err text-xs">{form?.error ?? t('match_save_error')}</span>
							{:else}
								<span class="text-xs text-faint">{t('match_autosave_hint')}</span>
							{/if}
						</div>
					{:else}
						<!-- Locked, but had/has a pick — picker is read-only above; just acknowledge -->
						<p class="text-center text-sm text-faint">{t('match_picks_closed')}</p>
					{/if}
				</form>
			{:else if locked}
				<!-- Locked AND no pick on record — the user missed it -->
				<div class="text-center py-2">
					<p class="text-sm text-fg font-semibold mb-1">{t('match_missed_lock')}</p>
					<p class="text-xs text-faint">{t('match_missed_lock_hint')}</p>
				</div>
			{:else}
				<p class="text-sm text-faint text-center">{t('match_no_pick')}</p>
			{/if}
		</section>
	{:else}
		<section class="border-t border-wire pt-6 text-center">
			<p class="text-muted mb-3">{t('match_login_to_pick')}</p>
			<a href="/auth/login" class="inline-block rounded-lg bg-accent hover:bg-accent-hi px-5 py-2 text-sm font-semibold text-canvas transition-colors">
				{t('login_cta')}
			</a>
		</section>
	{/if}

	<!-- Pronostics list — visible to everyone once the match is locked -->
	{#if data.allPronostics && data.allPronostics.length > 0}
		<section class="border-t border-wire pt-6">
			<div class="mb-3 space-y-2.5">
				<h2 class="text-base font-bold text-fg uppercase tracking-widest text-xs flex items-baseline gap-2">
					{t('match_pronostics')} <span class="text-faint font-normal tabular-nums normal-case tracking-normal">{visiblePronostics().length}</span>
				</h2>
				<!-- Tabs: Tous | each league | Amis — horizontally swipeable on mobile -->
				{#if data.user && ((data.friendIds ?? []).length > 0 || (data.myLeagues ?? []).length > 0)}
					<FilterCarousel compact items={pronoFilterItems} active={pronoFilter} onpick={(id) => (pronoFilter = id)} />
				{/if}
			</div>

			<div class="-mx-4 sm:mx-0 sm:rounded-xl sm:bg-panel/40 sm:border sm:border-wire overflow-hidden border-y border-wire sm:border-y-0">
				{#if visiblePronostics().length === 0}
					<p class="px-4 py-6 text-sm text-faint text-center">{t('match_no_friend_picks')}</p>
				{:else}
					{#each visiblePronostics() as p, i (p.user_id)}
						{@const me = isMe(p.user_id)}
						{@const friend = isFriend(p.user_id)}
						{@const badge = isScoredView && p.is_scored ? rowBadge(p.points_earned, p.predicted_home, p.predicted_away) : null}
						<a href="/profile/{p.user_id}"
							class="flex items-center gap-3 px-4 py-3 border-b border-wire/40 last:border-0 transition-colors
								{me ? 'bg-accent-lo/60 hover:bg-accent-lo' : 'hover:bg-raised'}">

							<!-- Rank — only meaningful once the match is scored -->
							{#if isScoredView}
								<span class="text-xs text-faint w-5 tabular-nums shrink-0">{i + 1}</span>
							{/if}

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
								{#if me}<span class="text-faint font-normal ml-1 text-xs">{t('match_me_label')}</span>{/if}
							</span>

							<!-- Team bonus chip: rendered BEFORE the prediction so it doesn't look
							     like it's adding to the prediction-points number on the right. -->
							{#if data.matchBonus && (p.profiles as any)?.favorite_team === data.matchBonus.winnerTeam}
								<span class="inline-flex items-baseline gap-1 text-[10px] font-semibold tabular-nums shrink-0"
									style="color: var(--color-bonus)"
									title="{teamLabel(data.matchBonus.winnerTeam)} a gagné — bonus pour les supporters">
									<span class="uppercase tracking-widest text-[9px] opacity-80">{t('match_team_bonus_chip')}</span>
									+{data.matchBonus.amount.toFixed(2)}
								</span>
							{/if}

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

							<!-- Points — dash until the match is scored -->
							{#if isScoredView}
								<span class="font-bold tabular-nums w-14 text-right shrink-0 {badge === 'exact' ? 'text-accent' : badge === 'correct' ? 'text-fg' : 'text-faint'}"
									style="font-family: var(--font-display)">
									{p.is_scored ? (p.points_earned?.toFixed(2) ?? '0.00') : '—'}
								</span>
							{/if}
						</a>
					{/each}
				{/if}
			</div>
		</section>
	{/if}
</div>
