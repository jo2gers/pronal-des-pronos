<script lang="ts">
	import { invalidateAll, goto } from '$app/navigation';
	import { page } from '$app/state';
	import { STAGE_LABELS_FR, STAGE_LABELS_EN } from '$lib/wc2026';
	import { t, getLang } from '$lib/i18n.svelte';
	import MatchPickRow from '$lib/components/MatchPickRow.svelte';

	let { data } = $props();

	// Auto-refresh every 30s while a match is live
	$effect(() => {
		const hasLive = (data.matches ?? []).some(m => m.status === 'live');
		if (!hasLive) return;
		const interval = setInterval(() => invalidateAll(), 30_000);
		return () => clearInterval(interval);
	});

	type Match = NonNullable<typeof data.matches>[number];

	// Tab lives in the URL (?tab=ended) so it survives navigation to a match
	// detail and back via history.back().
	const tab = $derived<'upcoming' | 'ended'>(
		page.url.searchParams.get('tab') === 'ended' ? 'ended' : 'upcoming'
	);

	function setTab(next: 'upcoming' | 'ended') {
		const url = new URL(page.url);
		if (next === 'upcoming') url.searchParams.delete('tab');
		else                     url.searchParams.set('tab', next);
		goto(url, { replaceState: true, keepFocus: true, noScroll: true });
	}

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
	<div class="space-y-2">
		<div class="flex gap-1 rounded-lg bg-raised border border-wire p-1 w-fit">
			<button
				onclick={() => setTab('upcoming')}
				class="rounded px-4 py-1.5 text-sm font-medium transition-colors cursor-pointer {tab === 'upcoming' ? 'bg-panel text-fg shadow-sm' : 'text-muted hover:text-fg'}">
				{t('upcoming')}
			</button>
			<button
				onclick={() => setTab('ended')}
				class="rounded px-4 py-1.5 text-sm font-medium transition-colors cursor-pointer {tab === 'ended' ? 'bg-panel text-fg shadow-sm' : 'text-muted hover:text-fg'}">
				{t('ended')}
			</button>
		</div>
	</div>

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
					<MatchPickRow {match}
						existingProno={data.pronosticsMap[match.id] ?? null}
						loggedIn={!!data.user} />
				{/each}
			</div>
		</section>
	{/each}
</div>
