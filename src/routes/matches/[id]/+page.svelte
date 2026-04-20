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
	<div class="rounded-xl bg-panel border border-wire p-6">
		<p class="text-sm text-muted mb-4">
			{STAGE_LABELS[data.match.stage] ?? data.match.stage}
			{data.match.group_label ? ` · Groupe ${data.match.group_label}` : ''}
			{data.match.venue ? ` · ${data.match.venue}` : ''}
		</p>
		<div class="flex items-center justify-center gap-8">
			<div class="text-center flex-1">
				<div class="text-5xl mb-2">{isoToFlag(data.match.home_flag)}</div>
				<p class="font-bold text-lg text-fg">{data.match.home_team}</p>
			</div>
			<div class="text-center">
				{#if data.match.status === 'finished' && data.match.home_score != null}
					<p class="text-3xl font-bold text-accent">
						{data.match.home_score} – {data.match.away_score}
					</p>
					<p class="text-sm text-muted mt-1">Terminé</p>
				{:else}
					<p class="text-sm text-muted">{formatDate(data.match.match_datetime)}</p>
					{#if data.match.status === 'live'}
						<span class="inline-block mt-1 rounded-full bg-live px-3 py-0.5 text-xs font-bold text-fg animate-pulse">LIVE</span>
					{/if}
				{/if}
			</div>
			<div class="text-center flex-1">
				<div class="text-5xl mb-2">{isoToFlag(data.match.away_flag)}</div>
				<p class="font-bold text-lg text-fg">{data.match.away_team}</p>
			</div>
		</div>

		{#if data.odds}
			<div class="mt-4 flex justify-center gap-6 text-center">
				<div>
					<p class="text-xs text-muted mb-1">Domicile</p>
					<p class="text-lg font-bold text-fg">{data.odds.home_win?.toFixed(2) ?? '–'}</p>
				</div>
				<div>
					<p class="text-xs text-muted mb-1">Nul</p>
					<p class="text-lg font-bold text-fg">{data.odds.draw?.toFixed(2) ?? '–'}</p>
				</div>
				<div>
					<p class="text-xs text-muted mb-1">Extérieur</p>
					<p class="text-lg font-bold text-fg">{data.odds.away_win?.toFixed(2) ?? '–'}</p>
				</div>
			</div>
		{/if}
	</div>

	<!-- Pronostic form -->
	{#if data.user}
		<div class="rounded-xl bg-panel border border-wire p-6">
			<h2 class="text-lg font-semibold text-fg mb-4">
				{locked ? 'Ton pronostic' : 'Ton pronostic (ouvert)'}
			</h2>

			{#if form?.error}
				<div class="mb-4 text-sm text-err">{form.error}</div>
			{/if}
			{#if form?.success}
				<div class="mb-4 text-sm text-accent">Pronostic enregistré !</div>
			{/if}

			<form method="POST" action="?/pronostic" use:enhance={() => {
				loading = true;
				return async ({ update }) => { loading = false; await update(); };
			}}>
				<div class="flex items-center justify-center gap-6 mb-4">
					<div class="text-center">
						<p class="text-sm text-muted mb-2">{data.match.home_team}</p>
						<div class="flex items-center gap-2">
							<button type="button" disabled={locked || home === 0}
								onclick={() => home--}
								class="w-9 h-9 rounded-full bg-raised hover:bg-wire disabled:opacity-30 text-fg text-lg font-bold transition-colors">
								−
							</button>
							<span class="text-3xl font-bold text-fg w-10 text-center">{home}</span>
							<button type="button" disabled={locked || home >= 20}
								onclick={() => home++}
								class="w-9 h-9 rounded-full bg-raised hover:bg-wire disabled:opacity-30 text-fg text-lg font-bold transition-colors">
								+
							</button>
						</div>
						<input type="hidden" name="predicted_home" value={home} />
					</div>
					<span class="text-2xl text-faint font-bold mt-4">–</span>
					<div class="text-center">
						<p class="text-sm text-muted mb-2">{data.match.away_team}</p>
						<div class="flex items-center gap-2">
							<button type="button" disabled={locked || away === 0}
								onclick={() => away--}
								class="w-9 h-9 rounded-full bg-raised hover:bg-wire disabled:opacity-30 text-fg text-lg font-bold transition-colors">
								−
							</button>
							<span class="text-3xl font-bold text-fg w-10 text-center">{away}</span>
							<button type="button" disabled={locked || away >= 20}
								onclick={() => away++}
								class="w-9 h-9 rounded-full bg-raised hover:bg-wire disabled:opacity-30 text-fg text-lg font-bold transition-colors">
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
						<p class="text-xs text-center text-muted mb-3">
							Cote : <span class="text-accent font-semibold">{oddsUsed?.toFixed(2) ?? '1.00'}</span>
							· Exact → <span class="text-accent">{((oddsUsed ?? 1) * 3).toFixed(2)} pts</span>
							· Vainqueur → <span class="text-muted">{((oddsUsed ?? 1) * 1).toFixed(2)} pts</span>
						</p>
					{/if}
					<button type="submit" disabled={loading}
						class="w-full rounded-lg bg-accent hover:bg-accent-hi disabled:opacity-50 px-4 py-2.5 font-semibold text-canvas transition-colors">
						{loading ? 'Enregistrement...' : data.userPronostic ? 'Modifier mon prono' : 'Soumettre mon prono'}
					</button>
				{:else}
					<p class="text-center text-sm text-faint">Les pronostics sont fermés.</p>
				{/if}
			</form>

			{#if data.userPronostic?.is_scored}
				<div class="mt-4 text-center">
					<p class="text-sm text-muted">Points gagnés :</p>
					<p class="text-3xl font-bold text-accent">{data.userPronostic.points_earned?.toFixed(2)}</p>
				</div>
			{/if}
		</div>
	{:else}
		<div class="rounded-xl bg-panel border border-wire p-6 text-center">
			<p class="text-muted mb-3">Connecte-toi pour soumettre un pronostic</p>
			<a href="/auth/login" class="inline-block rounded-lg bg-accent hover:bg-accent-hi px-4 py-2 text-sm font-semibold text-canvas transition-colors">
				Se connecter
			</a>
		</div>
	{/if}

	<!-- All picks (after match) -->
	{#if data.allPronostics?.length}
		<div class="rounded-xl bg-panel border border-wire p-6">
			<h2 class="text-lg font-semibold text-fg mb-4">Tous les pronostics</h2>
			<div class="space-y-2">
				{#each data.allPronostics as p, i}
					<div class="flex items-center gap-3 text-sm">
						<span class="text-faint w-6">#{i + 1}</span>
						<span class="text-muted flex-1">{p.profiles?.display_name ?? p.profiles?.username ?? '?'}</span>
						<span class="font-mono text-fg">{p.predicted_home} – {p.predicted_away}</span>
						{#if p.is_scored}
							<span class="text-accent font-semibold w-16 text-right">{p.points_earned?.toFixed(2)} pts</span>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
