<script lang="ts">
	import { isoToFlag, formatDate } from '$lib/utils';
	import { STAGE_LABELS } from '$lib/wc2026';

	let { data } = $props();

	// First match: Mexico vs Uruguay, June 11 2026 20:00 UTC
	const KICKOFF = new Date('2026-06-11T20:00:00Z');

	function getCountdown() {
		const diff = KICKOFF.getTime() - Date.now();
		if (diff <= 0) return null;
		const days = Math.floor(diff / 86400000);
		const hours = Math.floor((diff % 86400000) / 3600000);
		const mins = Math.floor((diff % 3600000) / 60000);
		const secs = Math.floor((diff % 60000) / 1000);
		return { days, hours, mins, secs };
	}

	let countdown = $state(getCountdown());

	$effect(() => {
		const interval = setInterval(() => {
			countdown = getCountdown();
		}, 1000);
		return () => clearInterval(interval);
	});
</script>

<div class="space-y-8">
	<!-- Countdown hero -->
	<div class="rounded-xl bg-gradient-to-br from-green-900 to-green-950 border border-green-800 p-6 sm:p-8 text-center">
		<p class="text-green-400 text-sm font-semibold uppercase tracking-widest mb-3">Coup d'envoi dans</p>

		{#if countdown}
			<div class="flex justify-center gap-3 sm:gap-6 mb-4">
				{#each [
					{ v: countdown.days, label: 'Jours' },
					{ v: countdown.hours, label: 'Heures' },
					{ v: countdown.mins, label: 'Minutes' },
					{ v: countdown.secs, label: 'Secondes' }
				] as unit}
					<div class="flex flex-col items-center">
						<span class="text-3xl sm:text-5xl font-bold text-yellow-400 tabular-nums w-14 sm:w-20 text-center">
							{String(unit.v).padStart(2, '0')}
						</span>
						<span class="text-xs text-green-400 mt-1 uppercase tracking-wide">{unit.label}</span>
					</div>
				{/each}
			</div>
		{:else}
			<p class="text-2xl font-bold text-yellow-400 mb-4">⚽ C'est parti !</p>
		{/if}

		<p class="text-green-300 text-sm">🇲🇽 Mexique – Uruguay 🇺🇾 · 11 juin 2026 · Estadio Azteca</p>

		{#if !data.user}
			<div class="mt-5 flex gap-3 justify-center flex-wrap">
				<a href="/auth/register" class="bg-yellow-500 hover:bg-yellow-400 text-black font-bold px-5 py-2.5 rounded-lg transition-colors text-sm">
					Commencer gratuitement
				</a>
				<a href="/auth/login" class="border border-green-600 text-green-300 hover:text-white px-5 py-2.5 rounded-lg transition-colors text-sm">
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
