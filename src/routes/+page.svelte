<script lang="ts">
	import { enhance } from '$app/forms';
	import { formatDate, timeUntilMatch } from '$lib/utils';
	import { STAGE_LABELS_FR, STAGE_LABELS_EN } from '$lib/wc2026';
	import { t, getLang } from '$lib/i18n.svelte';

	let { data, form } = $props();

	type Match = NonNullable<typeof data.upcomingMatches>[number];

	let liveMatches = $state<typeof data.liveMatches>(data.liveMatches ?? []);
	let nextMatch   = $state<typeof data.nextMatch>(data.nextMatch ?? null);

	// ── Accordion state (mirrors matches page) ───────────────────────────────────
	let openId      = $state<string | null>(null);
	let submittingId = $state<string | null>(null);
	let savedIds    = $state<Set<string>>(new Set());

	const scores = $state<Record<string, { home: number; away: number }>>(
		Object.fromEntries(
			(data.upcomingMatches ?? []).map((m) => [
				m.id,
				{
					home: data.pronosticsMap[m.id]?.predicted_home ?? 0,
					away: data.pronosticsMap[m.id]?.predicted_away ?? 0
				}
			])
		)
	);

	$effect(() => {
		if (form?.success && form?.match_id) {
			const id = form.match_id as string;
			savedIds.add(id);
			if (form.predicted_home != null && form.predicted_away != null) {
				scores[id] = { home: form.predicted_home as number, away: form.predicted_away as number };
			}
			if (openId === id) openId = null;
			setTimeout(() => { savedIds.delete(id); }, 3000);
		}
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

	// ── Urgency + pickability ────────────────────────────────────────────────────
	function urgency(match: Match) {
		if (match.status !== 'upcoming') return 'none';
		const ms = new Date(match.match_datetime).getTime() - Date.now();
		if (ms <= 0) return 'none';
		if (ms < 5 * 60000)    return 'locked';
		if (ms < 6 * 3600000)  return 'critical';
		if (ms < 24 * 3600000) return 'warning';
		return 'normal';
	}
	function isPickable(match: Match) {
		return data.user && match.status === 'upcoming' && urgency(match) !== 'locked';
	}
	function toggle(match: Match) {
		if (!isPickable(match)) return;
		openId = openId === match.id ? null : match.id;
	}
</script>

<div class="space-y-8">

	<!-- Hero -->
	<div class="rounded-xl bg-panel border-t-2 border-t-accent px-6 py-8 sm:px-10">

		{#if liveMatches.length > 0}
			<div class="flex items-center justify-center gap-2 mb-5">
				<span class="animate-pulse inline-block w-2 h-2 rounded-full bg-live"></span>
				<span class="text-live text-xs font-bold uppercase tracking-widest">{t('live_label')}</span>
			</div>
			<div class="grid gap-3 {liveMatches.length > 1 ? 'sm:grid-cols-2' : 'max-w-sm mx-auto'}">
				{#each liveMatches as match}
					<a href="/matches/{match.id}"
						class="rounded-lg bg-canvas border border-live/30 hover:border-live transition-colors px-4 py-5 text-center block">
						<p class="text-xs text-muted mb-3">{(getLang() === 'fr' ? STAGE_LABELS_FR : STAGE_LABELS_EN)[match.stage] ?? match.stage}</p>
						<div class="flex items-center justify-between gap-3">
							<div class="flex-1 text-center">
								{#if match.home_flag}
									<img src="https://flagcdn.com/w40/{match.home_flag.toLowerCase()}.png"
										alt={match.home_team} class="w-10 h-7 object-cover rounded mx-auto mb-1" />
								{/if}
								<p class="text-sm font-semibold text-fg leading-tight">{match.home_team}</p>
							</div>
							<div class="text-center shrink-0 px-3">
								<p class="text-4xl font-bold text-accent tabular-nums leading-none"
									style="font-family: var(--font-display)">
									{match.home_score ?? 0}<span class="text-muted text-2xl mx-1">–</span>{match.away_score ?? 0}
								</p>
								<span class="inline-block mt-2 rounded bg-live px-2 py-0.5 text-xs font-bold text-fg tracking-wider">LIVE</span>
							</div>
							<div class="flex-1 text-center">
								{#if match.away_flag}
									<img src="https://flagcdn.com/w40/{match.away_flag.toLowerCase()}.png"
										alt={match.away_team} class="w-10 h-7 object-cover rounded mx-auto mb-1" />
								{/if}
								<p class="text-sm font-semibold text-fg leading-tight">{match.away_team}</p>
							</div>
						</div>
					</a>
				{/each}
			</div>

		{:else if nextMatch}
			<p class="text-muted text-xs font-bold uppercase tracking-widest mb-4 text-center">{t('next_match')}</p>
			{#if countdown}
				<div class="flex justify-center gap-2 sm:gap-8 mb-5">
					{#each [
						{ v: countdown.days,  label: t('days') },
						{ v: countdown.hours, label: t('hours') },
						{ v: countdown.mins,  label: t('mins') },
						{ v: countdown.secs,  label: t('secs') }
					] as unit}
						<div class="flex flex-col items-center min-w-[52px] sm:min-w-[72px]">
							<span class="text-4xl sm:text-6xl font-bold text-accent tabular-nums leading-none"
								style="font-family: var(--font-display)">
								{String(unit.v).padStart(2, '0')}
							</span>
							<span class="text-xs text-faint mt-2 uppercase tracking-widest">{unit.label}</span>
						</div>
					{/each}
				</div>
			{:else}
				<p class="text-3xl font-bold text-accent text-center mb-5" style="font-family: var(--font-display)">
					{t('kickoff')}
				</p>
			{/if}
			<div class="text-center">
				<p class="text-muted text-sm">
					<span class="font-medium text-fg">{nextMatch.home_team}</span>
					<span class="text-faint mx-2">vs</span>
					<span class="font-medium text-fg">{nextMatch.away_team}</span>
				</p>
				<p class="text-xs text-faint mt-1">{formatDate(nextMatch.match_datetime)}{nextMatch.venue ? ` · ${nextMatch.venue}` : ''}</p>
			</div>

		{:else}
			<p class="text-center text-muted py-4">{t('wc_over')}</p>
		{/if}

		{#if !data.user}
			<div class="mt-6 flex gap-3 justify-center flex-wrap">
				<a href="/auth/register" class="bg-accent hover:bg-accent-hi text-canvas font-bold px-6 py-2.5 rounded-lg transition-colors text-sm">
					{t('start_free')}
				</a>
				<a href="/auth/login" class="border border-wire text-muted hover:text-fg hover:border-wire-hi px-6 py-2.5 rounded-lg transition-colors text-sm">
					{t('login_cta')}
				</a>
			</div>
		{/if}
	</div>

	<!-- User stats -->
	{#if data.user && data.stats}
		<div class="flex items-center gap-3 px-1">
			<div class="flex items-baseline gap-1.5 min-w-0">
				<span class="text-sm text-faint shrink-0">{t('your_rank')}</span>
				<span class="text-lg font-bold text-fg tabular-nums" style="font-family: var(--font-display)">
					#{data.stats.rank ?? '–'}
				</span>
			</div>
			<span class="text-wire-hi">·</span>
			<div class="flex items-baseline gap-1.5 min-w-0">
				<span class="text-sm text-faint shrink-0">{t('points')}</span>
				<span class="text-lg font-bold text-accent tabular-nums" style="font-family: var(--font-display)">
					{data.stats.totalPoints.toFixed(2)}
				</span>
				{#if data.stats.teamBonus > 0}
					<a href="/rules" class="text-xs tabular-nums hover:underline" style="color: var(--color-bonus)">
						+{data.stats.teamBonus.toFixed(2)} {t('team_bonus_short')}
					</a>
				{/if}
			</div>
			<span class="text-wire-hi">·</span>
			<div class="flex items-baseline gap-1.5 min-w-0">
				<span class="text-sm text-faint shrink-0">{t('picks')}</span>
				<span class="text-lg font-bold text-fg tabular-nums" style="font-family: var(--font-display)">
					{data.stats.pronosticsCount}
				</span>
			</div>
			<a href="/leaderboard" class="ml-auto text-xs text-accent hover:text-accent-hi shrink-0 transition-colors">
				{t('leaderboard_link')}
			</a>
		</div>
	{/if}

	<!-- Finished matches — flat hairline list, full-bleed on mobile -->
	{#if data.user && data.finishedMatches?.length}
		<section class="border-t border-wire pt-5">
			<h2 class="text-base font-semibold text-fg mb-3 px-1">{t('last_matches')}</h2>

			{#if data.finishedMatches.length}
				<div class="-mx-4 sm:mx-0 divide-y divide-wire/60 border-y border-wire sm:border sm:rounded-xl sm:bg-panel/40">
					{#each data.finishedMatches as match}
						{@const prono = data.pronosticsMap[match.id]}
						{@const label = prono?.is_scored
							? (prono.predicted_home === match.home_score && prono.predicted_away === match.away_score
								? 'exact'
								: Math.sign(prono.predicted_home - prono.predicted_away) === Math.sign(match.home_score - match.away_score)
									? 'correct'
									: 'wrong')
							: null}

						<a href="/matches/{match.id}"
							class="px-4 py-3 flex items-center gap-2 hover:bg-raised/60 transition-colors group">
							<!-- Home -->
							<div class="flex-1 min-w-0">
								<span class="text-sm font-medium text-fg group-hover:text-accent transition-colors truncate">{match.home_team}</span>
							</div>

							<!-- Centre -->
							<div class="text-center shrink-0 min-w-[96px]">
								<span class="font-bold text-fg group-hover:text-accent transition-colors tabular-nums"
									style="font-family: var(--font-display)">
									{match.home_score} – {match.away_score}
								</span>
								{#if prono}
									<span class="block tabular-nums text-xs mt-0.5
										{label === 'exact' ? 'text-accent font-bold' : label === 'correct' ? 'text-fg/70' : 'text-faint'}">
										{prono.predicted_home}–{prono.predicted_away}
										{#if prono.is_scored}
											· {prono.points_earned != null ? (prono.points_earned > 0 ? '+' : '') + Number(prono.points_earned).toFixed(2) : '–'}
										{/if}
									</span>
								{/if}
							</div>

							<!-- Away -->
							<div class="flex-1 min-w-0 text-right">
								<span class="text-sm font-medium text-fg group-hover:text-accent transition-colors truncate">{match.away_team}</span>
							</div>
						</a>
					{/each}
				</div>
			{/if}
		</section>
	{/if}

	<!-- Upcoming matches — accordion, same pattern as matches page -->
	<div>
		<div class="flex items-baseline justify-between mb-4">
			<h2 class="text-base font-semibold text-fg" style="font-family: var(--font-display)">{t('upcoming_matches')}</h2>
			{#if data.user}
				<span class="text-xs text-faint">{t('click_to_pick')}</span>
			{:else}
				<a href="/auth/login" class="text-xs text-accent hover:text-accent-hi transition-colors">{t('login_to_pick')}</a>
			{/if}
		</div>

		{#if data.upcomingMatches?.length}
			<div class="rounded-xl bg-panel border border-wire overflow-hidden">
				{#each data.upcomingMatches as match}
					{@const u        = urgency(match)}
					{@const pickable = isPickable(match)}
					{@const isOpen   = openId === match.id}
					{@const saved    = savedIds.has(match.id)}
					{@const hasProno = !!data.pronosticsMap[match.id] || saved}
					{@const sc       = scores[match.id] ?? { home: 0, away: 0 }}

					<div class="border-b border-wire last:border-0">
						<!-- Row -->
						<div
							role={pickable ? 'button' : undefined}
							tabindex={pickable ? 0 : undefined}
							onclick={() => pickable ? toggle(match) : undefined}
							onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') ? toggle(match) : undefined}
							class="px-4 py-3 transition-colors {pickable ? 'cursor-pointer hover:bg-raised' : ''} {isOpen ? 'bg-raised' : ''}">

							<div class="flex items-center gap-2">
								<!-- Home -->
								<div class="flex-1 min-w-0">
									<span class="text-sm font-medium text-fg truncate">{match.home_team}</span>
								</div>

								<!-- Centre -->
								<div class="text-center shrink-0 min-w-[96px]">
									{#if match.status === 'finished' && match.home_score != null}
										<a href="/matches/{match.id}" onclick={(e) => e.stopPropagation()}
											class="font-bold text-fg tabular-nums hover:text-accent transition-colors"
											style="font-family: var(--font-display)">
											{match.home_score} – {match.away_score}
										</a>
									{:else if match.status === 'live'}
										<a href="/matches/{match.id}" onclick={(e) => e.stopPropagation()}
											class="inline-flex items-center gap-1 rounded bg-live px-2 py-0.5 text-xs font-bold text-fg">
											<span class="w-1.5 h-1.5 rounded-full bg-fg/80 animate-pulse"></span>
											LIVE
										</a>
									{:else}
										{#if hasProno}
											<span class="font-bold tabular-nums text-accent block"
												style="font-family: var(--font-display)">{sc.home} – {sc.away}</span>
											<span class="text-[11px] text-faint block mt-0.5">{formatDate(match.match_datetime)}</span>
										{:else}
											<span class="text-xs text-muted block">{formatDate(match.match_datetime)}</span>
											<span class="text-xs block mt-0.5 {
												u === 'critical' ? 'text-live font-semibold' :
												u === 'warning'  ? 'text-warn' :
												u === 'locked'   ? 'text-faint' : 'text-accent'
											}">{timeUntilMatch(match.match_datetime)}</span>
										{/if}
									{/if}
									{#if match.group_label}
										<span class="text-[10px] text-faint/60 mt-0.5 block">Gr. {match.group_label}</span>
									{/if}
								</div>

								<!-- Away -->
								<div class="flex-1 min-w-0 text-right">
									<span class="text-sm font-medium text-fg truncate">{match.away_team}</span>
								</div>

								<!-- Trailing -->
								<div class="flex items-center gap-1.5 ml-1 shrink-0">
									{#if saved}
										<span class="w-1.5 h-1.5 rounded-full shrink-0"
											style="background: var(--color-success)"></span>
									{:else if u === 'critical'}
										<span class="w-1.5 h-1.5 rounded-full bg-live animate-pulse"></span>
									{/if}
									{#if pickable}
										<svg class="w-3.5 h-3.5 text-faint transition-transform duration-200 {isOpen ? 'rotate-180' : ''}"
											fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
										</svg>
									{/if}
									<a href="/matches/{match.id}" onclick={(e) => e.stopPropagation()}
										class="w-6 h-6 flex items-center justify-center rounded text-faint hover:text-fg hover:bg-wire transition-colors"
										title={t('match_details_title')}>
										<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
												d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
										</svg>
									</a>
								</div>
							</div>
						</div>

						<!-- Accordion picker -->
						{#if isOpen}
							<div class="px-4 pb-4 pt-1 bg-raised border-t border-wire/60">
								{#if form?.error && form?.match_id === match.id}
									<p class="text-xs text-err mb-3">{form.error}</p>
								{/if}
								<form method="POST" action="?/pronostic" use:enhance={({ formData }) => {
									formData.set('match_id', match.id);
									formData.set('predicted_home', String(sc.home));
									formData.set('predicted_away', String(sc.away));
									submittingId = match.id;
									return async ({ update }) => {
										submittingId = null;
										await update({ reset: false });
									};
								}}>
									<input type="hidden" name="match_id"       value={match.id} />
									<input type="hidden" name="predicted_home" value={sc.home} />
									<input type="hidden" name="predicted_away" value={sc.away} />

									<div class="flex items-center justify-center gap-6 py-3">
										<!-- Home stepper -->
										<div class="flex flex-col items-center gap-2">
											<span class="text-xs text-muted">{match.home_team}</span>
											<div class="flex items-center gap-3">
												<button type="button" onclick={() => { if (sc.home > 0) sc.home--; }}
													disabled={sc.home === 0}
													class="w-9 h-9 rounded-full bg-panel hover:bg-wire-hi disabled:opacity-20 text-fg text-lg font-bold transition-colors cursor-pointer border border-wire">−</button>
												<span class="text-4xl font-bold text-fg w-10 text-center tabular-nums"
													style="font-family: var(--font-display)">{sc.home}</span>
												<button type="button" onclick={() => { if (sc.home < 20) sc.home++; }}
													class="w-9 h-9 rounded-full bg-panel hover:bg-wire-hi text-fg text-lg font-bold transition-colors cursor-pointer border border-wire">+</button>
											</div>
										</div>
										<span class="text-xl text-faint font-bold mt-4" style="font-family: var(--font-display)">–</span>
										<!-- Away stepper -->
										<div class="flex flex-col items-center gap-2">
											<span class="text-xs text-muted">{match.away_team}</span>
											<div class="flex items-center gap-3">
												<button type="button" onclick={() => { if (sc.away > 0) sc.away--; }}
													disabled={sc.away === 0}
													class="w-9 h-9 rounded-full bg-panel hover:bg-wire-hi disabled:opacity-20 text-fg text-lg font-bold transition-colors cursor-pointer border border-wire">−</button>
												<span class="text-4xl font-bold text-fg w-10 text-center tabular-nums"
													style="font-family: var(--font-display)">{sc.away}</span>
												<button type="button" onclick={() => { if (sc.away < 20) sc.away++; }}
													class="w-9 h-9 rounded-full bg-panel hover:bg-wire-hi text-fg text-lg font-bold transition-colors cursor-pointer border border-wire">+</button>
											</div>
										</div>
									</div>

									<!-- Odds — flat row, no nested surface -->
									{#if match.odds_home || match.odds_draw || match.odds_away}
										<div class="mb-4 pt-3 mt-1 border-t border-wire/60">
											<div class="flex items-baseline justify-between gap-3">
												<div class="flex-1 min-w-0">
													<p class="text-xs text-faint truncate">{match.home_team}</p>
													<p class="text-base font-bold text-accent tabular-nums" style="font-family: var(--font-display)">
														{match.odds_home?.toFixed(2) ?? '–'}
													</p>
												</div>
												<div class="text-center flex-1 min-w-0">
													<p class="text-xs text-faint">{t('match_draw')}</p>
													<p class="text-base font-bold text-accent tabular-nums" style="font-family: var(--font-display)">
														{match.odds_draw?.toFixed(2) ?? '–'}
													</p>
												</div>
												<div class="text-right flex-1 min-w-0">
													<p class="text-xs text-faint truncate">{match.away_team}</p>
													<p class="text-base font-bold text-accent tabular-nums" style="font-family: var(--font-display)">
														{match.odds_away?.toFixed(2) ?? '–'}
													</p>
												</div>
											</div>
										</div>
									{/if}

									<div class="flex gap-2 mt-1">
										<button type="button" onclick={() => openId = null}
											class="flex-none rounded-lg border border-wire px-4 py-2 text-sm text-muted hover:text-fg hover:border-wire-hi transition-colors cursor-pointer">
											{t('cancel')}
										</button>
										<button type="submit" disabled={submittingId === match.id}
											class="flex-1 rounded-lg bg-accent hover:bg-accent-hi disabled:opacity-50 px-4 py-2 text-sm font-bold text-canvas transition-colors cursor-pointer">
											{submittingId === match.id ? t('saving') : hasProno ? t('update') : t('save')}
										</button>
									</div>
								</form>
							</div>
						{/if}
					</div>
				{/each}
			</div>
			<a href="/matches" class="mt-3 block text-right text-sm text-accent hover:text-accent-hi">
				{t('view_all')}
			</a>
		{:else}
			<p class="text-muted text-sm">{t('no_upcoming')}</p>
		{/if}
	</div>

</div>
