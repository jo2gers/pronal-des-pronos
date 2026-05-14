<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { formatDate, groupByDay } from '$lib/utils';
	import { STAGE_LABELS_FR, STAGE_LABELS_EN, teamLabel } from '$lib/wc2026';
	import { t, getLang } from '$lib/i18n.svelte';
	import Flag from '$lib/components/Flag.svelte';
	import MatchPickRow from '$lib/components/MatchPickRow.svelte';

	let { data } = $props();

	let liveMatches = $derived(data.liveMatches ?? []);
	let nextMatch   = $derived(data.nextMatch ?? null);

	// Auto-refresh every 30s while a match is live
	$effect(() => {
		if (!liveMatches.length) return;
		const interval = setInterval(() => invalidateAll(), 30_000);
		return () => clearInterval(interval);
	});

	// ── Countdown ────────────────────────────────────────────────────────────────
	function getCountdown(dt: string) {
		const diff = new Date(dt).getTime() - Date.now();
		if (diff <= 0) return null;
		return {
			days:  Math.floor(diff / 86400000),
			hours: Math.floor((diff % 86400000) / 3600000),
			mins:  Math.floor((diff % 3600000) / 60000),
			secs:  Math.floor((diff % 60000) / 1000)
		};
	}
	let countdown = $state(nextMatch ? getCountdown(nextMatch.match_datetime) : null);
	$effect(() => {
		const interval = setInterval(() => {
			countdown = nextMatch ? getCountdown(nextMatch.match_datetime) : null;
		}, 1000);
		return () => clearInterval(interval);
	});

	// Circular dial geometry
	const DIAL_RADIUS = 28;
	const DIAL_CIRC = 2 * Math.PI * DIAL_RADIUS;
	function dialOffset(value: number, max: number): number {
		const pct = Math.max(0, Math.min(1, value / max));
		return DIAL_CIRC * (1 - pct);
	}
</script>

<div class="space-y-8">

	<!-- ── Hero: circular countdown dials over a tinted canvas ───────────────── -->
	<section class="relative overflow-hidden rounded-2xl border border-wire bg-panel">
		<!-- Single subtle accent glow in top-right corner (purposeful, not decorative noise) -->
		<div class="pointer-events-none absolute -top-32 -right-24 w-96 h-96 rounded-full opacity-[0.07]"
			style="background: radial-gradient(closest-side, var(--color-accent), transparent 70%)" aria-hidden="true"></div>

		<div class="relative px-6 py-8 sm:px-10 sm:py-10">

			{#if liveMatches.length > 0}
				<!-- ── LIVE state ── -->
				<div class="flex items-center justify-center gap-2 mb-6">
					<span class="animate-pulse inline-block w-2 h-2 rounded-full bg-live"></span>
					<span class="text-live text-xs font-bold uppercase tracking-widest">{t('live_label')}</span>
				</div>
				<div class="grid gap-3 {liveMatches.length > 1 ? 'sm:grid-cols-2' : 'max-w-sm mx-auto'}">
					{#each liveMatches as match}
						<a href="/matches/{match.id}"
							class="rounded-xl bg-canvas border border-live/30 hover:border-live transition-colors px-4 py-5 text-center block">
							<p class="text-[11px] text-muted mb-3 uppercase tracking-widest">{(getLang() === 'fr' ? STAGE_LABELS_FR : STAGE_LABELS_EN)[match.stage] ?? match.stage}</p>
							<div class="flex items-center justify-between gap-3">
								<div class="flex-1 flex flex-col items-center">
									<Flag code={match.home_flag} size={48} alt={teamLabel(match.home_team)} class="mb-1.5" />
									<p class="text-sm font-semibold text-fg leading-tight">{teamLabel(match.home_team)}</p>
								</div>
								<div class="text-center shrink-0 px-3">
									<p class="text-4xl font-bold text-accent tabular-nums leading-none"
										style="font-family: var(--font-display)">
										{match.home_score ?? 0}<span class="text-muted text-2xl mx-1">–</span>{match.away_score ?? 0}
									</p>
									<span class="inline-block mt-2 rounded bg-live px-2 py-0.5 text-[10px] font-bold text-fg tracking-wider">LIVE</span>
								</div>
								<div class="flex-1 flex flex-col items-center">
									<Flag code={match.away_flag} size={48} alt={teamLabel(match.away_team)} class="mb-1.5" />
									<p class="text-sm font-semibold text-fg leading-tight">{teamLabel(match.away_team)}</p>
								</div>
							</div>
						</a>
					{/each}
				</div>

			{:else if nextMatch}
				<!-- ── COUNTDOWN state ── -->
				<p class="text-faint text-[10px] font-bold uppercase tracking-[0.25em] mb-6 text-center">{t('next_match')}</p>

				{#if countdown}
					<!-- Four circular dials -->
					<div class="flex justify-center gap-3 sm:gap-6 mb-6">
						{#each [
							{ v: countdown.days,  max: 30, label: t('days') },
							{ v: countdown.hours, max: 24, label: t('hours') },
							{ v: countdown.mins,  max: 60, label: t('mins') },
							{ v: countdown.secs,  max: 60, label: t('secs') }
						] as unit, i}
							<div class="relative flex flex-col items-center">
								<div class="relative w-[68px] h-[68px] sm:w-[88px] sm:h-[88px]">
									<svg viewBox="0 0 64 64" class="w-full h-full -rotate-90" aria-hidden="true">
										<!-- track -->
										<circle cx="32" cy="32" r={DIAL_RADIUS}
											fill="none" stroke="var(--color-wire)" stroke-width="3" />
										<!-- progress (filling clockwise) -->
										<circle cx="32" cy="32" r={DIAL_RADIUS}
											fill="none" stroke="var(--color-accent)" stroke-width="3"
											stroke-linecap="round"
											stroke-dasharray={DIAL_CIRC}
											stroke-dashoffset={dialOffset(unit.v, unit.max)}
											style="transition: stroke-dashoffset {i === 3 ? '0.3s' : '0.8s'} cubic-bezier(0.16, 1, 0.3, 1)" />
									</svg>
									<div class="absolute inset-0 flex items-center justify-center">
										<span class="text-2xl sm:text-4xl font-bold text-fg tabular-nums leading-none"
											style="font-family: var(--font-display)">
											{String(unit.v).padStart(2, '0')}
										</span>
									</div>
								</div>
								<span class="text-[10px] text-faint mt-2 uppercase tracking-widest">{unit.label}</span>
							</div>
						{/each}
					</div>
				{:else}
					<p class="text-3xl font-bold text-accent text-center mb-5" style="font-family: var(--font-display)">
						{t('kickoff')}
					</p>
				{/if}

				<!-- Teams + venue (single line, no decorative card) -->
				<div class="flex items-center justify-center gap-3 sm:gap-4">
					<div class="flex items-center gap-2 min-w-0">
						<Flag code={nextMatch.home_flag} size={36} />
						<span class="font-semibold text-fg truncate" style="font-family: var(--font-display); letter-spacing: 0.01em">
							{teamLabel(nextMatch.home_team)}
						</span>
					</div>
					<span class="text-faint text-xs uppercase tracking-widest">vs</span>
					<div class="flex items-center gap-2 min-w-0">
						<span class="font-semibold text-fg truncate" style="font-family: var(--font-display); letter-spacing: 0.01em">
							{teamLabel(nextMatch.away_team)}
						</span>
						<Flag code={nextMatch.away_flag} size={36} />
					</div>
				</div>
				<p class="text-[11px] text-faint mt-2 text-center">
					{formatDate(nextMatch.match_datetime)}{nextMatch.venue ? ` · ${nextMatch.venue}` : ''}
				</p>

			{:else}
				<p class="text-center text-muted py-4">{t('wc_over')}</p>
			{/if}

			{#if !data.user}
				<div class="mt-7 flex gap-3 justify-center flex-wrap">
					<a href="/auth/register" class="bg-accent hover:bg-accent-hi text-canvas font-bold px-6 py-2.5 rounded-lg transition-colors text-sm">
						{t('start_free')}
					</a>
					<a href="/auth/login" class="border border-wire text-muted hover:text-fg hover:border-wire-hi px-6 py-2.5 rounded-lg transition-colors text-sm">
						{t('login_cta')}
					</a>
				</div>
			{/if}
		</div>
	</section>

	<!-- ── User stats (single hairline strip, kept) ───────────────────────────── -->
	{#if data.user && data.stats}
		<div class="flex flex-wrap items-baseline gap-x-3 gap-y-1.5 px-1">
			<div class="flex items-baseline gap-1.5">
				<span class="text-sm text-faint">{t('your_rank')}</span>
				<span class="text-lg font-bold text-fg tabular-nums" style="font-family: var(--font-display)">
					#{data.stats.rank ?? '–'}
				</span>
			</div>
			<span class="text-wire-hi hidden sm:inline">·</span>
			<div class="flex items-baseline gap-1.5">
				<span class="text-sm text-faint">{t('points')}</span>
				<span class="text-lg font-bold text-accent tabular-nums" style="font-family: var(--font-display)">
					{data.stats.totalPoints.toFixed(2)}
				</span>
				{#if data.stats.teamBonus > 0}
					<a href="/rules" class="text-xs tabular-nums whitespace-nowrap hover:underline" style="color: var(--color-bonus)">
						+{data.stats.teamBonus.toFixed(2)} {t('team_bonus_short')}
					</a>
				{/if}
			</div>
			<span class="text-wire-hi hidden sm:inline">·</span>
			<div class="flex items-baseline gap-1.5">
				<span class="text-sm text-faint">{t('picks')}</span>
				<span class="text-lg font-bold text-fg tabular-nums" style="font-family: var(--font-display)">
					{data.stats.pronosticsCount}
				</span>
			</div>
			<a href="/leaderboard" class="ml-auto text-xs text-accent hover:text-accent-hi whitespace-nowrap transition-colors">
				{t('leaderboard_link')}
			</a>
		</div>
	{/if}

	<!-- ── Finished matches (hairline list) ───────────────────────────────────── -->
	{#if data.user && data.finishedMatches?.length}
		<section class="border-t border-wire pt-5">
			<h2 class="text-base font-semibold text-fg mb-3 px-1">{t('last_matches')}</h2>
			<div class="-mx-4 sm:mx-0 divide-y divide-wire/60 border-y border-wire sm:border sm:rounded-xl sm:bg-panel/40">
				{#each data.finishedMatches as match}
					<MatchPickRow {match}
						existingProno={data.pronosticsMap[match.id] ?? null}
						loggedIn={!!data.user} />
				{/each}
			</div>
		</section>
	{/if}

	<!-- ── Upcoming matches — inline-pick rows ────────────────────────────────── -->
	<section>
		<div class="flex items-baseline justify-between mb-4 px-1">
			<h2 class="text-base font-semibold text-fg" style="font-family: var(--font-display)">{t('upcoming_matches')}</h2>
			{#if !data.user}
				<a href="/auth/login" class="text-xs text-accent hover:text-accent-hi transition-colors">{t('login_to_pick')}</a>
			{/if}
		</div>

		{#if data.user && data.stats && data.stats.pronosticsCount === 0 && data.upcomingMatches?.length}
			<p class="mb-3 px-1 text-sm text-accent">{t('first_pick_hint')}</p>
		{/if}

		{#if data.upcomingMatches?.length}
			<div class="space-y-5">
				{#each groupByDay([...data.upcomingMatches], getLang()) as bucket (bucket.key)}
					<div>
						<div class="flex items-center gap-3 mb-2 px-1">
							<span class="flex-1 h-px bg-wire"></span>
							<span class="text-[11px] uppercase tracking-widest text-faint">{bucket.label}</span>
							<span class="flex-1 h-px bg-wire"></span>
						</div>
						<div class="-mx-4 sm:mx-0 divide-y divide-wire/60 border-y border-wire sm:border sm:rounded-xl sm:bg-panel/40">
							{#each bucket.items as match (match.id)}
								<MatchPickRow {match}
									existingProno={data.pronosticsMap[match.id] ?? null}
									loggedIn={!!data.user} />
							{/each}
						</div>
					</div>
				{/each}
			</div>
			<a href="/matches" class="mt-3 block text-right text-sm text-accent hover:text-accent-hi px-1">
				{t('view_all')}
			</a>
		{:else}
			<p class="text-muted text-sm px-1">{t('no_upcoming')}</p>
		{/if}
	</section>

</div>
