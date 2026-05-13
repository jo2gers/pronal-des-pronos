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

	const visible = $derived(
		filter === 'friends' && data.currentUser
			? data.leaderboard.filter(
					(r) => r.userId === data.currentUser!.id || data.friendIds.includes(r.userId)
			  )
			: data.leaderboard
	);

	const ranked = $derived(visible.map((r, i) => ({ ...r, displayRank: i + 1 })));

	// Podium only kicks in with a real field (>= 3 players); otherwise everyone is in the table.
	const hasPodium = $derived(ranked.length >= 3);
	const podium = $derived(hasPodium ? ranked.slice(0, 3) : []);
	const tableRows = $derived(hasPodium ? ranked.slice(3) : ranked);

	const myEntry = $derived(ranked.find((r) => r.userId === data.currentUser?.id));

	// Podium ordering: 2 · 1 · 3 (classic Olympic centre layout)
	const podiumSlots = $derived(() => {
		const byRank = new Map(podium.map(r => [r.displayRank, r]));
		return [byRank.get(2), byRank.get(1), byRank.get(3)] as const;
	});
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
		<div class="border-t border-wire py-12 text-center">
			{#if filter === 'friends'}
				<p class="text-muted">{t('lb_empty_friends')}</p>
				<p class="text-faint text-sm mt-2">{t('lb_empty_friends_hint')}</p>
			{:else}
				<p class="text-muted">{t('lb_empty')}</p>
				<p class="text-faint text-sm mt-2">{t('lb_empty_hint')}</p>
			{/if}
		</div>

	<!-- Podium + table -->
	{:else}
		<!-- ── Podium: 2 · 1 · 3 staggered, accent-tier hierarchy ─────────────── -->
		{#if podium.length >= 3}
			<section class="-mx-4 sm:mx-0 mb-2">
				<div class="grid grid-cols-3 items-end gap-2 sm:gap-4 px-4 sm:px-0">
					{#each podiumSlots() as p, i}
						{@const slotRank = i === 0 ? 2 : i === 1 ? 1 : 3}
						{@const isFirst = slotRank === 1}
						{@const isMe = p?.userId === data.currentUser?.id}
						{#if p}
							<a href="/profile/{p.userId}"
								class="group flex flex-col items-center text-center transition-transform hover:-translate-y-0.5
									{isFirst ? 'pt-1' : 'pt-4 sm:pt-6'}">
								<!-- Avatar with rank ring -->
								<div class="relative">
									{#if (p.user as any)?.avatar_url}
										<img src={(p.user as any).avatar_url} alt=""
											class="object-cover rounded-full
												{isFirst ? 'w-20 h-20 sm:w-24 sm:h-24' : 'w-14 h-14 sm:w-16 sm:h-16'}"
											style="box-shadow: 0 0 0 3px var(--color-canvas),
												0 0 0 {isFirst ? '5px' : '4px'} {slotRank === 1 ? 'var(--color-accent)' :
												slotRank === 2 ? 'var(--color-wire-hi)' : 'var(--color-bonus)'}" />
									{:else}
										<span class="rounded-full bg-raised border border-wire flex items-center justify-center font-bold text-muted
											{isFirst ? 'w-20 h-20 sm:w-24 sm:h-24 text-3xl' : 'w-14 h-14 sm:w-16 sm:h-16 text-xl'}"
											style="box-shadow: 0 0 0 3px var(--color-canvas),
												0 0 0 {isFirst ? '5px' : '4px'} {slotRank === 1 ? 'var(--color-accent)' :
												slotRank === 2 ? 'var(--color-wire-hi)' : 'var(--color-bonus)'}">
											{((p.user as any)?.display_name ?? (p.user as any)?.username ?? '?')[0]?.toUpperCase()}
										</span>
									{/if}
									<!-- Rank chip -->
									<span class="absolute -bottom-2 left-1/2 -translate-x-1/2 inline-flex items-center justify-center
										rounded-full tabular-nums font-bold
										{isFirst ? 'w-8 h-8 text-sm' : 'w-6 h-6 text-xs'}"
										style="background: {slotRank === 1 ? 'var(--color-accent)' :
											slotRank === 2 ? 'var(--color-wire-hi)' : 'var(--color-bonus)'};
											color: {slotRank === 1 ? 'var(--color-canvas)' :
												slotRank === 2 ? 'var(--color-fg)' : 'var(--color-canvas)'}">
										{slotRank}
									</span>
								</div>
								<!-- Name -->
								<p class="mt-4 text-sm font-semibold truncate max-w-full px-1 {isMe ? 'text-accent' : 'text-fg'}">
									{(p.user as any)?.display_name ?? (p.user as any)?.username ?? '?'}
								</p>
								<!-- Points -->
								<p class="tabular-nums font-bold {isFirst ? 'text-2xl sm:text-3xl text-accent' : 'text-lg text-fg/80'}"
									style="font-family: var(--font-display)">
									{p.total.toFixed(2)}
								</p>
								{#if (p.user as any)?.favorite_team}
									{@const url = flagUrl((p.user as any).favorite_team)}
									{#if url}
										<img src={url} alt={(p.user as any).favorite_team}
											class="w-5 h-3.5 object-cover rounded-sm mt-1 opacity-80" />
									{/if}
								{/if}
							</a>
						{:else}
							<span class="opacity-30 text-center {isFirst ? 'pt-1' : 'pt-4 sm:pt-6'} flex flex-col items-center">
								<span class="rounded-full bg-raised border border-wire
									{isFirst ? 'w-20 h-20 sm:w-24 sm:h-24' : 'w-14 h-14 sm:w-16 sm:h-16'}"></span>
								<span class="mt-4 text-sm text-faint">—</span>
							</span>
						{/if}
					{/each}
				</div>
			</section>
		{/if}

		{#if tableRows.length > 0}
		<div class="-mx-4 sm:mx-0 sm:rounded-xl sm:bg-panel/40 sm:border sm:border-wire overflow-hidden border-y border-wire sm:border-y-0">
			<table class="w-full">
				<thead>
					<tr class="border-b border-wire">
						<th class="px-4 py-3 text-left w-12 text-[11px] text-faint font-semibold">#</th>
						<th class="px-4 py-3 text-left text-[11px] text-faint font-semibold">{t('lb_player')}</th>
						<th class="px-4 py-3 text-right text-[11px] text-faint font-semibold hidden sm:table-cell">{t('lb_picks')}</th>
						<th class="px-4 py-3 text-right text-[11px] text-faint font-semibold hidden md:table-cell">{t('lb_bonus')}</th>
						<th class="px-4 py-3 text-right text-[11px] text-faint font-semibold">{t('lb_total')}</th>
					</tr>
				</thead>
				<tbody>
					{#each tableRows as row (row.userId)}
						{@const isMe = row.userId === data.currentUser?.id}
						<tr class="border-b border-wire/40 last:border-0 transition-colors {isMe ? 'bg-accent-lo/60' : 'hover:bg-raised/40'}">

							<!-- Rank -->
							<td class="px-4 py-3 text-center w-12">
								<span class="text-sm text-faint tabular-nums font-semibold">
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
										+{row.teamBonus.toFixed(2)}
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
										({row.pronoPoints.toFixed(2)}+{row.teamBonus.toFixed(2)})
									</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		{/if}
	{/if}
</div>
