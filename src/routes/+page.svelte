<script lang="ts">
	import { enhance } from '$app/forms';
	import { isoToFlag, formatDate, timeUntilMatch } from '$lib/utils';
	import { STAGE_LABELS } from '$lib/wc2026';
	import { supabase } from '$lib/supabase';
	import { t } from '$lib/i18n.svelte';

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
			savedIds = new Set([...savedIds, id]);
			if (form.predicted_home != null && form.predicted_away != null) {
				scores[id] = { home: form.predicted_home as number, away: form.predicted_away as number };
			}
			if (openId === id) openId = null;
			setTimeout(() => { savedIds = new Set([...savedIds].filter((x) => x !== id)); }, 3000);
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

	// ── Realtime ─────────────────────────────────────────────────────────────────
	$effect(() => {
		const channel = supabase
			.channel('homepage-matches')
			.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches' }, (payload) => {
				const m = payload.new as typeof liveMatches[number];
				if (m.status === 'live') {
					const idx = liveMatches.findIndex((x) => x.id === m.id);
					if (idx >= 0) liveMatches[idx] = m; else liveMatches = [...liveMatches, m];
					if (nextMatch?.id === m.id) nextMatch = null;
				} else if (m.status === 'finished') {
					liveMatches = liveMatches.filter((x) => x.id !== m.id);
				}
			})
			.subscribe();
		return () => { supabase.removeChannel(channel); };
	});

	// ── Urgency + pickability ────────────────────────────────────────────────────
	function urgency(match: Match) {
		if (match.status !== 'upcoming') return 'none';
		const ms = new Date(match.match_datetime).getTime() - Date.now();
		if (ms <= 0) return 'none';
		if (ms < 2 * 3600000)  return 'locked';
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
						<p class="text-xs text-muted mb-3 uppercase tracking-wide">{STAGE_LABELS[match.stage] ?? match.stage}</p>
						<div class="flex items-center justify-between gap-3">
							<div class="flex-1 text-center">
								<div class="text-3xl mb-1">{isoToFlag(match.home_flag)}</div>
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
								<div class="text-3xl mb-1">{isoToFlag(match.away_flag)}</div>
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
			<div class="flex items-center gap-2 min-w-0">
				<span class="text-xs text-faint uppercase tracking-widest shrink-0">{t('your_rank')}</span>
				<span class="text-lg font-bold text-fg tabular-nums" style="font-family: var(--font-display)">
					#{data.stats.rank ?? '–'}
				</span>
			</div>
			<span class="text-wire-hi">·</span>
			<div class="flex items-center gap-2 min-w-0">
				<span class="text-xs text-faint uppercase tracking-widest shrink-0">{t('points')}</span>
				<span class="text-lg font-bold text-accent tabular-nums" style="font-family: var(--font-display)">
					{data.stats.totalPoints.toFixed(1)}
				</span>
				{#if data.stats.teamBonus > 0}
					<a href="/rules" class="text-xs tabular-nums hover:underline" style="color: var(--color-bonus)">
						+{data.stats.teamBonus} équipe
					</a>
				{/if}
			</div>
			<span class="text-wire-hi">·</span>
			<div class="flex items-center gap-2 min-w-0">
				<span class="text-xs text-faint uppercase tracking-widest shrink-0">{t('picks')}</span>
				<span class="text-lg font-bold text-fg tabular-nums" style="font-family: var(--font-display)">
					{data.stats.pronosticsCount}
				</span>
			</div>
			<a href="/leaderboard" class="ml-auto text-xs text-accent hover:text-accent-hi shrink-0 transition-colors">
				{t('leaderboard_link')}
			</a>
		</div>
	{/if}

	<!-- Upcoming matches — accordion, same pattern as matches page -->
	<div>
		<div class="flex items-center justify-between mb-4">
			<h2 class="text-sm font-bold text-faint uppercase tracking-widest">{t('upcoming_matches')}</h2>
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
										<span class="text-[10px] text-faint/60 tracking-wider uppercase mt-0.5 block">Gr. {match.group_label}</span>
									{/if}
								</div>

								<!-- Away -->
								<div class="flex-1 min-w-0 text-right">
									<span class="text-sm font-medium text-fg truncate">{match.away_team}</span>
								</div>

								<!-- Trailing -->
								<div class="flex items-center gap-1.5 ml-1 shrink-0">
									{#if saved}
										<span class="text-xs font-semibold px-1.5 py-0.5 rounded"
											style="color: var(--color-success); background: oklch(from var(--color-success) l c h / 0.1)">✓</span>
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
										title="Détails du match">
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
			<p class="text-muted text-sm">Aucun match à venir.</p>
		{/if}
	</div>

</div>
