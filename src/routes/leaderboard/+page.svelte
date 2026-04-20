<script lang="ts">
	import { isoToFlag } from '$lib/utils';
	import { WC2026_TEAMS } from '$lib/wc2026';

	let { data } = $props();

	function teamFlag(teamName: string | undefined) {
		if (!teamName) return '';
		const t = WC2026_TEAMS.find((t) => t.name === teamName);
		return t ? isoToFlag(t.flag) : '';
	}

	const rankStyle: Record<number, string> = {
		1: 'bg-accent text-canvas font-bold',
		2: 'bg-wire-hi text-fg font-bold',
		3: 'bg-raised text-muted font-bold',
	};
</script>

<div class="space-y-4">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold text-fg" style="font-family: var(--font-display); letter-spacing: 0.02em">
			Classement
		</h1>
		{#if data.userRank}
			<span class="text-sm text-accent font-semibold tabular-nums">#{data.userRank}</span>
		{/if}
	</div>

	{#if data.leaderboard.length === 0}
		<div class="rounded-xl bg-panel border border-wire px-6 py-12 text-center">
			<p class="text-muted">Aucun point marqué pour l'instant.</p>
			<p class="text-faint text-sm mt-2">Les scores apparaîtront après les premiers matchs.</p>
		</div>
	{:else}
		<div class="rounded-xl bg-panel border border-wire overflow-hidden">
			<table class="w-full">
				<thead class="sticky top-14 z-10 bg-panel">
					<tr class="border-b border-wire">
						<th class="px-4 py-3 text-left w-12 text-xs text-faint uppercase tracking-wider font-semibold">#</th>
						<th class="px-4 py-3 text-left text-xs text-faint uppercase tracking-wider font-semibold">Joueur</th>
						<th class="px-4 py-3 text-right text-xs text-faint uppercase tracking-wider font-semibold hidden sm:table-cell">Pronos</th>
						<th class="px-4 py-3 text-right text-xs text-faint uppercase tracking-wider font-semibold hidden md:table-cell">Bonus</th>
						<th class="px-4 py-3 text-right text-xs text-faint uppercase tracking-wider font-semibold">Total</th>
					</tr>
				</thead>
				<tbody>
					{#each data.leaderboard as row}
						{@const isMe = row.userId === data.currentUser?.id}
						<tr class="border-b border-wire/40 last:border-0 {isMe ? 'bg-accent-lo/60' : 'hover:bg-raised/40'} transition-colors">
							<!-- Rank badge — no emoji -->
							<td class="px-4 py-3 text-center w-12">
								<span class="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs tabular-nums
									{rankStyle[row.rank] ?? 'text-faint'}">
									{row.rank}
								</span>
							</td>

							<!-- Player -->
							<td class="px-4 py-3">
								<a href="/profile/{row.userId}" class="flex items-center gap-2 hover:opacity-80 transition-opacity">
									{#if (row.user as any)?.avatar_url}
										<img src={(row.user as any).avatar_url} alt=""
											class="w-7 h-7 rounded-full object-cover shrink-0" />
									{:else}
										<!-- Letter avatar — no emoji -->
										<span class="w-7 h-7 rounded-full bg-raised border border-wire flex items-center justify-center text-xs font-bold text-muted shrink-0">
											{((row.user as any)?.display_name ?? (row.user as any)?.username ?? '?')[0]?.toUpperCase()}
										</span>
									{/if}
									<span class="text-sm {isMe ? 'text-accent font-semibold' : 'text-fg'} truncate">
										{(row.user as any)?.display_name ?? (row.user as any)?.username ?? '?'}
									</span>
									{#if (row.user as any)?.favorite_team}
										<span class="text-sm shrink-0">{teamFlag((row.user as any).favorite_team)}</span>
									{/if}
								</a>
							</td>

							<td class="px-4 py-3 text-right text-muted text-sm hidden sm:table-cell tabular-nums">
								{row.count}
							</td>

							<!-- Team bonus -->
							<td class="px-4 py-3 text-right hidden md:table-cell tabular-nums">
								{#if row.teamBonus > 0}
									<span class="text-sm font-semibold" style="color: var(--color-bonus)">
										+{row.teamBonus.toFixed(0)}
									</span>
								{:else}
									<span class="text-faint text-sm">—</span>
								{/if}
							</td>

							<!-- Total -->
							<td class="px-4 py-3 text-right tabular-nums">
								<span class="font-bold text-accent" style="font-family: var(--font-display)">
									{row.total.toFixed(2)}
								</span>
								{#if row.teamBonus > 0}
									<span class="text-xs text-faint font-normal hidden sm:inline ml-1">
										({row.pronoPoints.toFixed(1)}+{row.teamBonus})
									</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
