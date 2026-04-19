<script lang="ts">
	import { isoToFlag, formatDate } from '$lib/utils';
	import { STAGE_LABELS } from '$lib/wc2026';

	let { data } = $props();
</script>

<div class="space-y-8">
	<!-- Hero -->
	<div class="rounded-xl bg-gradient-to-br from-green-900 to-green-950 border border-green-800 p-8 text-center">
		<h1 class="text-4xl font-bold text-yellow-400 mb-2">⚽ Coupe du Monde 2026</h1>
		<p class="text-green-300 text-lg">Pronostique, score des points, grimpe au classement !</p>
		{#if !data.user}
			<div class="mt-6 flex gap-4 justify-center">
				<a href="/auth/register" class="bg-yellow-500 hover:bg-yellow-400 text-black font-bold px-6 py-3 rounded-lg transition-colors">
					Commencer gratuitement
				</a>
				<a href="/auth/login" class="border border-green-600 text-green-300 hover:text-white px-6 py-3 rounded-lg transition-colors">
					Se connecter
				</a>
			</div>
		{/if}
	</div>

	{#if data.user && data.stats}
		<!-- User stats -->
		<div class="grid grid-cols-3 gap-4">
			<div class="rounded-lg bg-gray-900 border border-gray-800 p-4 text-center">
				<p class="text-2xl font-bold text-yellow-400">{data.stats.totalPoints.toFixed(1)}</p>
				<p class="text-sm text-gray-400 mt-1">Points total</p>
			</div>
			<div class="rounded-lg bg-gray-900 border border-gray-800 p-4 text-center">
				<p class="text-2xl font-bold text-green-400">#{data.stats.rank ?? '–'}</p>
				<p class="text-sm text-gray-400 mt-1">Classement</p>
			</div>
			<div class="rounded-lg bg-gray-900 border border-gray-800 p-4 text-center">
				<p class="text-2xl font-bold text-blue-400">{data.stats.pronosticsCount}</p>
				<p class="text-sm text-gray-400 mt-1">Pronostics</p>
			</div>
		</div>
	{/if}

	<!-- Upcoming matches -->
	<div>
		<h2 class="text-xl font-bold text-white mb-4">Prochains matchs</h2>
		{#if data.upcomingMatches?.length}
			<div class="space-y-3">
				{#each data.upcomingMatches as match}
					<a href="/matches/{match.id}" class="block rounded-lg bg-gray-900 border border-gray-800 p-4 hover:border-green-700 transition-colors">
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-3 flex-1">
								<span class="text-2xl">{isoToFlag(match.home_flag)}</span>
								<span class="font-semibold">{match.home_team}</span>
							</div>
							<div class="text-center px-4">
								<p class="text-xs text-gray-400">{formatDate(match.match_datetime)}</p>
								<p class="text-xs text-green-400 mt-0.5">{STAGE_LABELS[match.stage] ?? match.stage}</p>
							</div>
							<div class="flex items-center gap-3 flex-1 justify-end">
								<span class="font-semibold">{match.away_team}</span>
								<span class="text-2xl">{isoToFlag(match.away_flag)}</span>
							</div>
						</div>
						{#if data.userPronostics?.[match.id]}
							{@const p = data.userPronostics[match.id]}
							<div class="mt-2 text-center text-sm text-green-400">
								Ton prono : {p.predicted_home} – {p.predicted_away}
							</div>
						{/if}
					</a>
				{/each}
			</div>
			<a href="/matches" class="mt-4 block text-center text-sm text-green-400 hover:text-green-300">
				Voir tous les matchs →
			</a>
		{:else}
			<p class="text-gray-400">Aucun match à venir.</p>
		{/if}
	</div>
</div>
