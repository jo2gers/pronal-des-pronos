<script lang="ts">
	import { page } from '$app/state';
	import { goto, invalidateAll } from '$app/navigation';
	import { t, getLang } from '$lib/i18n.svelte';
	import { STAGE_LABELS_FR, STAGE_LABELS_EN } from '$lib/wc2026';
	import { roundShort } from '$lib/bracketMap';
	import BracketRow from '$lib/components/BracketRow.svelte';
	import BracketTree from '$lib/components/BracketTree.svelte';

	let { data } = $props();

	const stageLabels = $derived(getLang() === 'fr' ? STAGE_LABELS_FR : STAGE_LABELS_EN);

	// List = round stepper; Tree = full connector bracket. Both URL-persisted.
	const view = $derived(page.url.searchParams.get('v') === 'tree' ? 'tree' : 'list');
	const active = $derived(page.url.searchParams.get('r') ?? data.defaultRound);
	const activeRound = $derived(data.rounds.find((r) => r.stage === active) ?? data.rounds[0]);
	const allTBD = $derived((activeRound?.matches ?? []).every((m) => m.home_team === 'TBD'));

	function setView(v: 'list' | 'tree') {
		const url = new URL(page.url);
		if (v === 'tree') url.searchParams.set('v', 'tree');
		else url.searchParams.delete('v');
		goto(url, { replaceState: true, keepFocus: true, noScroll: true });
	}

	function setRound(stage: string) {
		const url = new URL(page.url);
		url.searchParams.set('r', stage);
		goto(url, { replaceState: true, keepFocus: true, noScroll: true }).then(() =>
			window.scrollTo({ top: 0 })
		);
	}

	// Refresh while any knockout match is live (covers both views).
	const anyLive = $derived(data.rounds.some((r) => r.matches.some((m) => m.status === 'live')));
	$effect(() => {
		if (!anyLive) return;
		const id = setInterval(() => invalidateAll(), 30_000);
		return () => clearInterval(id);
	});
</script>

<div class="{view === 'tree' ? 'max-w-6xl' : 'max-w-2xl'} mx-auto space-y-4">
	<header class="flex items-baseline justify-between gap-3 flex-wrap">
		<h1 class="text-2xl font-bold text-fg" style="font-family: var(--font-display); letter-spacing: 0.02em">
			{t('bracket_title')}
		</h1>
		<p class="text-[11px] text-faint tabular-nums" style="font-family: var(--font-mono)">
			{data.decided}/{data.total} {t('bracket_decided')}
		</p>
	</header>

	<!-- List / Tree view toggle -->
	<div class="flex gap-1 rounded-lg bg-raised border border-wire p-1 w-fit">
		<button onclick={() => setView('list')}
			class="rounded px-4 py-1.5 text-sm font-medium transition-colors cursor-pointer {view === 'list' ? 'bg-panel text-fg shadow-sm' : 'text-muted hover:text-fg'}">
			{t('bracket_view_list')}
		</button>
		<button onclick={() => setView('tree')}
			class="rounded px-4 py-1.5 text-sm font-medium transition-colors cursor-pointer {view === 'tree' ? 'bg-panel text-fg shadow-sm' : 'text-muted hover:text-fg'}">
			{t('bracket_view_tree')}
		</button>
	</div>

	{#if view === 'tree'}
		<BracketTree rounds={data.rounds} />
	{:else}
		<!-- Sticky round stepper (solid bg, no blur — iOS rubber-band safe). -->
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

		<div>
			<h2 class="text-base font-semibold text-fg">{stageLabels[active]}</h2>
			{#if allTBD}
				<p class="text-xs text-faint mt-0.5">{t('bracket_pending_note')}</p>
			{/if}
		</div>

		<div class="-mx-4 sm:mx-0 sm:rounded-xl sm:border sm:border-wire overflow-hidden border-y border-wire sm:border-y-0 divide-y divide-wire/60">
			{#each activeRound.matches as m (m.id)}
				<BracketRow match={m} />
			{/each}
		</div>
	{/if}
</div>
