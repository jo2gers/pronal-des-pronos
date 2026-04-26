<script lang="ts">
	import { enhance } from '$app/forms';
	import { formatDate, timeUntilMatch } from '$lib/utils';
	import { STAGE_LABELS_FR, STAGE_LABELS_EN } from '$lib/wc2026';
	import { t, getLang } from '$lib/i18n.svelte';

	let { data, form } = $props();

	type Match = NonNullable<typeof data.matches>[number];

	// Which match's picker is open
	let openId = $state<string | null>(null);

	// Per-match score state — seeded from existing pronostics
	const scores = $state<Record<string, { home: number; away: number }>>(
		Object.fromEntries(
			(data.matches ?? []).map((m) => [
				m.id,
				{
					home: data.pronosticsMap[m.id]?.predicted_home ?? 0,
					away: data.pronosticsMap[m.id]?.predicted_away ?? 0
				}
			])
		)
	);

	// Track which matches have been saved this session (for inline ✓)
	let savedIds = $state<Set<string>>(new Set());
	// Track which match is currently submitting
	let submittingId = $state<string | null>(null);
	// Tab filter
	let tab = $state<'upcoming' | 'ended'>('upcoming');

	// If a save just succeeded, mark it and close the picker
	$effect(() => {
		if (form?.success && form?.match_id) {
			const id = form.match_id as string;
			savedIds.add(id);
			if (form.predicted_home != null && form.predicted_away != null) {
				scores[id] = {
					home: form.predicted_home as number,
					away: form.predicted_away as number
				};
			}
			if (openId === id) openId = null;
			setTimeout(() => { savedIds.delete(id); }, 3000);
		}
	});

	const grouped = $derived(() => {
		const stageOrder = ['group', 'round_of_32', 'round_of_16', 'quarters', 'semis', 'third', 'final'];
		const map = new Map<string, Match[]>();
		for (const m of data.matches ?? []) {
			const isEnded = m.status === 'finished';
			if (tab === 'ended' ? !isEnded : isEnded) continue;
			if (!map.has(m.stage)) map.set(m.stage, []);
			map.get(m.stage)!.push(m);
		}
		return stageOrder.flatMap((s) => {
			const matches = map.get(s);
			if (!matches) return [];
			return [{ stage: s, matches }];
		});
	});

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

<div class="space-y-10">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold text-fg" style="font-family: var(--font-display); letter-spacing: 0.02em">
			{t('nav_matches')}
		</h1>
		{#if !data.user}
			<a href="/auth/login" class="text-sm text-accent hover:text-accent-hi transition-colors">
				{t('login_to_pick')}
			</a>
		{/if}
	</div>

	<!-- Tabs -->
	<div class="flex gap-1 rounded-lg bg-raised border border-wire p-1 w-fit">
		<button
			onclick={() => tab = 'upcoming'}
			class="rounded px-4 py-1.5 text-sm font-medium transition-colors cursor-pointer {tab === 'upcoming' ? 'bg-panel text-fg shadow-sm' : 'text-muted hover:text-fg'}">
			{t('upcoming')}
		</button>
		<button
			onclick={() => tab = 'ended'}
			class="rounded px-4 py-1.5 text-sm font-medium transition-colors cursor-pointer {tab === 'ended' ? 'bg-panel text-fg shadow-sm' : 'text-muted hover:text-fg'}">
			{t('ended')}
		</button>
	</div>

	{#if data.user && tab === 'upcoming'}
		<p class="text-xs text-faint -mt-6">{t('click_to_pick')}</p>
	{/if}

	{#each grouped() as { stage, matches }, i}
		<section class="{i === 0 ? '' : 'border-t border-wire pt-8'}">
			<header class="flex items-baseline justify-between mb-4 px-1">
				<h2 class="text-base font-semibold text-fg" style="font-family: var(--font-display)">
					{(getLang() === 'fr' ? STAGE_LABELS_FR : STAGE_LABELS_EN)[stage] ?? stage}
				</h2>
				<span class="text-xs text-faint tabular-nums">{matches.length}</span>
			</header>

			<div class="-mx-4 sm:mx-0 divide-y divide-wire/60 border-y border-wire sm:border sm:rounded-xl sm:bg-panel/40 overflow-hidden">
				{#each matches as match}
					{@render matchEntry(match)}
				{/each}
			</div>
		</section>
	{/each}
</div>

{#snippet matchEntry(match: Match)}
	{@const u = urgency(match)}
	{@const pickable = isPickable(match)}
	{@const isOpen = openId === match.id}
	{@const saved = savedIds.has(match.id)}
	{@const hasProno = !!data.pronosticsMap[match.id] || saved}
	{@const sc = scores[match.id] ?? { home: 0, away: 0 }}

	<div>
		<!-- Match row -->
		<div
			role={pickable ? 'button' : undefined}
			tabindex={pickable ? 0 : undefined}
			onclick={() => pickable ? toggle(match) : undefined}
			onkeydown={(e) => e.key === 'Enter' || e.key === ' ' ? toggle(match) : undefined}
			class="px-4 py-3 transition-colors {pickable ? 'cursor-pointer hover:bg-raised' : ''} {isOpen ? 'bg-raised' : ''}">

			<div class="flex items-center gap-2">
				<!-- Home -->
				<div class="flex-1 min-w-0">
					<span class="text-sm font-medium text-fg truncate">{match.home_team}</span>
				</div>

				<!-- Centre: score / time / group -->
				<div class="text-center shrink-0 min-w-[96px]">
					{#if match.status === 'finished' && match.home_score != null}
						{@const prono = data.pronosticsMap[match.id]}
						{@const label = prono?.is_scored
							? (prono.predicted_home === match.home_score && prono.predicted_away === match.away_score
								? 'exact'
								: Math.sign(prono.predicted_home - prono.predicted_away) === Math.sign(match.home_score - match.away_score)
									? 'correct'
									: 'wrong')
							: null}
						<a href="/matches/{match.id}" onclick={(e) => e.stopPropagation()}
							class="font-bold text-fg tabular-nums hover:text-accent transition-colors"
							style="font-family: var(--font-display)">
							{match.home_score} – {match.away_score}
						</a>
						{#if prono}
							<span class="block tabular-nums text-xs mt-0.5
								{label === 'exact' ? 'text-accent font-bold' : label === 'correct' ? 'text-fg/70' : 'text-faint'}">
								{prono.predicted_home}–{prono.predicted_away}
								{#if prono.is_scored}
									· {prono.points_earned != null ? (prono.points_earned > 0 ? '+' : '') + Number(prono.points_earned).toFixed(2) : '–'}
								{/if}
							</span>
						{/if}
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
								u === 'locked'   ? 'text-faint' :
								'text-accent'
							}">{timeUntilMatch(match.match_datetime)}</span>
						{/if}
					{/if}
					{#if match.group_label}
						<span class="text-[10px] text-faint/60 mt-0.5 block">{t('group_short')} {match.group_label}</span>
					{/if}
				</div>

				<!-- Away -->
				<div class="flex-1 min-w-0 text-right">
					<span class="text-sm font-medium text-fg truncate">{match.away_team}</span>
				</div>

				<!-- Trailing indicators -->
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
					<!-- Always: link to match detail -->
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

		<!-- Inline picker (accordion) -->
		{#if isOpen}
			<div class="px-4 pb-4 pt-1 bg-raised border-t border-wire/60">
				{#if form?.error && form?.match_id === match.id}
					<p class="text-xs text-err mb-3">{form.error}</p>
				{/if}

				<form method="POST" action="?/pronostic" use:enhance={({ formData }) => {
					// Write current reactive values directly into formData — bypasses
					// any DOM flush timing issues with hidden inputs in Svelte 5.
					formData.set('match_id', match.id);
					formData.set('predicted_home', String(sc.home));
					formData.set('predicted_away', String(sc.away));
					submittingId = match.id;
					return async ({ update }) => {
						submittingId = null;
						await update({ reset: false });
					};
				}}>
					<!-- Fallback hidden inputs (also used for non-JS POST) -->
					<input type="hidden" name="match_id" value={match.id} />
					<input type="hidden" name="predicted_home" value={sc.home} />
					<input type="hidden" name="predicted_away" value={sc.away} />

					<div class="flex items-center justify-center gap-6 py-3">
						<!-- Home stepper -->
						<div class="flex flex-col items-center gap-2">
							<span class="text-xs text-muted">{match.home_team}</span>
							<div class="flex items-center gap-3">
								<button type="button" onclick={() => { if (sc.home > 0) sc.home-- }}
									disabled={sc.home === 0}
									class="w-9 h-9 rounded-full bg-panel hover:bg-wire-hi disabled:opacity-20 text-fg text-lg font-bold transition-colors cursor-pointer border border-wire">
									−
								</button>
								<span class="text-4xl font-bold text-fg w-10 text-center tabular-nums"
									style="font-family: var(--font-display); font-variant-numeric: tabular-nums">
									{sc.home}
								</span>
								<button type="button" onclick={() => { if (sc.home < 20) sc.home++ }}
									class="w-9 h-9 rounded-full bg-panel hover:bg-wire-hi text-fg text-lg font-bold transition-colors cursor-pointer border border-wire">
									+
								</button>
							</div>
						</div>

						<span class="text-xl text-faint font-bold mt-4"
							style="font-family: var(--font-display)">–</span>

						<!-- Away stepper -->
						<div class="flex flex-col items-center gap-2">
							<span class="text-xs text-muted">{match.away_team}</span>
							<div class="flex items-center gap-3">
								<button type="button" onclick={() => { if (sc.away > 0) sc.away-- }}
									disabled={sc.away === 0}
									class="w-9 h-9 rounded-full bg-panel hover:bg-wire-hi disabled:opacity-20 text-fg text-lg font-bold transition-colors cursor-pointer border border-wire">
									−
								</button>
								<span class="text-4xl font-bold text-fg w-10 text-center tabular-nums"
									style="font-family: var(--font-display); font-variant-numeric: tabular-nums">
									{sc.away}
								</span>
								<button type="button" onclick={() => { if (sc.away < 20) sc.away++ }}
									class="w-9 h-9 rounded-full bg-panel hover:bg-wire-hi text-fg text-lg font-bold transition-colors cursor-pointer border border-wire">
									+
								</button>
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
{/snippet}
