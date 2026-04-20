<script lang="ts">
	import { isoToFlag, formatDate } from '$lib/utils';
	import { STAGE_LABELS } from '$lib/wc2026';
	import { supabase } from '$lib/supabase';

	let { data } = $props();

	type Match = {
		id: string; home_team: string; away_team: string;
		home_flag: string | null; away_flag: string | null;
		stage: string; match_datetime: string; venue: string | null;
		status: string; home_score: number | null; away_score: number | null;
	};

	let liveMatches = $state<Match[]>(data.liveMatches ?? []);
	let nextMatch = $state<Match | null>(data.nextMatch ?? null);

	// Countdown tick
	function getCountdown(dt: string) {
		const diff = new Date(dt).getTime() - Date.now();
		if (diff <= 0) return null;
		return {
			days: Math.floor(diff / 86400000),
			hours: Math.floor((diff % 86400000) / 3600000),
			mins: Math.floor((diff % 3600000) / 60000),
			secs: Math.floor((diff % 60000) / 1000)
		};
	}

	let countdown = $state(nextMatch ? getCountdown(nextMatch.match_datetime) : null);

	$effect(() => {
		const interval = setInterval(() => {
			countdown = nextMatch ? getCountdown(nextMatch.match_datetime) : null;
		}, 1000);
		return () => clearInterval(interval);
	});

	// Supabase Realtime — subscribe to match updates
	$effect(() => {
		const channel = supabase
			.channel('homepage-matches')
			.on(
				'postgres_changes',
				{ event: 'UPDATE', schema: 'public', table: 'matches' },
				(payload) => {
					const m = payload.new as Match;
					if (m.status === 'live') {
						// Add or update in liveMatches
						const idx = liveMatches.findIndex((x) => x.id === m.id);
						if (idx >= 0) liveMatches[idx] = m;
						else liveMatches = [...liveMatches, m];
						// Remove from next if it was the upcoming one
						if (nextMatch?.id === m.id) nextMatch = null;
					} else if (m.status === 'finished') {
						liveMatches = liveMatches.filter((x) => x.id !== m.id);
					} else if (m.status === 'upcoming') {
						// Refresh next match if needed
						if (!nextMatch || new Date(m.match_datetime) < new Date(nextMatch.match_datetime)) {
							nextMatch = m;
						}
					}
				}
			)
			.subscribe();

		return () => { supabase.removeChannel(channel); };
	});
</script>

<div class="space-y-8">
	<!-- Hero: live scores or countdown -->
	<div class="rounded-xl bg-gradient-to-br from-green-900 to-green-950 border border-green-800 p-6 sm:p-8">

		{#if liveMatches.length > 0}
			<!-- Live scores -->
			<div class="flex items-center justify-center gap-2 mb-4">
				<span class="animate-pulse inline-block w-2 h-2 rounded-full bg-red-500"></span>
				<span class="text-red-400 text-sm font-bold uppercase tracking-widest">En direct</span>
			</div>
			<div class="grid gap-4 {liveMatches.length > 1 ? 'sm:grid-cols-2' : 'max-w-sm mx-auto'}">
				{#each liveMatches as match}
					<a href="/matches/{match.id}"
						class="rounded-lg bg-black/30 border border-red-900/50 hover:border-red-600 transition-colors p-4 text-center block">
						<p class="text-xs text-gray-400 mb-3">{STAGE_LABELS[match.stage] ?? match.stage}</p>
						<div class="flex items-center justify-between gap-3">
							<div class="flex-1 text-center">
								<div class="text-3xl mb-1">{isoToFlag(match.home_flag)}</div>
								<p class="text-sm font-semibold text-white leading-tight">{match.home_team}</p>
							</div>
							<div class="text-center shrink-0">
								<p class="text-3xl font-bold text-yellow-400 tabular-nums">
									{match.home_score ?? 0} <span class="text-gray-500">–</span> {match.away_score ?? 0}
								</p>
								<span class="inline-block mt-1 rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">LIVE</span>
							</div>
							<div class="flex-1 text-center">
								<div class="text-3xl mb-1">{isoToFlag(match.away_flag)}</div>
								<p class="text-sm font-semibold text-white leading-tight">{match.away_team}</p>
							</div>
						</div>
					</a>
				{/each}
			</div>

		{:else if nextMatch}
			<!-- Countdown -->
			<p class="text-green-400 text-sm font-semibold uppercase tracking-widest mb-3 text-center">Prochain match dans</p>
			{#if countdown}
				<div class="flex justify-center gap-3 sm:gap-6 mb-4">
					{#each [
						{ v: countdown.days, label: 'Jours' },
						{ v: countdown.hours, label: 'Heures' },
						{ v: countdown.mins, label: 'Min' },
						{ v: countdown.secs, label: 'Sec' }
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
				<p class="text-2xl font-bold text-yellow-400 text-center mb-4">⚽ Coup d'envoi imminent !</p>
			{/if}
			<a href="/matches/{nextMatch.id}" class="block text-center">
				<p class="text-green-200 text-sm">
					{isoToFlag(nextMatch.home_flag)} {nextMatch.home_team}
					<span class="text-gray-500 mx-1">–</span>
					{nextMatch.away_team} {isoToFlag(nextMatch.away_flag)}
				</p>
				<p class="text-xs text-gray-400 mt-1">{formatDate(nextMatch.match_datetime)}{nextMatch.venue ? ` · ${nextMatch.venue}` : ''}</p>
			</a>

		{:else}
			<p class="text-center text-gray-400">La Coupe du Monde 2026 est terminée. 🏆</p>
		{/if}

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
