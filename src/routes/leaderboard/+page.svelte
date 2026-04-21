<script lang="ts">
	import { WC2026_TEAMS } from '$lib/wc2026';
	import { t } from '$lib/i18n.svelte';

	let { data } = $props();
	let filter = $state<'global' | 'friends'>('global');

	function flagUrl(teamName: string | undefined, size = 40): string {
		if (!teamName) return '';
		const team = WC2026_TEAMS.find((t) => t.name === teamName);
		return team ? `https://flagcdn.com/w${size}/${team.flag.toLowerCase()}.png` : '';
	}

	const rankColors: Record<number, { bg: string; text: string }> = {
		1: { bg: 'bg-accent',   text: 'text-canvas' },
		2: { bg: 'bg-wire-hi',  text: 'text-fg'     },
		3: { bg: 'bg-raised',   text: 'text-muted'  },
	};

	const visible = $derived(
		filter === 'friends' && data.currentUser
			? data.leaderboard.filter(
					(r) => r.userId === data.currentUser!.id || data.friendIds.includes(r.userId)
			  )
			: data.leaderboard
	);

	const ranked = $derived(visible.map((r, i) => ({ ...r, displayRank: i + 1 })));

	const myEntry = $derived(ranked.find((r) => r.userId === data.currentUser?.id));
</script>

<div class="space-y-4">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold text-fg" style="font-family: var(--font-display); letter-spacing: 0.02em">
			{t('lb_title')}
		</h1>
		{#if myEntry}
			<span class="text-sm text-accent font-semibold tabular-nums">#{myEntry.displayRank}</span>
		{/if}
	</div>

	<!-- Friends filter -->
	{#if data.currentUser && data.friendIds.length > 0}
		<div class="flex gap-1 rounded-lg bg-raised border border-wire p-1 w-fit">
			<button
				onclick={() => (filter = 'global')}
				class="rounded px-4 py-1.5 text-sm font-semibold transition-colors cursor-pointer
					{filter === 'global' ? 'bg-panel text-fg shadow-sm' : 'text-faint hover:text-muted'}">
				{t('lb_all')}
			</button>
			<button
				onclick={() => (filter = 'friends')}
				class="rounded px-4 py-1.5 text-sm font-semibold transition-colors cursor-pointer
					{filter === 'friends' ? 'bg-panel text-fg shadow-sm' : 'text-faint hover:text-muted'}">
				{t('lb_friends')}
			</button>
		</div>
	{/if}

	<!-- Empty state -->
	{#if ranked.length === 0}
		<div class="rounded-xl bg-panel border border-wire px-6 py-12 text-center">
			{#if filter === 'friends'}
				<p class="text-muted">{t('lb_empty_friends')}</p>
				<p class="text-faint text-sm mt-2">{t('lb_empty_friends_hint')}</p>
			{:else}
				<p class="text-muted">{t('lb_empty')}</p>
				<p class="text-faint text-sm mt-2">{t('lb_empty_hint')}</p>
			{/if}
		</div>

	<!-- Table -->
	{:else}
		<div class="rounded-xl bg-panel border border-wire overflow-hidden">
			<table class="w-full">
				<thead>
					<tr class="border-b border-wire">
						<th class="px-4 py-3 text-left w-12 text-xs text-faint uppercase tracking-wider font-semibold">#</th>
						<th class="px-4 py-3 text-left text-xs text-faint uppercase tracking-wider font-semibold">{t('lb_player')}</th>
						<th class="px-4 py-3 text-right text-xs text-faint uppercase tracking-wider font-semibold hidden sm:table-cell">{t('lb_picks')}</th>
						<th class="px-4 py-3 text-right text-xs text-faint uppercase tracking-wider font-semibold hidden md:table-cell">{t('lb_bonus')}</th>
						<th class="px-4 py-3 text-right text-xs text-faint uppercase tracking-wider font-semibold">{t('lb_total')}</th>
					</tr>
				</thead>
				<tbody>
					{#each ranked as row (row.userId)}
						{@const isMe = row.userId === data.currentUser?.id}
						{@const rc = rankColors[row.displayRank]}
						<tr class="border-b border-wire/40 last:border-0 transition-colors {isMe ? 'bg-accent-lo/60' : 'hover:bg-raised/40'}">

							<!-- Rank badge -->
							<td class="px-4 py-3 text-center w-12">
								<span class="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold tabular-nums
									{rc ? rc.bg + ' ' + rc.text : 'text-faint'}">
									{row.displayRank}
								</span>
							</td>

							<!-- Player -->
							<td class="px-4 py-3">
								<a href="/profile/{row.userId}" class="flex items-center gap-2 hover:opacity-80 transition-opacity">
									{#if (row.user as any)?.avatar_url}
										<img src={(row.user as any).avatar_url} alt=""
											class="w-7 h-7 rounded-full object-cover shrink-0" />
									{:else}
										<span class="w-7 h-7 rounded-full bg-raised border border-wire flex items-center justify-center text-xs font-bold text-muted shrink-0">
											{((row.user as any)?.display_name ?? (row.user as any)?.username ?? '?')[0]?.toUpperCase()}
										</span>
									{/if}
									<div class="min-w-0">
										<span class="block text-sm truncate {isMe ? 'text-accent font-semibold' : 'text-fg'}">
											{(row.user as any)?.display_name ?? (row.user as any)?.username ?? '?'}
										</span>
										{#if (row.user as any)?.favorite_team}
											{@const url = flagUrl((row.user as any).favorite_team)}
											<span class="flex items-center gap-1 mt-0.5">
												{#if url}
													<img src={url} alt={(row.user as any).favorite_team}
														class="w-5 h-3.5 object-cover rounded-sm shrink-0" />
												{/if}
												<span class="text-xs text-faint truncate">{(row.user as any).favorite_team}</span>
											</span>
										{/if}
									</div>
								</a>
							</td>

							<!-- Picks count -->
							<td class="px-4 py-3 text-right text-muted text-sm hidden sm:table-cell tabular-nums">
								{row.count}
							</td>

							<!-- Team bonus -->
							<td class="px-4 py-3 text-right hidden md:table-cell tabular-nums">
								{#if row.teamBonus > 0}
									<span class="text-sm font-semibold" style="color: var(--color-bonus)">
										+{row.teamBonus.toFixed(1)}
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
									<span class="text-[11px] text-faint font-normal hidden sm:inline ml-1">
										({row.pronoPoints.toFixed(1)}+{row.teamBonus.toFixed(1)})
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
