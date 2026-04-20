<script lang="ts">
	import { isoToFlag, formatDate, isMatchLocked, timeUntilMatch } from '$lib/utils';
	import { STAGE_LABELS } from '$lib/wc2026';

	let { data } = $props();

	type Match = NonNullable<typeof data.matches>[number];

	const grouped = $derived(() => {
		const stageOrder = ['group', 'round_of_32', 'round_of_16', 'quarters', 'semis', 'third', 'final'];
		const map = new Map<string, Match[]>();
		for (const m of data.matches ?? []) {
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

<div class="space-y-8">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold text-fg">Tous les matchs</h1>
		{#if !data.user}
			<a href="/auth/login" class="text-sm text-accent hover:text-accent-hi">
				Connecte-toi pour pronostiquer →
			</a>
		{/if}
	</div>

	{#each grouped() as { stage, matches }}
		<section>
			<h2 class="text-sm font-bold text-accent uppercase tracking-wider mb-3">
				{STAGE_LABELS[stage] ?? stage}
			</h2>

			{#if stage === 'group'}
				{@const byGroup = matches.reduce((acc: Record<string, Match[]>, m) => {
					const g = m.group_label ?? '?';
					if (!acc[g]) acc[g] = [];
					acc[g].push(m);
					return acc;
				}, {})}
				{#each Object.entries(byGroup).sort() as [group, gMatches]}
					<div class="mb-4">
						<h3 class="text-xs font-semibold text-faint mb-2 uppercase tracking-wider">Groupe {group}</h3>
						<div class="space-y-2">
							{#each gMatches as match}
								<a href="/matches/{match.id}" class="block rounded-lg bg-panel border border-wire hover:border-accent transition-colors p-3">
									{@render matchRow(match)}
								</a>
							{/each}
						</div>
					</div>
				{/each}
			{:else}
				<div class="space-y-2">
					{#each matches as match}
						<a href="/matches/{match.id}" class="block rounded-lg bg-panel border border-wire hover:border-accent transition-colors p-3">
							{@render matchRow(match)}
						</a>
					{/each}
				</div>
			{/if}
		</section>
	{/each}
</div>

{#snippet matchRow(match: Match)}
	<div class="flex items-center gap-3">
		<div class="flex items-center gap-2 flex-1">
			<span class="text-xl">{isoToFlag(match.home_flag)}</span>
			<span class="text-sm font-medium text-fg truncate">{match.home_team}</span>
		</div>
		<div class="text-center min-w-[100px]">
			{#if match.status === 'finished' && match.home_score != null}
				<span class="font-bold text-fg">{match.home_score} – {match.away_score}</span>
			{:else}
				<span class="text-xs text-muted">{formatDate(match.match_datetime)}</span>
				<div class="text-xs text-accent">{timeUntilMatch(match.match_datetime)}</div>
			{/if}
		</div>
		<div class="flex items-center gap-2 flex-1 justify-end">
			<span class="text-sm font-medium text-fg truncate">{match.away_team}</span>
			<span class="text-xl">{isoToFlag(match.away_flag)}</span>
		</div>
		{#if data.pronosticsMap?.[match.id]}
			{@const p = data.pronosticsMap[match.id]}
			<span class="text-xs text-accent bg-accent-lo rounded px-2 py-0.5 ml-2 whitespace-nowrap">
				{p.predicted_home}–{p.predicted_away}
			</span>
		{/if}
	</div>
{/snippet}
