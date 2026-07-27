<script lang="ts">
	// V2 per-competition leaderboard — compact table, fed by the
	// competition_pronostic_stats view. Empty until the season's first scored
	// match; the podium/deltas polish from the archive comes later.
	import { getLang, t } from '$lib/i18n.svelte';
	import { flip } from 'svelte/animate';
	import { cubicOut } from 'svelte/easing';
	import { reveal } from '$lib/motion';
	import CountUp from '$lib/components/CountUp.svelte';

	let { data } = $props();

	const compName = $derived(getLang() === 'fr' ? data.competition.name_fr : data.competition.name_en);
	const fr = $derived(getLang() === 'fr');
</script>

<div class="max-w-2xl mx-auto space-y-6">
	<header in:reveal={{ y: 10 }}>
		<p class="text-[10.5px] uppercase tracking-[0.14em] text-faint" style="font-family: var(--font-mono)">
			{fr ? 'Saison 2026-27' : '2026-27 season'}
		</p>
		<h1 class="text-3xl sm:text-4xl font-bold mt-1" style="font-family: var(--font-display); letter-spacing: -0.03em">
			{t('lb_title')} · {compName}
		</h1>
	</header>

	{#if data.rows.length === 0}
		<div class="rounded-xl bg-panel border border-wire px-6 py-10 text-center" in:reveal={{ delay: 80 }}>
			<p class="text-muted">{fr ? 'Le classement démarre avec le premier match de la saison.' : 'The standings start with the season\'s first match.'}</p>
			<a href="/{data.competition.slug}/matches" class="inline-block mt-4 text-sm text-accent hover:text-accent-hi transition-colors">
				{fr ? 'Faire ses pronos →' : 'Make your picks →'}
			</a>
		</div>
	{:else}
		<div class="-mx-4 sm:mx-0 sm:rounded-xl sm:bg-panel/40 sm:border sm:border-wire overflow-hidden border-y border-wire sm:border-y-0" in:reveal={{ delay: 80 }}>
			<table class="w-full">
				<thead>
					<tr class="border-b border-wire">
						<th class="px-4 py-3 text-left w-12 text-[11px] text-faint font-semibold">#</th>
						<th class="px-4 py-3 text-left text-[11px] text-faint font-semibold">{t('lb_player')}</th>
						<th class="px-4 py-3 text-right text-[11px] text-faint font-semibold hidden sm:table-cell">{t('lb_picks')}</th>
						<th class="px-4 py-3 text-right text-[11px] text-faint font-semibold hidden sm:table-cell">{t('lb_winners')}</th>
						<th class="px-4 py-3 text-right text-[11px] text-faint font-semibold hidden sm:table-cell">{t('lb_exact')}</th>
						<th class="px-4 py-3 text-right text-[11px] text-faint font-semibold">{t('lb_total')}</th>
					</tr>
				</thead>
				<tbody>
					{#each data.rows as row, i (row.userId)}
						{@const isMe = row.userId === data.currentUserId}
						<tr animate:flip={{ duration: 380, easing: cubicOut }}
							class="border-b border-wire/40 last:border-0 transition-colors {isMe ? 'bg-accent-lo/60' : 'hover:bg-raised/40'}">
							<td class="px-4 py-3 text-center w-12">
								<span class="text-sm text-faint tabular-nums font-semibold">{i + 1}</span>
							</td>
							<td class="px-4 py-3">
								<a href="/profile/{row.userId}" class="flex items-center gap-2 hover:opacity-80 transition-opacity">
									{#if row.user?.avatar_url}
										<img src={row.user.avatar_url} alt="" class="w-7 h-7 rounded-full object-cover shrink-0" />
									{:else}
										<span class="w-7 h-7 rounded-full bg-raised border border-wire flex items-center justify-center text-xs font-bold text-muted shrink-0">
											{(row.user?.display_name ?? row.user?.username ?? '?')[0]?.toUpperCase()}
										</span>
									{/if}
									<span class="text-sm truncate {isMe ? 'text-accent font-semibold' : 'text-fg'}">
										{row.user?.display_name ?? row.user?.username ?? '?'}
									</span>
								</a>
							</td>
							<td class="px-4 py-3 text-right text-muted text-sm hidden sm:table-cell tabular-nums">{row.picks}</td>
							<td class="px-4 py-3 text-right hidden sm:table-cell tabular-nums text-sm {row.winners > 0 ? 'text-muted' : 'text-faint'}">{row.winners}</td>
							<td class="px-4 py-3 text-right hidden sm:table-cell tabular-nums text-sm {row.exact > 0 ? 'text-accent font-semibold' : 'text-faint'}">{row.exact}</td>
							<td class="px-4 py-3 text-right tabular-nums">
								<span class="font-bold text-accent" style="font-family: var(--font-display)">
									<CountUp value={row.total} />
								</span>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
