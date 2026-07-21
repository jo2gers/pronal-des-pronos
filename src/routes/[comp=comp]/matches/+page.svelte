<script lang="ts">
	// V2 competition calendar — first visible surface of the next season.
	// Read-only for now: picks/odds/steppers arrive with the V2 scoring wiring.
	import { getLang } from '$lib/i18n.svelte';
	import { groupByDay, formatTime } from '$lib/utils';
	import { reveal } from '$lib/motion';

	let { data } = $props();

	const compName = $derived(getLang() === 'fr' ? data.competition.name_fr : data.competition.name_en);
	const buckets = $derived(groupByDay(data.matches, getLang()));

	const badge = (team: string) => data.teamMap[team]?.logo ?? null;
	const shortName = (team: string) => data.teamMap[team]?.short ?? team;
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

	{#if buckets.length === 0}
		<div class="rounded-xl bg-panel border border-wire px-6 py-10 text-center">
			<p class="text-muted">{getLang() === 'fr' ? 'Calendrier pas encore publié.' : 'Fixtures not published yet.'}</p>
		</div>
	{:else}
		<div class="space-y-6">
			{#each buckets as bucket (bucket.key)}
				<section>
					<div class="flex items-center gap-3 mb-2 px-1">
						<span class="flex-1 h-px bg-wire"></span>
						<span class="text-[11px] uppercase tracking-widest text-faint">{bucket.label}</span>
						<span class="flex-1 h-px bg-wire"></span>
					</div>
					<div class="-mx-4 sm:mx-0 divide-y divide-wire/60 border-y border-wire sm:border sm:rounded-xl sm:bg-panel/40 overflow-hidden">
						{#each bucket.items as m (m.id)}
							<div class="flex items-center gap-3 px-4 py-3">
								<div class="flex-1 min-w-0 flex items-center justify-end gap-2">
									<span class="truncate text-sm font-medium text-fg text-right">{shortName(m.home_team)}</span>
									{#if badge(m.home_team)}
										<img src={badge(m.home_team)} alt="" class="w-6 h-6 object-contain shrink-0" loading="lazy" />
									{/if}
								</div>
								<div class="shrink-0 text-center w-16">
									{#if m.status === 'finished'}
										<span class="font-bold tabular-nums text-fg" style="font-family: var(--font-display)">
											{m.home_score}–{m.away_score}
										</span>
									{:else}
										<span class="text-xs text-faint tabular-nums">{formatTime(m.match_datetime, getLang())}</span>
									{/if}
								</div>
								<div class="flex-1 min-w-0 flex items-center gap-2">
									{#if badge(m.away_team)}
										<img src={badge(m.away_team)} alt="" class="w-6 h-6 object-contain shrink-0" loading="lazy" />
									{/if}
									<span class="truncate text-sm font-medium text-fg">{shortName(m.away_team)}</span>
								</div>
							</div>
						{/each}
					</div>
				</section>
			{/each}
		</div>
	{/if}
</div>
