<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { formatDate, groupByDay, daysUntilMatch, liveClock, resolveOddsUsed } from '$lib/utils';
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

	// Real clock from Polymarket when available; kickoff-based estimate as the
	// fallback (first seconds of a match, before the first live poll lands).
	function matchMinute(match: { match_datetime: string; live_elapsed?: string | null; live_period?: string | null; last_score_sync_at?: string | null }, now: number): string {
		const real = liveClock(match.live_elapsed, match.live_period, getLang() as 'fr' | 'en', match.last_score_sync_at);
		if (real) return real;
		const elapsedMin = Math.floor((now - new Date(match.match_datetime).getTime()) / 60000);
		if (elapsedMin < 0)   return "0'";
		if (elapsedMin <= 45) return `${elapsedMin}'`;
		if (elapsedMin < 60)  return getLang() === 'fr' ? 'MT' : 'HT';
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

{#if !data.user && nextMatch && !liveMatches.length}
	<!-- ════════════════════════════════════════════════════════════════
	     LOGGED-OUT EDITORIAL HERO
	     Two-column pitch: headline + pitch + stats on the left,
	     prochain match card on the right. Mirrors the design canvas
	     "Accueil · public" artboard.
	     ════════════════════════════════════════════════════════════════ -->
	<section class="relative overflow-hidden -mx-4 sm:mx-0 px-4 sm:px-0 pt-8 pb-12 sm:pt-12 sm:pb-16">
		<!-- Faint stripe field — reads as stadium tifo banner -->
		<div aria-hidden class="pointer-events-none absolute inset-0"
			style="background-image: repeating-linear-gradient(0deg, transparent 0 38px, rgba(255,255,255,0.015) 38px 39px);
			       mask-image: radial-gradient(ellipse at 70% 0%, rgba(0,0,0,0.6), transparent 60%)"></div>

		<div class="relative grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-10 lg:gap-14 items-start">
			<!-- ── LEFT: headline · pitch · CTAs · stats ─────────────────── -->
			<div>
				<div class="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-wire bg-panel text-[10.5px] uppercase tracking-[0.06em]"
					style="font-family: var(--font-mono); color: var(--color-faint)">
					<span class="w-1.5 h-1.5 rounded-full bg-accent"></span>
					{t('pitch_chip')}
				</div>
				<h1 class="text-5xl sm:text-6xl lg:text-7xl xl:text-[84px] font-bold mt-7 leading-[0.95]"
					style="font-family: var(--font-display); letter-spacing: -0.045em; text-wrap: pretty">
					{t('pitch_h1_l1')}<br/>
					{t('pitch_h1_l2')}<br/>
					<span class="text-faint">{t('pitch_h1_l3')}</span>
				</h1>
				<p class="text-[17px] leading-[1.5] text-muted max-w-[520px] mt-7">
					{t('pitch_body')}
				</p>

				<div class="flex gap-3 mt-9 flex-wrap">
					<a href="/auth/register"
						class="inline-flex items-center gap-2 rounded-full bg-accent hover:bg-accent-hi px-5 py-3.5 text-sm font-medium text-canvas transition-colors">
						{t('pitch_cta')}
						<span aria-hidden="true">→</span>
					</a>
					<a href="/rules"
						class="inline-flex items-center rounded-full border border-wire-hi hover:bg-panel px-5 py-3.5 text-sm font-medium text-fg transition-colors">
						{t('pitch_rules')}
					</a>
				</div>

				<!-- Stats strip · 104 · 48 · 16 — centered on phones, editorial
				     left-align from sm up -->
				<div class="grid grid-cols-3 gap-0 mt-16 pt-6 border-t border-wire/60">
					{#each [['104', t('pitch_stat_matches')], ['48', t('pitch_stat_teams')], ['16', t('pitch_stat_cities')]] as [n, label]}
						<div class="text-center sm:text-left">
							<div class="text-3xl sm:text-4xl lg:text-5xl font-semibold tabular-nums leading-none"
								style="font-family: var(--font-display); letter-spacing: -0.03em">{n}</div>
							<div class="text-[10px] sm:text-[11px] uppercase tracking-[0.08em] text-faint mt-2"
								style="font-family: var(--font-mono)">{label}</div>
						</div>
					{/each}
				</div>
			</div>

			<!-- ── RIGHT: next match card ───────────────────────────────── -->
			<aside class="rounded-2xl border border-wire bg-panel p-6 sm:p-7">
				<div class="flex items-center justify-between mb-8">
					<span class="text-[10.5px] uppercase tracking-[0.08em] text-faint"
						style="font-family: var(--font-mono)">
						<!-- "Opening match" only while nothing has been played yet -->
						{(data.finishedMatches?.length ?? 0) === 0 && liveMatches.length === 0
							? t('card_match_opener')
							: t('next_match')}{nextMatch.group_label ? ` · ${t('card_group')} ${nextMatch.group_label}` : ''}
					</span>
					{#if countdown}
						<span class="inline-flex items-center px-2 py-0.5 rounded-full bg-accent text-canvas text-[11px] font-bold tabular-nums"
							style="font-family: var(--font-mono); letter-spacing: 0.04em">
							J−{countdown.days}
						</span>
					{/if}
				</div>

				<div class="grid grid-cols-[1fr_auto_1fr] items-start gap-3 sm:gap-4">
					<a href="/teams/{encodeURIComponent(nextMatch.home_team)}"
						class="flex flex-col items-center gap-3 min-w-0 hover:opacity-80 transition-opacity">
						<Flag code={nextMatch.home_flag} size={64} alt={teamLabel(nextMatch.home_team)} />
						<div class="text-base sm:text-lg font-semibold text-center truncate max-w-full"
							style="font-family: var(--font-display); letter-spacing: -0.02em">
							{teamLabel(nextMatch.home_team)}
						</div>
					</a>
					<div class="text-center px-1.5 self-center">
						<div class="text-2xl sm:text-3xl text-faint tabular-nums leading-none"
							style="font-family: var(--font-display); letter-spacing: -0.02em">—</div>
						<div class="text-[10.5px] uppercase tracking-[0.1em] text-faint mt-1"
							style="font-family: var(--font-mono)">VS</div>
					</div>
					<a href="/teams/{encodeURIComponent(nextMatch.away_team)}"
						class="flex flex-col items-center gap-3 min-w-0 hover:opacity-80 transition-opacity">
						<Flag code={nextMatch.away_flag} size={64} alt={teamLabel(nextMatch.away_team)} />
						<div class="text-base sm:text-lg font-semibold text-center truncate max-w-full"
							style="font-family: var(--font-display); letter-spacing: -0.02em">
							{teamLabel(nextMatch.away_team)}
						</div>
					</a>
				</div>

				<!-- Footer info row: kickoff · venue -->
				<div class="grid grid-cols-2 gap-4 mt-8 pt-5 border-t border-wire/60">
					<div>
						<div class="text-[10px] uppercase tracking-[0.08em] text-faint"
							style="font-family: var(--font-mono)">{t('card_kickoff')}</div>
						<div class="text-sm mt-1 tabular-nums" style="font-family: var(--font-mono)">
							{formatDate(nextMatch.match_datetime, getLang())}
						</div>
					</div>
					{#if nextMatch.venue}
						<div>
							<div class="text-[10px] uppercase tracking-[0.08em] text-faint"
								style="font-family: var(--font-mono)">{t('card_venue')}</div>
							<div class="text-sm mt-1" style="font-family: var(--font-mono)">{nextMatch.venue}</div>
						</div>
					{/if}
				</div>

				<a href="/matches/{nextMatch.id}"
					class="block mt-6 w-full text-center rounded-full bg-accent hover:bg-accent-hi px-5 py-3.5 text-sm font-medium text-canvas transition-colors">
					{t('card_pick_this')} →
				</a>
			</aside>
		</div>
	</section>
{:else}

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
						{@const safeOdds = prono ? resolveOddsUsed(prono.predicted_home, prono.predicted_away, match) : 1.0}
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
							class="rounded-xl bg-canvas border border-live/30 hover:border-live transition-colors {sole ? 'px-6 py-8 sm:py-10' : 'px-4 py-5'} text-center block min-w-0 overflow-hidden">
							<p class="{sole ? 'text-xs' : 'text-[11px]'} text-muted mb-4 uppercase tracking-widest">{stageLabelFull}</p>
							<div class="flex items-center justify-center gap-4 sm:gap-8">
								<div class="flex-1 min-w-0 flex flex-col items-center max-w-[40%]">
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
										<span class="tabular-nums">{matchMinute(match, liveNowMs)}</span>
									</span>
								</div>
								<div class="flex-1 min-w-0 flex flex-col items-center max-w-[40%]">
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
						<!-- Final-24h state: animated dials. Two units max — hours+minutes
						     while hours remain, minutes+seconds inside the final hour. -->
						{@const dialUnits = countdown.hours > 0
							? [
								{ v: countdown.hours, max: 24, label: t('hours'), fast: false },
								{ v: countdown.mins,  max: 60, label: t('mins'),  fast: false }
							]
							: [
								{ v: countdown.mins,  max: 60, label: t('mins'), fast: false },
								{ v: countdown.secs,  max: 60, label: t('secs'), fast: true }
							]}
						<div class="flex justify-center gap-3 sm:gap-6 mb-6">
							{#each dialUnits as unit (unit.label)}
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
												style="transition: stroke-dashoffset {unit.fast ? '0.3s' : '0.8s'} cubic-bezier(0.16, 1, 0.3, 1)" />
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

				<!-- Teams + venue (single line, no decorative card). flex-1 basis-0
				     gives each side an EQUAL half: a long name ("Bosnia and
				     Herzegovina") truncates on its own side instead of squeezing
				     the short name opposite it out of existence. -->
				<div class="flex items-center justify-center gap-3 sm:gap-4">
					<a href="/teams/{encodeURIComponent(nextMatch.home_team)}"
						class="flex flex-1 basis-0 items-center justify-end gap-2 min-w-0 hover:opacity-80 transition-opacity">
						<Flag code={nextMatch.home_flag} size={36} />
						<span class="font-semibold text-fg truncate" style="font-family: var(--font-display); letter-spacing: 0.01em">
							{teamLabel(nextMatch.home_team)}
						</span>
					</a>
					<span class="text-faint text-xs uppercase tracking-widest shrink-0">vs</span>
					<a href="/teams/{encodeURIComponent(nextMatch.away_team)}"
						class="flex flex-1 basis-0 items-center gap-2 min-w-0 hover:opacity-80 transition-opacity">
						<span class="font-semibold text-fg truncate" style="font-family: var(--font-display); letter-spacing: 0.01em">
							{teamLabel(nextMatch.away_team)}
						</span>
						<Flag code={nextMatch.away_flag} size={36} />
					</a>
				</div>
				<p class="text-[11px] text-faint mt-2 text-center">
					{formatDate(nextMatch.match_datetime, getLang())}{nextMatch.venue ? ` · ${nextMatch.venue}` : ''}
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
{/if}

	<!-- ── User stats · editorial big-number grid (design-system aligned) ──── -->
	{#if data.user && data.stats}
		<section class="border-t border-wire/40 pt-6">
			<div class="flex items-baseline justify-between mb-4 px-1">
				<span class="text-[11px] uppercase tracking-[0.1em] text-faint" style="font-family: var(--font-mono)">
					{t('home_recap')}
				</span>
				<a href="/leaderboard" class="text-[11px] uppercase tracking-[0.08em] text-muted hover:text-fg transition-colors"
					style="font-family: var(--font-mono)">
					{t('leaderboard_link')}
				</a>
			</div>
			<!-- Centered on phones (full-width columns feel lopsided left-aligned);
			     back to editorial left alignment from sm up. -->
			<div class="grid grid-cols-3 gap-4 px-1">
				<div class="text-center sm:text-left">
					<div class="text-3xl sm:text-4xl font-semibold text-fg tabular-nums leading-none"
						style="font-family: var(--font-display); letter-spacing: -0.03em">
						#{data.stats.rank ?? '–'}
					</div>
					<div class="text-[10px] sm:text-[11px] uppercase tracking-[0.08em] text-faint mt-2"
						style="font-family: var(--font-mono)">
						{t('your_rank')}
					</div>
				</div>
				<div class="text-center sm:text-left">
					<div class="text-3xl sm:text-4xl font-semibold text-accent tabular-nums leading-none"
						style="font-family: var(--font-display); letter-spacing: -0.03em">
						{data.stats.totalPoints.toFixed(2)}
					</div>
					<div class="text-[10px] sm:text-[11px] uppercase tracking-[0.08em] text-faint mt-2 flex items-baseline gap-2 justify-center sm:justify-start"
						style="font-family: var(--font-mono)">
						<span>{t('points')}</span>
						{#if data.stats.teamBonus > 0}
							<a href="/rules" class="normal-case tracking-normal hover:underline" style="color: var(--color-bonus)">
								+{data.stats.teamBonus.toFixed(2)} {t('team_bonus_short')}
							</a>
						{/if}
					</div>
				</div>
				<div class="text-center sm:text-left">
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
