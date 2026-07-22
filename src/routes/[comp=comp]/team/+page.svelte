<script lang="ts">
	// Favourite-club picker: a grid of crests with each club's bonus multiplier.
	// The longer the title odds, the bigger every win pays — picking Arsenal is
	// safe money (×1.0), picking Sunderland is a lottery ticket. Locked once the
	// season kicks off.
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { getLang } from '$lib/i18n.svelte';
	import { formatDate } from '$lib/utils';
	import { reveal, pop } from '$lib/motion';

	let { data } = $props();

	const fr = $derived(getLang() === 'fr');
	let saving = $state<string | null>(null);
	let saved = $state(false);
	let errorMsg = $state<string | null>(null);
</script>

<div class="max-w-2xl mx-auto space-y-6">
	<header in:reveal={{ y: 10 }}>
		<p class="text-[10.5px] uppercase tracking-[0.14em] text-faint" style="font-family: var(--font-mono)">
			{fr ? 'Bonus équipe favorite' : 'Favourite team bonus'}
		</p>
		<h1 class="text-3xl sm:text-4xl font-bold mt-1" style="font-family: var(--font-display); letter-spacing: -0.03em">
			{fr ? 'Mon club' : 'My club'}
		</h1>
		<p class="text-sm text-muted mt-3 leading-relaxed max-w-[52ch]">
			{fr
				? 'Chaque victoire de ton club te rapporte automatiquement des points — même sans prono. Plus le club est outsider, plus ça paie.'
				: 'Every win by your club automatically pays you points — no pick needed. The bigger the underdog, the bigger the payout.'}
		</p>
		{#if data.locked}
			<p class="text-[11px] text-warn mt-2">
				{fr ? 'La saison a commencé — ton choix est verrouillé.' : 'The season has started — your pick is locked.'}
			</p>
		{:else if data.startsAt}
			<p class="text-[11px] text-faint mt-2">
				{fr ? 'Modifiable jusqu\'au' : 'Changeable until'} {formatDate(data.startsAt, getLang())}
			</p>
		{/if}
		{#if errorMsg}
			<p class="text-sm text-err mt-2">{errorMsg}</p>
		{:else if saved}
			<p class="text-sm mt-2 flex items-center gap-1.5" style="color: var(--color-success)" in:pop={{ duration: 300 }}>
				<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
				{fr ? 'Club enregistré !' : 'Club saved!'}
			</p>
		{/if}
	</header>

	<div class="grid grid-cols-2 sm:grid-cols-3 gap-2" in:reveal={{ delay: 100, y: 10 }}>
		{#each data.teams as team (team.name_en)}
			{@const perWin = data.perWinByTeam[team.name_en] ?? null}
			{@const selected = data.myTeam === team.name_en}
			<form method="POST" action="?/pick"
				use:enhance={({ formData, cancel }) => {
					if (data.locked || selected) { cancel(); return; }
					formData.set('team', team.name_en);
					saving = team.name_en;
					errorMsg = null;
					return async ({ result }) => {
						saving = null;
						if (result.type === 'success') {
							saved = true;
							setTimeout(() => (saved = false), 2200);
							invalidateAll();
						} else if (result.type === 'failure') {
							errorMsg = String((result.data as any)?.error ?? 'Erreur');
						}
					};
				}}>
				<button type="submit" disabled={data.locked && !selected}
					class="w-full flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors
						{selected
							? 'border-accent bg-accent-lo'
							: data.locked
								? 'border-wire/60 opacity-40'
								: 'border-wire bg-panel hover:border-wire-hi cursor-pointer'}">
					{#if team.logo_url}
						<img src={team.logo_url} alt="" class="w-8 h-8 object-contain shrink-0" loading="lazy" />
					{/if}
					<span class="flex-1 min-w-0">
						<span class="block text-sm font-semibold truncate {selected ? 'text-accent' : 'text-fg'}">
							{team.short_name ?? team.name_en}
						</span>
						{#if perWin != null}
							<span class="block text-[11px] tabular-nums {perWin >= 2 ? 'text-accent' : 'text-faint'}">
								+{perWin} {fr ? 'pts / victoire' : 'pts / win'}
							</span>
						{/if}
					</span>
					{#if saving === team.name_en}
						<span class="w-1.5 h-1.5 rounded-full bg-accent animate-pulse shrink-0"></span>
					{:else if selected}
						<svg class="w-4 h-4 shrink-0 text-accent" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
					{/if}
				</button>
			</form>
		{/each}
	</div>

	{#if data.myTeam && data.myBonus > 0}
		<p class="text-center text-sm text-muted tabular-nums">
			{fr ? 'Bonus accumulé' : 'Accrued bonus'} : <span class="text-accent font-bold">{data.myBonus.toFixed(2)}</span> pts
		</p>
	{/if}
</div>
