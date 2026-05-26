<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { formatDate, groupByDay, daysUntilMatch } from '$lib/utils';
	import { STAGE_LABELS_FR, STAGE_LABELS_EN, teamLabel } from '$lib/wc2026';
	import { t, getLang } from '$lib/i18n.svelte';
	import Flag from '$lib/components/Flag.svelte';
	import MatchPickRow from '$lib/components/MatchPickRow.svelte';

	let { data } = $props();

	let liveMatches = $derived(data.liveMatches ?? []);
	let nextMatch   = $derived(data.nextMatch ?? null);

	// Auto-refresh score data every 30s while a match is live, and bump the
	// match-minute clock to the same instant. Coupling them on purpose: the
	// minute badge should reflect "minute as of the score you're seeing",
	// not advance independently while the score sits stale.
	let liveNowMs = $state(Date.now());
	$effect(() => {
		if (!liveMatches.length) return;
		const interval = setInterval(async () => {
			await invalidateAll();
			liveNowMs = Date.now();
		}, 30_000);
		return () => clearInterval(interval);
	});

	function matchMinute(kickoffIso: string, now: number): string {
		const elapsedMin = Math.floor((now - new Date(kickoffIso).getTime()) / 60000);
		if (elapsedMin < 0)   return "0'";
		if (elapsedMin <= 45) return `${elapsedMin}'`;
		if (elapsedMin < 60)  return 'HT';
		if (elapsedMin < 105) return `${elapsedMin - 15}'`;
		return "90+'";
	}

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
				{@const sole = liveMatches.length === 1}
				<div class="grid gap-3 {sole ? '' : 'sm:grid-cols-2'}">
					{#each liveMatches as match}
						{@const prono = data.pronosticsMap[match.id]}
						{@const liveHome = match.home_score ?? 0}
						{@const liveAway = match.away_score ?? 0}
						{@const liveOutcome = Math.sign(liveHome - liveAway)}
						{@const predOutcome = prono ? Math.sign(prono.predicted_home - prono.predicted_away) : null}
						{@const safeOdds = (prono?.odds_used ?? 0) >= 1 ? prono!.odds_used! : 1.0}
						{@const livePotential = prono
							? (prono.predicted_home === liveHome && prono.predicted_away === liveAway
								? { pts: 3 * safeOdds, label: 'exact' }
								: predOutcome === liveOutcome
									? { pts: 1 * safeOdds, label: 'winner' }
									: { pts: 0, label: 'missed' })
							: null}
						{@const stageLabel = (getLang() === 'fr' ? STAGE_LABELS_FR : STAGE_LABELS_EN)[match.stage] ?? match.stage}
						{@const stageLabelFull = match.group_label
							? `${stageLabel} · ${getLang() === 'fr' ? 'Groupe' : 'Group'} ${match.group_label}`
							: stageLabel}
						<a href="/matches/{match.id}"
							class="rounded-xl bg-canvas border border-live/30 hover:border-live transition-colors {sole ? 'px-6 py-8 sm:py-10' : 'px-4 py-5'} text-center block">
							<p class="{sole ? 'text-xs' : 'text-[11px]'} text-muted mb-4 uppercase tracking-widest">{stageLabelFull}</p>
							<div class="flex items-center justify-center gap-4 sm:gap-8">
								<div class="flex-1 flex flex-col items-center max-w-[40%]">
									<Flag code={match.home_flag} size={sole ? 80 : 48} alt={teamLabel(match.home_team)} class="mb-2" />
									<p class="{sole ? 'text-base sm:text-lg' : 'text-sm'} font-semibold text-fg leading-tight truncate max-w-full">{teamLabel(match.home_team)}</p>
								</div>
								<div class="text-center shrink-0 px-2">
									<p class="{sole ? 'text-6xl sm:text-7xl' : 'text-4xl'} font-bold text-accent tabular-nums leading-none flex items-center justify-center gap-2"
										style="font-family: var(--font-display)">
										<span>{liveHome}</span>
										<span class="{sole ? 'text-4xl sm:text-5xl' : 'text-2xl'} text-muted">–</span>
										<span>{liveAway}</span>
									</p>
									<span class="inline-flex items-center gap-1.5 mt-3 rounded bg-live px-2 py-0.5 {sole ? 'text-xs' : 'text-[10px]'} font-bold text-fg tracking-widest">
										<span class="w-1 h-1 rounded-full bg-fg/80 animate-pulse"></span>
										LIVE
										<span class="opacity-80">·</span>
										<span class="tabular-nums">{matchMinute(match.match_datetime, liveNowMs)}</span>
									</span>
								</div>
								<div class="flex-1 flex flex-col items-center max-w-[40%]">
									<Flag code={match.away_flag} size={sole ? 80 : 48} alt={teamLabel(match.away_team)} class="mb-2" />
									<p class="{sole ? 'text-base sm:text-lg' : 'text-sm'} font-semibold text-fg leading-tight truncate max-w-full">{teamLabel(match.away_team)}</p>
								</div>
							</div>

							<!-- Live points preview: what the user would win if the score holds. -->
							{#if prono && livePotential}
								<div class="mt-4 pt-3 border-t border-live/20 flex items-center justify-center gap-2 text-xs tabular-nums">
									<span class="text-faint">{t('live_pick_label')}</span>
									<span class="font-semibold {livePotential.label === 'exact' ? 'text-accent' : livePotential.label === 'winner' ? 'text-fg' : 'text-muted'}">
										{prono.predicted_home}–{prono.predicted_away}
									</span>
									<span class="text-wire-hi">→</span>
									<span class="font-bold tabular-nums {livePotential.label === 'exact' ? 'text-accent' : livePotential.label === 'winner' ? 'text-fg' : 'text-faint'}">
										{livePotential.pts > 0 ? '+' : ''}{livePotential.pts.toFixed(2)} {t('match_pts')}
									</span>
									<span class="text-[10px] uppercase tracking-widest text-faint">
										{livePotential.label === 'exact' ? t('match_score_exact') : livePotential.label === 'winner' ? t('match_winner_ok') : t('match_missed')}
									</span>
								</div>
							{/if}
						</a>
					{/each}
				</div>

			{:else if nextMatch}
				<!-- ── COUNTDOWN state ── -->
				<p class="text-faint text-[10px] font-bold uppercase tracking-[0.25em] mb-6 text-center">{t('next_match')}</p>

				{#if countdown}
					{@const totalMinsToKickoff = countdown.days * 24 * 60 + countdown.hours * 60 + countdown.mins}
					{@const useDials = totalMinsToKickoff < 24 * 60}
					{#if useDials}
						<!-- Final-24h state: full animated dials (high anticipation) -->
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
						<!-- Pre-24h state: single bold "J-N" line, no animation, saves battery -->
						<p class="text-center mb-6">
							<span class="text-7xl sm:text-8xl font-bold text-accent tabular-nums leading-none"
								style="font-family: var(--font-display); letter-spacing: 0.02em">
								J−{countdown.days}
							</span>
						</p>
					{/if}
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

	<!-- ── User stats · editorial big-number grid (design-system aligned) ──── -->
	{#if data.user && data.stats}
		<section class="border-t border-wire/40 pt-6">
			<div class="flex items-baseline justify-between mb-4 px-1">
				<span class="text-[11px] uppercase tracking-[0.1em] text-faint" style="font-family: var(--font-mono)">
					{t('your_rank')}
				</span>
				<a href="/leaderboard" class="text-[11px] uppercase tracking-[0.08em] text-muted hover:text-fg transition-colors"
					style="font-family: var(--font-mono)">
					{t('leaderboard_link')}
				</a>
			</div>
			<div class="grid grid-cols-3 gap-4 px-1">
				<div>
					<div class="text-3xl sm:text-4xl font-semibold text-fg tabular-nums leading-none"
						style="font-family: var(--font-display); letter-spacing: -0.03em">
						#{data.stats.rank ?? '–'}
					</div>
					<div class="text-[10px] sm:text-[11px] uppercase tracking-[0.08em] text-faint mt-2"
						style="font-family: var(--font-mono)">
						{t('your_rank')}
					</div>
				</div>
				<div>
					<div class="text-3xl sm:text-4xl font-semibold text-accent tabular-nums leading-none"
						style="font-family: var(--font-display); letter-spacing: -0.03em">
						{data.stats.totalPoints.toFixed(2)}
					</div>
					<div class="text-[10px] sm:text-[11px] uppercase tracking-[0.08em] text-faint mt-2 flex items-baseline gap-2"
						style="font-family: var(--font-mono)">
						<span>{t('points')}</span>
						{#if data.stats.teamBonus > 0}
							<a href="/rules" class="normal-case tracking-normal hover:underline" style="color: var(--color-bonus)">
								+{data.stats.teamBonus.toFixed(2)} {t('team_bonus_short')}
							</a>
						{/if}
					</div>
				</div>
				<div>
					<div class="text-3xl sm:text-4xl font-semibold text-fg tabular-nums leading-none"
						style="font-family: var(--font-display); letter-spacing: -0.03em">
						{data.stats.pronosticsCount}
					</div>
					<div class="text-[10px] sm:text-[11px] uppercase tracking-[0.08em] text-faint mt-2"
						style="font-family: var(--font-mono)">
						{t('picks')}
					</div>
				</div>
			</div>
		</section>
	{/if}

	<!-- ── Finished matches (hairline list) ───────────────────────────────────── -->
	{#if data.user && data.finishedMatches?.length}
		<section class="border-t border-wire pt-6">
			<div class="mb-4 px-1">
				<span class="text-[11px] uppercase tracking-[0.1em] text-faint" style="font-family: var(--font-mono)">
					{data.finishedMatches.length.toString().padStart(2, '0')} · {t('last_matches').toLowerCase()}
				</span>
				<h2 class="text-2xl sm:text-3xl font-semibold text-fg mt-1"
					style="font-family: var(--font-display); letter-spacing: -0.025em">
					{t('last_matches')}
				</h2>
			</div>
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
		<div class="flex items-end justify-between mb-4 px-1 gap-3 flex-wrap">
			<div>
				<span class="text-[11px] uppercase tracking-[0.1em] text-faint" style="font-family: var(--font-mono)">
					{(data.upcomingMatches?.length ?? 0).toString().padStart(2, '0')} · {t('upcoming_matches').toLowerCase()}
				</span>
				<h2 class="text-2xl sm:text-3xl font-semibold text-fg mt-1"
					style="font-family: var(--font-display); letter-spacing: -0.025em">
					{t('upcoming_matches')}
				</h2>
			</div>
			{#if !data.user}
				<a href="/auth/login" class="text-xs uppercase tracking-[0.08em] text-accent hover:text-accent-hi transition-colors"
					style="font-family: var(--font-mono)">{t('login_to_pick')}</a>
			{/if}
		</div>

		{#if data.user && data.stats && data.stats.pronosticsCount === 0 && data.upcomingMatches?.length}
			<p class="mb-3 px-1 text-sm text-accent">{t('first_pick_hint')}</p>
		{/if}

		{#if data.upcomingMatches?.length}
			<div class="space-y-5">
				{#each groupByDay([...data.upcomingMatches], getLang()) as bucket (bucket.key)}
					{@const countdown = daysUntilMatch(bucket.items[0].match_datetime, getLang())}
					<div>
						<div class="flex items-center gap-3 mb-2 px-1">
							<span class="flex-1 h-px bg-wire"></span>
							<span class="inline-flex items-center gap-2 text-[11px] uppercase tracking-widest">
								<span class="text-faint">{bucket.label}</span>
								{#if countdown}
									<span class="text-wire-hi">·</span>
									<span class="text-accent font-semibold tabular-nums">{countdown}</span>
								{/if}
							</span>
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
