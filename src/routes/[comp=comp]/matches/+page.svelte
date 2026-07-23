<script lang="ts">
	// V2 competition calendar — pickable: each row is a CompMatchRow stepper with
	// the live exact-score multiplier (frozen server-side at the lock).
	//
	// League formats are paged ONE MATCHDAY at a time (the server resolves the
	// current one), with day sub-dividers inside. Competitions without matchdays
	// (UCL before its draw) fall back to plain day grouping of everything.
	import { getLang } from '$lib/i18n.svelte';
	import { groupByDay } from '$lib/utils';
	import { reveal } from '$lib/motion';
	import CompMatchRow from '$lib/components/CompMatchRow.svelte';

	let { data } = $props();

	const fr = $derived(getLang() === 'fr');
	const compName = $derived(fr ? data.competition.name_fr : data.competition.name_en);

	// The server already narrowed `matches` to the selected matchday (or to the
	// whole competition when it has none), so this is just the day grouping.
	const days = $derived(groupByDay(data.matches, getLang()));

	const paged = $derived(data.selectedMatchday != null);
	const isCurrent = $derived(data.selectedMatchday === data.currentMatchday);
	const hasPrev = $derived(paged && data.selectedMatchday! > (data.minMatchday ?? 1));
	const hasNext = $derived(paged && data.selectedMatchday! < (data.maxMatchday ?? 1));

	const teamInfo = (team: string) => data.teamMap[team] ?? { short: team, logo: null };

	const arrowBase =
		'w-10 h-10 shrink-0 inline-flex items-center justify-center rounded-lg border text-sm transition-colors';
</script>

<div class="max-w-2xl mx-auto space-y-6">
	<header in:reveal={{ y: 10 }}>
		<p class="text-[10.5px] uppercase tracking-[0.14em] text-faint" style="font-family: var(--font-mono)">
			{fr ? 'Saison 2026-27' : '2026-27 season'}
		</p>
		<h1 class="text-3xl sm:text-4xl font-bold mt-1" style="font-family: var(--font-display); letter-spacing: -0.03em">
			{compName}
		</h1>
		<p class="text-sm text-faint mt-2 tabular-nums">
			{data.totalMatches} {fr ? 'matchs' : 'matches'}
		</p>
	</header>

	<!-- ── Matchday pager ───────────────────────────────────────────────────── -->
	{#if paged}
		<nav class="flex items-center justify-between gap-3" aria-label={fr ? 'Navigation par journée' : 'Matchday navigation'}>
			{#if hasPrev}
				<a href="?j={data.selectedMatchday! - 1}"
					class="{arrowBase} border-wire text-muted hover:border-accent hover:text-fg"
					aria-label={fr ? 'Journée précédente' : 'Previous matchweek'}>‹</a>
			{:else}
				<span class="{arrowBase} border-wire/40 text-faint/40" aria-hidden="true">‹</span>
			{/if}

			<div class="text-center min-w-0">
				<h2 class="text-xl font-bold leading-none" style="font-family: var(--font-display); letter-spacing: -0.02em">
					{fr ? 'Journée' : 'Matchweek'} {data.selectedMatchday}
				</h2>
				{#if isCurrent}
					<span class="mt-1 inline-flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.14em] text-accent"
						style="font-family: var(--font-mono)">
						<span class="w-1.5 h-1.5 rounded-full bg-accent" aria-hidden="true"></span>
						{fr ? 'en cours' : 'current'}
					</span>
				{:else if data.currentMatchday != null}
					<a href="?j={data.currentMatchday}"
						class="mt-1 inline-block text-[11px] text-muted hover:text-accent transition-colors">
						{fr ? `Aller à la journée ${data.currentMatchday}` : `Go to matchweek ${data.currentMatchday}`}
					</a>
				{/if}
			</div>

			{#if hasNext}
				<a href="?j={data.selectedMatchday! + 1}"
					class="{arrowBase} border-wire text-muted hover:border-accent hover:text-fg"
					aria-label={fr ? 'Journée suivante' : 'Next matchweek'}>›</a>
			{:else}
				<span class="{arrowBase} border-wire/40 text-faint/40" aria-hidden="true">›</span>
			{/if}
		</nav>
	{/if}

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

	{#if days.length === 0}
		<div class="rounded-xl bg-panel border border-wire px-6 py-10 text-center">
			<p class="text-muted">{fr ? 'Calendrier pas encore publié.' : 'Fixtures not published yet.'}</p>
		</div>
	{:else}
		<div class="space-y-4">
			{#each days as bucket (bucket.key)}
				<section>{@render dayBlock(bucket)}</section>
			{/each}
		</div>
	{/if}
</div>
