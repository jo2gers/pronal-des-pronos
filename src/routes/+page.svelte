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

	$effect(() => {
		const channel = supabase
			.channel('homepage-matches')
			.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches' }, (payload) => {
				const m = payload.new as Match;
				if (m.status === 'live') {
					const idx = liveMatches.findIndex((x) => x.id === m.id);
					if (idx >= 0) liveMatches[idx] = m;
					else liveMatches = [...liveMatches, m];
					if (nextMatch?.id === m.id) nextMatch = null;
				} else if (m.status === 'finished') {
					liveMatches = liveMatches.filter((x) => x.id !== m.id);
				} else if (m.status === 'upcoming') {
					if (!nextMatch || new Date(m.match_datetime) < new Date(nextMatch.match_datetime)) nextMatch = m;
				}
			})
			.subscribe();
		return () => { supabase.removeChannel(channel); };
	});
</script>

<div class="space-y-8">

	<!-- Hero -->
	<div class="rounded-xl bg-panel border-t-2 border-t-accent px-6 py-8 sm:px-10">

		{#if liveMatches.length > 0}
			<div class="flex items-center justify-center gap-2 mb-5">
				<span class="animate-pulse inline-block w-2 h-2 rounded-full bg-live"></span>
				<span class="text-live text-xs font-bold uppercase tracking-widest">En direct</span>
			</div>
			<div class="grid gap-3 {liveMatches.length > 1 ? 'sm:grid-cols-2' : 'max-w-sm mx-auto'}">
				{#each liveMatches as match}
					<a href="/matches/{match.id}"
						class="rounded-lg bg-canvas border border-live/30 hover:border-live transition-colors px-4 py-5 text-center block">
						<p class="text-xs text-muted mb-3 uppercase tracking-wide">{STAGE_LABELS[match.stage] ?? match.stage}</p>
						<div class="flex items-center justify-between gap-3">
							<div class="flex-1 text-center">
								<div class="text-3xl mb-1">{isoToFlag(match.home_flag)}</div>
								<p class="text-sm font-semibold text-fg leading-tight">{match.home_team}</p>
							</div>
							<div class="text-center shrink-0 px-3">
								<p class="text-4xl font-bold text-accent tabular-nums leading-none"
									style="font-family: var(--font-display)">
									{match.home_score ?? 0}<span class="text-muted text-2xl mx-1">–</span>{match.away_score ?? 0}
								</p>
								<span class="inline-block mt-2 rounded bg-live px-2 py-0.5 text-xs font-bold text-fg tracking-wider">LIVE</span>
							</div>
							<div class="flex-1 text-center">
								<div class="text-3xl mb-1">{isoToFlag(match.away_flag)}</div>
								<p class="text-sm font-semibold text-fg leading-tight">{match.away_team}</p>
							</div>
						</div>
					</a>
				{/each}
			</div>

		{:else if nextMatch}
			<p class="text-muted text-xs font-bold uppercase tracking-widest mb-4 text-center">Prochain match</p>
			{#if countdown}
				<div class="flex justify-center gap-2 sm:gap-8 mb-5">
					{#each [
						{ v: countdown.days, label: 'Jours' },
						{ v: countdown.hours, label: 'Heures' },
						{ v: countdown.mins, label: 'Min' },
						{ v: countdown.secs, label: 'Sec' }
					] as unit}
						<div class="flex flex-col items-center min-w-[52px] sm:min-w-[72px]">
							<span class="text-4xl sm:text-6xl font-bold text-accent tabular-nums leading-none"
								style="font-family: var(--font-display)">
								{String(unit.v).padStart(2, '0')}
							</span>
							<span class="text-xs text-faint mt-2 uppercase tracking-widest">{unit.label}</span>
						</div>
					{/each}
				</div>
			{:else}
				<p class="text-3xl font-bold text-accent text-center mb-5" style="font-family: var(--font-display)">
					Coup d'envoi imminent !
				</p>
			{/if}
			<a href="/matches/{nextMatch.id}" class="block text-center group">
				<p class="text-muted text-sm group-hover:text-fg transition-colors">
					{isoToFlag(nextMatch.home_flag)} <span class="font-medium text-fg">{nextMatch.home_team}</span>
					<span class="text-faint mx-2">vs</span>
					<span class="font-medium text-fg">{nextMatch.away_team}</span> {isoToFlag(nextMatch.away_flag)}
				</p>
				<p class="text-xs text-faint mt-1">{formatDate(nextMatch.match_datetime)}{nextMatch.venue ? ` · ${nextMatch.venue}` : ''}</p>
			</a>

		{:else}
			<p class="text-center text-muted py-4">La Coupe du Monde 2026 est terminée.</p>
		{/if}

		{#if !data.user}
			<div class="mt-6 flex gap-3 justify-center flex-wrap">
				<a href="/auth/register" class="bg-accent hover:bg-accent-hi text-canvas font-bold px-6 py-2.5 rounded-lg transition-colors text-sm">
					Commencer gratuitement
				</a>
				<a href="/auth/login" class="border border-wire text-muted hover:text-fg hover:border-wire-hi px-6 py-2.5 rounded-lg transition-colors text-sm">
					Se connecter
				</a>
			</div>
		{/if}
	</div>

	<!-- User status line — replaces the 3-card hero metric layout -->
	{#if data.user && data.stats}
		<div class="flex items-center gap-3 px-1">
			<div class="flex items-center gap-2 min-w-0">
				<span class="text-xs text-faint uppercase tracking-widest shrink-0">Ton rang</span>
				<span class="text-lg font-bold text-fg tabular-nums" style="font-family: var(--font-display)">
					#{data.stats.rank ?? '–'}
				</span>
			</div>
			<span class="text-wire-hi">·</span>
			<div class="flex items-center gap-2 min-w-0">
				<span class="text-xs text-faint uppercase tracking-widest shrink-0">Points</span>
				<span class="text-lg font-bold text-accent tabular-nums" style="font-family: var(--font-display)">
					{data.stats.totalPoints.toFixed(1)}
				</span>
				{#if data.stats.teamBonus > 0}
					<span class="text-xs tabular-nums" style="color: var(--color-bonus)">
						+{data.stats.teamBonus} équipe
					</span>
				{/if}
			</div>
			<span class="text-wire-hi">·</span>
			<div class="flex items-center gap-2 min-w-0">
				<span class="text-xs text-faint uppercase tracking-widest shrink-0">Pronos</span>
				<span class="text-lg font-bold text-fg tabular-nums" style="font-family: var(--font-display)">
					{data.stats.pronosticsCount}
				</span>
			</div>
			<a href="/leaderboard" class="ml-auto text-xs text-accent hover:text-accent-hi shrink-0 transition-colors">
				Classement →
			</a>
		</div>
	{/if}

	<!-- Upcoming matches -->
	<div>
		<h2 class="text-sm font-bold text-faint uppercase tracking-widest mb-4">Prochains matchs</h2>
		{#if data.upcomingMatches?.length}
			<div class="rounded-xl bg-panel border border-wire overflow-hidden">
				{#each data.upcomingMatches as match}
					{@const msUntil = new Date(match.match_datetime).getTime() - Date.now()}
					{@const isUrgent = msUntil > 0 && msUntil < 6 * 3600000}
					{@const isWarning = msUntil > 0 && msUntil < 24 * 3600000}
					<a href="/matches/{match.id}" class="block px-4 py-3 border-b border-wire last:border-0 hover:bg-raised transition-colors">
						<div class="flex items-center justify-between gap-2">
							<div class="flex items-center gap-2 flex-1 min-w-0">
								<span class="text-lg shrink-0">{isoToFlag(match.home_flag)}</span>
								<span class="font-medium text-fg text-sm truncate">{match.home_team}</span>
							</div>
							<div class="text-center shrink-0 px-3">
								<p class="text-xs text-muted whitespace-nowrap">{formatDate(match.match_datetime)}</p>
								<p class="text-xs mt-0.5 {isUrgent ? 'text-live font-semibold' : isWarning ? 'text-warn' : 'text-accent'}">
									{STAGE_LABELS[match.stage] ?? match.stage}
								</p>
							</div>
							<div class="flex items-center gap-2 flex-1 min-w-0 justify-end">
								<span class="font-medium text-fg text-sm truncate">{match.away_team}</span>
								<span class="text-lg shrink-0">{isoToFlag(match.away_flag)}</span>
							</div>
						</div>
						{#if data.userPronostics?.[match.id]}
							{@const p = data.userPronostics[match.id]}
							<p class="mt-1 text-xs text-accent">
								Ton prono : {p.predicted_home} – {p.predicted_away}
							</p>
						{/if}
						{#if isUrgent}
							<p class="mt-1 text-xs text-live font-medium">Ferme bientôt</p>
						{/if}
					</a>
				{/each}
			</div>
			<a href="/matches" class="mt-3 block text-right text-sm text-accent hover:text-accent-hi">
				Voir tous les matchs →
			</a>
		{:else}
			<p class="text-muted text-sm">Aucun match à venir.</p>
		{/if}
	</div>

</div>
