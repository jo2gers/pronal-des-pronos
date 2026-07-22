<script lang="ts">
	// V2 competition calendar — pickable: each row is a CompMatchRow stepper
	// with the live exact-score multiplier (frozen server-side at the lock).
	// League formats group by MATCHDAY ("Journée 1 … 38") with day sub-dividers
	// inside; competitions without matchdays fall back to plain day grouping.
	import { getLang } from '$lib/i18n.svelte';
	import { groupByDay } from '$lib/utils';
	import { reveal } from '$lib/motion';
	import CompMatchRow from '$lib/components/CompMatchRow.svelte';

	let { data } = $props();

	const fr = $derived(getLang() === 'fr');
	const compName = $derived(getLang() === 'fr' ? data.competition.name_fr : data.competition.name_en);

	const hasMatchdays = $derived(data.matches.some((m) => m.matchday != null));
	const journees = $derived.by(() => {
		if (!hasMatchdays) return null;
		const byDay = new Map<number, typeof data.matches>();
		for (const m of data.matches) {
			const n = m.matchday ?? 0;
			byDay.set(n, [...(byDay.get(n) ?? []), m]);
		}
		return [...byDay.entries()]
			.sort((a, b) => a[0] - b[0])
			.map(([n, items]) => ({ n, days: groupByDay(items, getLang()) }));
	});
	const buckets = $derived(hasMatchdays ? [] : groupByDay(data.matches, getLang()));

	const teamInfo = (team: string) => data.teamMap[team] ?? { short: team, logo: null };
</script>

<div class="max-w-2xl mx-auto space-y-6">
	<header in:reveal={{ y: 10 }}>
		<p class="text-[10.5px] uppercase tracking-[0.14em] text-faint" style="font-family: var(--font-mono)">
			{getLang() === 'fr' ? 'Saison 2026-27 · aperçu V2' : '2026-27 season · V2 preview'}
		</p>
		<h1 class="text-3xl sm:text-4xl font-bold mt-1" style="font-family: var(--font-display); letter-spacing: -0.03em">
			{compName}
		</h1>
		<p class="text-sm text-faint mt-2 tabular-nums">
			{data.matches.length} {getLang() === 'fr' ? 'matchs' : 'matches'}
		</p>
	</header>

	{#snippet dayBlock(bucket: { key: string; label: string; items: any[] })}
		<div class="flex items-center gap-3 mb-2 px-1">
			<span class="flex-1 h-px bg-wire"></span>
			<span class="text-[11px] uppercase tracking-widest text-faint">{bucket.label}</span>
			<span class="flex-1 h-px bg-wire"></span>
		</div>
		<div class="-mx-4 sm:mx-0 divide-y divide-wire/60 border-y border-wire sm:border sm:rounded-xl sm:bg-panel/40 overflow-hidden">
			{#each bucket.items as m (m.id)}
				<CompMatchRow match={m}
					home={teamInfo(m.home_team)}
					away={teamInfo(m.away_team)}
					existingProno={data.pronosticsMap[m.id] ?? null}
					loggedIn={!!data.user}
					href="/{data.competition.slug}/matches/{m.id}" />
			{/each}
		</div>
	{/snippet}

	{#if journees}
		<!-- League format: Journée 1 … 38, day sub-dividers inside each -->
		<div class="space-y-10">
			{#each journees as j (j.n)}
				<section id="j{j.n}">
					<h2 class="text-xl font-bold text-fg mb-3 px-1"
						style="font-family: var(--font-display); letter-spacing: -0.02em">
						{fr ? 'Journée' : 'Matchweek'} {j.n}
					</h2>
					<div class="space-y-4">
						{#each j.days as bucket (bucket.key)}
							<div>{@render dayBlock(bucket)}</div>
						{/each}
					</div>
				</section>
			{/each}
		</div>
	{:else if buckets.length === 0}
		<div class="rounded-xl bg-panel border border-wire px-6 py-10 text-center">
			<p class="text-muted">{getLang() === 'fr' ? 'Calendrier pas encore publié.' : 'Fixtures not published yet.'}</p>
		</div>
	{:else}
		<div class="space-y-6">
			{#each buckets as bucket (bucket.key)}
				<section>{@render dayBlock(bucket)}</section>
			{/each}
		</div>
	{/if}
</div>
