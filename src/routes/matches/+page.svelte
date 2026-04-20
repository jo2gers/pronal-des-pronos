<script lang="ts">
	import { isoToFlag, formatDate, timeUntilMatch } from '$lib/utils';
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

	function urgency(match: Match) {
		if (match.status !== 'upcoming') return 'none';
		const ms = new Date(match.match_datetime).getTime() - Date.now();
		if (ms <= 0) return 'none';
		if (ms < 2 * 3600000)  return 'locked';
		if (ms < 6 * 3600000)  return 'critical';
		if (ms < 24 * 3600000) return 'warning';
		return 'normal';
	}
</script>

<div class="space-y-10">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold text-fg" style="font-family: var(--font-display); letter-spacing: 0.02em">
			Matchs
		</h1>
		{#if !data.user}
			<a href="/auth/login" class="text-sm text-accent hover:text-accent-hi transition-colors">
				Connexion pour pronostiquer →
			</a>
		{/if}
	</div>

	{#each grouped() as { stage, matches }}
		<section>
			<h2 class="text-xs font-bold text-faint uppercase tracking-widest mb-4">
				{STAGE_LABELS[stage] ?? stage}
			</h2>

			{#if stage === 'group'}
				{@const byGroup = matches.reduce((acc: Record<string, Match[]>, m) => {
					const g = m.group_label ?? '?';
					if (!acc[g]) acc[g] = [];
					acc[g].push(m);
					return acc;
				}, {})}
				<div class="space-y-5">
					{#each Object.entries(byGroup).sort() as [group, gMatches]}
						<div>
							<p class="text-xs text-faint uppercase tracking-wider mb-2 pl-1">Groupe {group}</p>
							<div class="rounded-xl bg-panel border border-wire overflow-hidden">
								{#each gMatches as match}
									{@const u = urgency(match)}
									<a href="/matches/{match.id}"
										class="block px-4 py-3 border-b border-wire last:border-0 hover:bg-raised transition-colors">
										{@render matchRow(match, u)}
									</a>
								{/each}
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<div class="rounded-xl bg-panel border border-wire overflow-hidden">
					{#each matches as match}
						{@const u = urgency(match)}
						<a href="/matches/{match.id}"
							class="block px-4 py-3 border-b border-wire last:border-0 hover:bg-raised transition-colors">
							{@render matchRow(match, u)}
						</a>
					{/each}
				</div>
			{/if}
		</section>
	{/each}
</div>

{#snippet matchRow(match: Match, u: string)}
	<div class="flex items-center gap-2">
		<!-- Home -->
		<div class="flex items-center gap-2 flex-1 min-w-0">
			<span class="text-lg shrink-0">{isoToFlag(match.home_flag)}</span>
			<span class="text-sm font-medium text-fg truncate">{match.home_team}</span>
		</div>

		<!-- Score / date -->
		<div class="text-center shrink-0 min-w-[96px]">
			{#if match.status === 'finished' && match.home_score != null}
				<span class="font-bold text-fg tabular-nums" style="font-family: var(--font-display)">
					{match.home_score} – {match.away_score}
				</span>
			{:else if match.status === 'live'}
				<span class="inline-flex items-center gap-1 rounded bg-live px-2 py-0.5 text-xs font-bold text-fg">
					<span class="w-1.5 h-1.5 rounded-full bg-fg/80 animate-pulse"></span>
					LIVE
				</span>
			{:else}
				<span class="text-xs text-muted block">{formatDate(match.match_datetime)}</span>
				<span class="text-xs block mt-0.5 {
					u === 'critical' ? 'text-live font-semibold' :
					u === 'warning'  ? 'text-warn' :
					u === 'locked'   ? 'text-faint' :
					'text-accent'
				}">{timeUntilMatch(match.match_datetime)}</span>
			{/if}
		</div>

		<!-- Away -->
		<div class="flex items-center gap-2 flex-1 min-w-0 justify-end">
			<span class="text-sm font-medium text-fg truncate">{match.away_team}</span>
			<span class="text-lg shrink-0">{isoToFlag(match.away_flag)}</span>
		</div>

		<!-- User prono badge -->
		{#if data.pronosticsMap?.[match.id]}
			{@const p = data.pronosticsMap[match.id]}
			<span class="text-xs text-accent bg-accent-lo rounded px-2 py-0.5 ml-1 shrink-0 tabular-nums">
				{p.predicted_home}–{p.predicted_away}
			</span>
		{/if}

		<!-- Urgency dot for near-lock matches -->
		{#if u === 'critical'}
			<span class="w-1.5 h-1.5 rounded-full bg-live animate-pulse shrink-0 ml-1"></span>
		{/if}
	</div>
{/snippet}
