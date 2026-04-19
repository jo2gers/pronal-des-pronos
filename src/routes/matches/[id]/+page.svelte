<script lang="ts">
	import { enhance } from '$app/forms';
	import { isoToFlag, formatDate, isMatchLocked } from '$lib/utils';
	import { STAGE_LABELS } from '$lib/wc2026';

	let { data, form } = $props();

	let home = $state(0);
	let away = $state(0);
	let loading = $state(false);

	$effect(() => {
		home = data.userPronostic?.predicted_home ?? 0;
		away = data.userPronostic?.predicted_away ?? 0;
	});

	const locked = $derived(isMatchLocked(data.match.match_datetime));
</script>

<div class="max-w-2xl mx-auto space-y-6">
	<!-- Match header -->
	<div class="rounded-xl bg-gray-900 border border-gray-800 p-6">
		<p class="text-sm text-gray-400 mb-4">
			{STAGE_LABELS[data.match.stage] ?? data.match.stage}
			{data.match.group_label ? ` · Groupe ${data.match.group_label}` : ''}
			{data.match.venue ? ` · ${data.match.venue}` : ''}
		</p>
		<div class="flex items-center justify-center gap-8">
			<div class="text-center flex-1">
				<div class="text-5xl mb-2">{isoToFlag(data.match.home_flag)}</div>
				<p class="font-bold text-lg text-white">{data.match.home_team}</p>
			</div>
			<div class="text-center">
				{#if data.match.status === 'finished' && data.match.home_score != null}
					<p class="text-3xl font-bold text-yellow-400">
						{data.match.home_score} – {data.match.away_score}
					</p>
					<p class="text-sm text-green-400 mt-1">Terminé</p>
				{:else}
					<p class="text-sm text-gray-400">{formatDate(data.match.match_datetime)}</p>
					{#if data.match.status === 'live'}
						<span class="inline-block mt-1 rounded-full bg-red-600 px-3 py-0.5 text-xs font-bold text-white animate-pulse">LIVE</span>
					{/if}
				{/if}
			</div>
			<div class="text-center flex-1">
				<div class="text-5xl mb-2">{isoToFlag(data.match.away_flag)}</div>
				<p class="font-bold text-lg text-white">{data.match.away_team}</p>
			</div>
		</div>

		{#if data.odds}
			<div class="mt-4 flex justify-center gap-6 text-center">
				<div>
					<p class="text-xs text-gray-400 mb-1">Domicile</p>
					<p class="text-lg font-bold text-white">{data.odds.home_win?.toFixed(2) ?? '–'}</p>
				</div>
				<div>
					<p class="text-xs text-gray-400 mb-1">Nul</p>
					<p class="text-lg font-bold text-white">{data.odds.draw?.toFixed(2) ?? '–'}</p>
				</div>
				<div>
					<p class="text-xs text-gray-400 mb-1">Extérieur</p>
					<p class="text-lg font-bold text-white">{data.odds.away_win?.toFixed(2) ?? '–'}</p>
				</div>
			</div>
		{/if}
	</div>

	<!-- Pronostic form -->
	{#if data.user}
		<div class="rounded-xl bg-gray-900 border border-gray-800 p-6">
			<h2 class="text-lg font-semibold text-white mb-4">
				{locked ? 'Ton pronostic' : 'Ton pronostic (ouvert)'}
			</h2>

			{#if form?.error}
				<div class="mb-4 text-sm text-red-400">{form.error}</div>
			{/if}
			{#if form?.success}
				<div class="mb-4 text-sm text-green-400">Pronostic enregistré !</div>
			{/if}

			<form method="POST" action="?/pronostic" use:enhance={() => {
				loading = true;
				return async ({ update }) => { loading = false; await update(); };
			}}>
				<div class="flex items-center justify-center gap-6 mb-4">
					<div class="text-center">
						<p class="text-sm text-gray-400 mb-2">{data.match.home_team}</p>
						<div class="flex items-center gap-2">
							<button type="button" disabled={locked || home === 0}
								onclick={() => home--}
								class="w-9 h-9 rounded-full bg-gray-700 hover:bg-gray-600 disabled:opacity-30 text-white text-lg font-bold transition-colors">
								−
							</button>
							<span class="text-3xl font-bold text-white w-10 text-center">{home}</span>
							<button type="button" disabled={locked || home >= 20}
								onclick={() => home++}
								class="w-9 h-9 rounded-full bg-gray-700 hover:bg-gray-600 disabled:opacity-30 text-white text-lg font-bold transition-colors">
								+
							</button>
						</div>
						<input type="hidden" name="predicted_home" value={home} />
					</div>
					<span class="text-2xl text-gray-500 font-bold mt-4">–</span>
					<div class="text-center">
						<p class="text-sm text-gray-400 mb-2">{data.match.away_team}</p>
						<div class="flex items-center gap-2">
							<button type="button" disabled={locked || away === 0}
								onclick={() => away--}
								class="w-9 h-9 rounded-full bg-gray-700 hover:bg-gray-600 disabled:opacity-30 text-white text-lg font-bold transition-colors">
								−
							</button>
							<span class="text-3xl font-bold text-white w-10 text-center">{away}</span>
							<button type="button" disabled={locked || away >= 20}
								onclick={() => away++}
								class="w-9 h-9 rounded-full bg-gray-700 hover:bg-gray-600 disabled:opacity-30 text-white text-lg font-bold transition-colors">
								+
							</button>
						</div>
						<input type="hidden" name="predicted_away" value={away} />
					</div>
				</div>

				{#if !locked}
					{#if data.odds}
						{@const outcome = Math.sign(home - away)}
						{@const oddsUsed = outcome > 0 ? data.odds.home_win : outcome === 0 ? data.odds.draw : data.odds.away_win}
						<p class="text-xs text-center text-gray-400 mb-3">
							Cote utilisée : <span class="text-yellow-400 font-semibold">{oddsUsed?.toFixed(2) ?? '1.00'}</span>
							· Exact → <span class="text-green-400">{((oddsUsed ?? 1) * 3).toFixed(2)} pts</span>
							· Vainqueur → <span class="text-blue-400">{((oddsUsed ?? 1) * 1).toFixed(2)} pts</span>
						</p>
					{/if}
					<button type="submit" disabled={loading}
						class="w-full rounded-lg bg-green-700 hover:bg-green-600 disabled:opacity-50 px-4 py-2.5 font-semibold text-white transition-colors">
						{loading ? 'Enregistrement...' : data.userPronostic ? 'Modifier mon prono' : 'Soumettre mon prono'}
					</button>
				{:else}
					<p class="text-center text-sm text-gray-500">Les pronostics sont fermés.</p>
				{/if}
			</form>

			{#if data.userPronostic?.is_scored}
				<div class="mt-4 text-center">
					<p class="text-sm text-gray-400">Points gagnés :</p>
					<p class="text-3xl font-bold text-yellow-400">{data.userPronostic.points_earned?.toFixed(2)}</p>
				</div>
			{/if}
		</div>
	{:else}
		<div class="rounded-xl bg-gray-900 border border-gray-800 p-6 text-center">
			<p class="text-gray-400 mb-3">Connecte-toi pour soumettre un pronostic</p>
			<a href="/auth/login" class="inline-block rounded-lg bg-green-700 hover:bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors">
				Se connecter
			</a>
		</div>
	{/if}

	<!-- All picks (after match) -->
	{#if data.allPronostics?.length}
		<div class="rounded-xl bg-gray-900 border border-gray-800 p-6">
			<h2 class="text-lg font-semibold text-white mb-4">Tous les pronostics</h2>
			<div class="space-y-2">
				{#each data.allPronostics as p, i}
					<div class="flex items-center gap-3 text-sm">
						<span class="text-gray-500 w-6">#{i + 1}</span>
						<span class="text-gray-300 flex-1">{p.profiles?.display_name ?? p.profiles?.username ?? '?'}</span>
						<span class="font-mono text-white">{p.predicted_home} – {p.predicted_away}</span>
						{#if p.is_scored}
							<span class="text-yellow-400 font-semibold w-16 text-right">{p.points_earned?.toFixed(2)} pts</span>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
