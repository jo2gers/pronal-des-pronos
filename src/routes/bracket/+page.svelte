<script lang="ts">
	import { page } from '$app/state';
	import { goto, invalidateAll } from '$app/navigation';
	import { t, getLang } from '$lib/i18n.svelte';
	import { STAGE_LABELS_FR, STAGE_LABELS_EN } from '$lib/wc2026';
	import { roundShort } from '$lib/bracketMap';
	import BracketRow from '$lib/components/BracketRow.svelte';

	let { data } = $props();

	const stageLabels = $derived(getLang() === 'fr' ? STAGE_LABELS_FR : STAGE_LABELS_EN);

	// Active round lives in the URL (?r=…) so it survives a trip to a match page
	// and back, and is deep-linkable.
	const active = $derived(page.url.searchParams.get('r') ?? data.defaultRound);
	const activeRound = $derived(data.rounds.find((r) => r.stage === active) ?? data.rounds[0]);
	const allTBD = $derived((activeRound?.matches ?? []).every((m) => m.home_team === 'TBD'));

	function setRound(stage: string) {
		const url = new URL(page.url);
		url.searchParams.set('r', stage);
		// noScroll keeps the sticky stepper put; reset to top so a 16-card round
		// then a 1-card round never lands on blank space (iOS keeps window scroll).
		goto(url, { replaceState: true, keepFocus: true, noScroll: true }).then(() =>
			window.scrollTo({ top: 0 })
		);
	}

	// Refresh while a match in the visible round is live.
	$effect(() => {
		const hasLive = (activeRound?.matches ?? []).some((m) => m.status === 'live');
		if (!hasLive) return;
		const id = setInterval(() => invalidateAll(), 30_000);
		return () => clearInterval(id);
	});
</script>

<div class="max-w-2xl mx-auto space-y-4">
	<header class="flex items-baseline justify-between gap-3 flex-wrap">
		<h1 class="text-2xl font-bold text-fg" style="font-family: var(--font-display); letter-spacing: 0.02em">
			{t('bracket_title')}
		</h1>
		<p class="text-[11px] text-faint tabular-nums" style="font-family: var(--font-mono)">
			{data.decided}/{data.total} {t('bracket_decided')}
		</p>
	</header>

	<!-- Sticky round stepper. Solid bg (no blur) so text never bleeds through on
	     iOS rubber-band scroll. -->
	<div class="sticky top-14 z-20 -mx-4 px-4 py-2 bg-canvas border-b border-wire">
		<div class="flex gap-1 rounded-lg bg-raised border border-wire p-1">
			{#each data.rounds as r}
				{@const on = active === r.stage}
				<button onclick={() => setRound(r.stage)}
					class="flex-1 py-1.5 px-1 text-xs font-semibold rounded transition-colors cursor-pointer truncate
						{on ? 'bg-panel text-fg shadow-sm' : 'text-muted hover:text-fg'}">
					<span class="sm:hidden">{roundShort(r.stage)}</span>
					<span class="hidden sm:inline">{stageLabels[r.stage]}</span>
				</button>
			{/each}
		</div>
	</div>

	<!-- Round heading + pending note -->
	<div>
		<h2 class="text-base font-semibold text-fg">{stageLabels[active]}</h2>
		{#if allTBD}
			<p class="text-xs text-faint mt-0.5">{t('bracket_pending_note')}</p>
		{/if}
	</div>

	<!-- Match list -->
	<div class="-mx-4 sm:mx-0 sm:rounded-xl sm:border sm:border-wire overflow-hidden border-y border-wire sm:border-y-0 divide-y divide-wire/60">
		{#each activeRound.matches as m (m.id)}
			<BracketRow match={m} />
		{/each}
	</div>
</div>
