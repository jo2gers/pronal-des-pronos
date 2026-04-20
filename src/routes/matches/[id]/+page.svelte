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

	// Live countdown with urgency
	function getCountdown(dt: string) {
		const diff = new Date(dt).getTime() - Date.now();
		if (diff <= 0) return null;
		return {
			diff,
			days: Math.floor(diff / 86400000),
			hours: Math.floor((diff % 86400000) / 3600000),
			mins: Math.floor((diff % 3600000) / 60000),
			secs: Math.floor((diff % 60000) / 1000)
		};
	}

	let countdown = $state(
		data.match.status === 'upcoming' ? getCountdown(data.match.match_datetime) : null
	);

	$effect(() => {
		if (data.match.status !== 'upcoming') return;
		const t = setInterval(() => {
			countdown = getCountdown(data.match.match_datetime);
		}, 1000);
		return () => clearInterval(t);
	});

	// Urgency levels
	const urgency = $derived(() => {
		if (!countdown) return 'none';
		if (countdown.diff < 2 * 3600000)  return 'locked';   // < 2h  — pronos closed
		if (countdown.diff < 6 * 3600000)  return 'critical'; // < 6h  — red
		if (countdown.diff < 24 * 3600000) return 'warning';  // < 24h — orange
		return 'normal';
	});

	const urgencyColor: Record<string, string> = {
		locked:   'text-faint',
		critical: 'text-live',
		warning:  'text-warn',
		normal:   'text-accent',
		none:     'text-accent'
	};

	const urgencyLabel: Record<string, string> = {
		locked:   'Pronos fermés',
		critical: 'Ferme très bientôt',
		warning:  'Ferme dans moins de 24h',
		normal:   '',
		none:     ''
	};
</script>

<div class="max-w-2xl mx-auto space-y-5">

	<!-- Match header -->
	<div class="rounded-xl bg-panel border border-wire p-6">
		<!-- Meta row -->
		<div class="flex items-center justify-between mb-5 text-xs text-faint">
			<span class="uppercase tracking-wide">
				{STAGE_LABELS[data.match.stage] ?? data.match.stage}
				{data.match.group_label ? ` · Groupe ${data.match.group_label}` : ''}
			</span>
			{#if data.match.venue}
				<span class="hidden sm:block truncate ml-4 max-w-[200px]">{data.match.venue}</span>
			{/if}
		</div>

		<!-- Teams + score -->
		<div class="flex items-center justify-center gap-6 sm:gap-10">
			<div class="text-center flex-1">
				<div class="text-5xl mb-2">{isoToFlag(data.match.home_flag)}</div>
				<p class="font-bold text-base text-fg leading-tight">{data.match.home_team}</p>
			</div>

			<div class="text-center shrink-0">
				{#if data.match.status === 'finished' && data.match.home_score != null}
					<p class="text-5xl font-bold text-accent tabular-nums leading-none"
						style="font-family: var(--font-display)">
						{data.match.home_score}<span class="text-wire-hi mx-2">–</span>{data.match.away_score}
					</p>
					<p class="text-xs text-faint mt-2 uppercase tracking-wider">Terminé</p>
				{:else if data.match.status === 'live'}
					<p class="text-5xl font-bold text-accent tabular-nums leading-none"
						style="font-family: var(--font-display)">
						{data.match.home_score ?? 0}<span class="text-wire-hi mx-2">–</span>{data.match.away_score ?? 0}
					</p>
					<span class="inline-flex items-center gap-1.5 mt-2">
						<span class="w-1.5 h-1.5 rounded-full bg-live animate-pulse"></span>
						<span class="text-xs font-bold text-live uppercase tracking-wider">Live</span>
					</span>
				{:else}
					<!-- Upcoming: countdown -->
					{#if countdown}
						<div class="space-y-1">
							{#if countdown.days > 0}
								<p class="text-3xl font-bold tabular-nums {urgencyColor[urgency()]}"
									style="font-family: var(--font-display)">
									J–{countdown.days}
									<span class="text-xl text-faint">
										{String(countdown.hours).padStart(2, '0')}h{String(countdown.mins).padStart(2, '0')}
									</span>
								</p>
							{:else}
								<p class="text-4xl font-bold tabular-nums {urgencyColor[urgency()]}"
									style="font-family: var(--font-display)">
									{String(countdown.hours).padStart(2, '0')}:{String(countdown.mins).padStart(2, '0')}:{String(countdown.secs).padStart(2, '0')}
								</p>
							{/if}
							{#if urgencyLabel[urgency()]}
								<p class="text-xs {urgencyColor[urgency()]} font-semibold uppercase tracking-wider">
									{urgencyLabel[urgency()]}
								</p>
							{:else}
								<p class="text-xs text-faint">{formatDate(data.match.match_datetime)}</p>
							{/if}
						</div>
					{:else}
						<p class="text-sm text-muted">{formatDate(data.match.match_datetime)}</p>
					{/if}
				{/if}
			</div>

			<div class="text-center flex-1">
				<div class="text-5xl mb-2">{isoToFlag(data.match.away_flag)}</div>
				<p class="font-bold text-base text-fg leading-tight">{data.match.away_team}</p>
			</div>
		</div>

		<!-- Odds -->
		{#if data.odds}
			<div class="mt-6 pt-4 border-t border-wire flex justify-center gap-8 text-center">
				<div>
					<p class="text-xs text-faint mb-1">{data.match.home_team}</p>
					<p class="text-xl font-bold text-fg tabular-nums" style="font-family: var(--font-display)">
						{data.odds.home_win?.toFixed(2) ?? '–'}
					</p>
				</div>
				<div>
					<p class="text-xs text-faint mb-1">Nul</p>
					<p class="text-xl font-bold text-fg tabular-nums" style="font-family: var(--font-display)">
						{data.odds.draw?.toFixed(2) ?? '–'}
					</p>
				</div>
				<div>
					<p class="text-xs text-faint mb-1">{data.match.away_team}</p>
					<p class="text-xl font-bold text-fg tabular-nums" style="font-family: var(--font-display)">
						{data.odds.away_win?.toFixed(2) ?? '–'}
					</p>
				</div>
			</div>
		{/if}
	</div>

	<!-- Pronostic form -->
	{#if data.user}
		<div class="rounded-xl bg-panel border border-wire p-6">
			<div class="flex items-center justify-between mb-5">
				<h2 class="text-sm font-bold text-faint uppercase tracking-widest">Ton pronostic</h2>
				{#if locked}
					<span class="text-xs text-faint border border-wire rounded px-2 py-0.5">Fermé</span>
				{:else}
					<span class="text-xs text-success border border-success/30 rounded px-2 py-0.5" style="color: var(--color-success)">Ouvert</span>
				{/if}
			</div>

			{#if form?.error}
				<div class="mb-4 text-sm text-err">{form.error}</div>
			{/if}
			{#if form?.success}
				<div class="mb-4 text-sm" style="color: var(--color-success)">Pronostic enregistré !</div>
			{/if}

			<form method="POST" action="?/pronostic" use:enhance={() => {
				loading = true;
				return async ({ update }) => { loading = false; await update(); };
			}}>
				<div class="flex items-center justify-center gap-8 mb-5">
					<!-- Home score -->
					<div class="text-center">
						<p class="text-xs text-muted mb-3">{data.match.home_team}</p>
						<div class="flex items-center gap-3">
							<button type="button" disabled={locked || home === 0}
								onclick={() => home--}
								class="w-9 h-9 rounded-full bg-raised hover:bg-wire-hi disabled:opacity-20 text-fg text-lg font-bold transition-colors cursor-pointer">−</button>
							<span class="text-4xl font-bold text-fg w-12 text-center tabular-nums"
								style="font-family: var(--font-display)">{home}</span>
							<button type="button" disabled={locked || home >= 20}
								onclick={() => home++}
								class="w-9 h-9 rounded-full bg-raised hover:bg-wire-hi disabled:opacity-20 text-fg text-lg font-bold transition-colors cursor-pointer">+</button>
						</div>
						<input type="hidden" name="predicted_home" value={home} />
					</div>

					<span class="text-2xl text-faint font-bold mt-4" style="font-family: var(--font-display)">–</span>

					<!-- Away score -->
					<div class="text-center">
						<p class="text-xs text-muted mb-3">{data.match.away_team}</p>
						<div class="flex items-center gap-3">
							<button type="button" disabled={locked || away === 0}
								onclick={() => away--}
								class="w-9 h-9 rounded-full bg-raised hover:bg-wire-hi disabled:opacity-20 text-fg text-lg font-bold transition-colors cursor-pointer">−</button>
							<span class="text-4xl font-bold text-fg w-12 text-center tabular-nums"
								style="font-family: var(--font-display)">{away}</span>
							<button type="button" disabled={locked || away >= 20}
								onclick={() => away++}
								class="w-9 h-9 rounded-full bg-raised hover:bg-wire-hi disabled:opacity-20 text-fg text-lg font-bold transition-colors cursor-pointer">+</button>
						</div>
						<input type="hidden" name="predicted_away" value={away} />
					</div>
				</div>

				{#if !locked}
					{#if data.odds}
						{@const outcome = Math.sign(home - away)}
						{@const oddsUsed = outcome > 0 ? data.odds.home_win : outcome === 0 ? data.odds.draw : data.odds.away_win}
						<p class="text-xs text-center text-faint mb-4">
							Cote <span class="text-accent font-semibold">{oddsUsed?.toFixed(2) ?? '1.00'}</span>
							· Score exact
							<span class="text-accent font-semibold">{((oddsUsed ?? 1) * 3).toFixed(2)} pts</span>
							· Vainqueur
							<span class="text-muted">{((oddsUsed ?? 1) * 1).toFixed(2)} pts</span>
						</p>
					{/if}
					<button type="submit" disabled={loading}
						class="w-full rounded-lg bg-accent hover:bg-accent-hi disabled:opacity-50 px-4 py-3 font-semibold text-canvas transition-colors cursor-pointer">
						{loading ? 'Enregistrement...' : data.userPronostic ? 'Modifier mon prono' : 'Soumettre mon prono'}
					</button>
				{:else}
					<p class="text-center text-sm text-faint">Les pronostics sont fermés pour ce match.</p>
				{/if}
			</form>

			{#if data.userPronostic?.is_scored}
				<div class="mt-5 pt-5 border-t border-wire text-center">
					<p class="text-xs text-faint uppercase tracking-widest mb-1">Points gagnés</p>
					<p class="text-5xl font-bold text-accent tabular-nums" style="font-family: var(--font-display)">
						{data.userPronostic.points_earned?.toFixed(2)}
					</p>
				</div>
			{/if}
		</div>
	{:else}
		<div class="rounded-xl bg-panel border border-wire p-6 text-center">
			<p class="text-muted mb-3">Connecte-toi pour soumettre un pronostic</p>
			<a href="/auth/login" class="inline-block rounded-lg bg-accent hover:bg-accent-hi px-5 py-2 text-sm font-semibold text-canvas transition-colors">
				Se connecter
			</a>
		</div>
	{/if}

	<!-- All picks (post-match) -->
	{#if data.allPronostics?.length}
		<div>
			<h2 class="text-sm font-bold text-faint uppercase tracking-widest mb-3">Tous les pronostics</h2>
			<div class="rounded-xl bg-panel border border-wire overflow-hidden">
				{#each data.allPronostics as p, i}
					<a href="/profile/{p.user_id ?? ''}"
						class="flex items-center gap-3 px-4 py-3 border-b border-wire/40 last:border-0 hover:bg-raised transition-colors text-sm">
						<span class="text-faint w-6 text-xs tabular-nums">{i + 1}</span>
						<span class="text-muted flex-1 truncate">{p.profiles?.display_name ?? p.profiles?.username ?? '?'}</span>
						<span class="font-mono text-fg tabular-nums">{p.predicted_home} – {p.predicted_away}</span>
						{#if p.is_scored}
							<span class="text-accent font-semibold w-16 text-right tabular-nums"
								style="font-family: var(--font-display)">{p.points_earned?.toFixed(2)}</span>
						{/if}
					</a>
				{/each}
			</div>
		</div>
	{/if}
</div>
