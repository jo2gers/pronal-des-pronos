<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { groupByDay, daysUntilMatch } from '$lib/utils';
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

	// Tournament over — archive mode: every match is finished, so the page is a
	// single reverse-chronological list (most recent day first). Tabs retired.
	const buckets = $derived.by(() => {
		const filtered = (data.matches ?? []).filter((m) => m.status === 'finished');
		filtered.sort(
			(a, b) => new Date(b.match_datetime).getTime() - new Date(a.match_datetime).getTime()
		);
		return groupByDay(filtered, getLang());
	});
</script>

<div class="space-y-8">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold text-fg" style="font-family: var(--font-display); letter-spacing: 0.02em">
			{t('nav_matches')}
		</h1>
	</div>

	{#if buckets.length === 0}
		<div class="rounded-xl bg-panel border border-wire px-6 py-10 text-center">
			<p class="text-muted">{t('no_ended')}</p>
		</div>
	{:else}
		<div class="space-y-6">
			{#each buckets as bucket (bucket.key)}
				{@const countdown = daysUntilMatch(bucket.items[0].match_datetime, getLang())}
				<section>
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
					<div class="-mx-4 sm:mx-0 divide-y divide-wire/60 border-y border-wire sm:border sm:rounded-xl sm:bg-panel/40 overflow-hidden">
						{#each bucket.items as match (match.id)}
							<MatchPickRow {match}
								existingProno={data.pronosticsMap[match.id] ?? null}
								loggedIn={!!data.user} />
						{/each}
					</div>
				</section>
			{/each}
		</div>
	{/if}
</div>
