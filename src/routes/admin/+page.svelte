<script lang="ts">
	import { enhance } from '$app/forms';
	import { formatDate } from '$lib/utils';
	import { STAGE_LABELS_FR } from '$lib/wc2026';

	let { data, form } = $props();

	type Match = typeof data.matches[number];

	const stageOrder = ['group', 'round_of_32', 'round_of_16', 'quarters', 'semis', 'third', 'final'];

	const grouped = $derived(
		stageOrder.flatMap((s) => {
			const matches = data.matches.filter((m) => m.stage === s);
			return matches.length ? [{ stage: s, matches }] : [];
		})
	);

	const statusColors: Record<string, string> = {
		upcoming: 'text-faint',
		live: 'text-live font-bold',
		finished: 'text-accent'
	};

	let loadingId = $state<string | null>(null);
	let calcLoadingId = $state<string | null>(null);
	let syncLoading = $state(false);
	let reseedLoading = $state(false);
	let confirmReseed = $state(false);
	let feedback = $state<{ id: string; msg: string } | null>(null);
	let syncFeedback = $state<{ ok: boolean; msg: string; detail?: string } | null>(null);
	let reseedFeedback = $state<{ ok: boolean; msg: string; detail?: string } | null>(null);
</script>

<div class="space-y-6">
	<div class="flex items-center gap-3">
		<h1 class="text-2xl font-bold text-fg" style="font-family: var(--font-display); letter-spacing: 0.02em">Simulateur de matchs</h1>
		<span class="rounded bg-live/10 border border-live/30 px-2 py-0.5 text-xs text-live">ADMIN</span>
	</div>

	<!-- Sync from Odds API -->
	<div class="rounded-xl bg-panel border border-wire p-4 flex items-center gap-4 flex-wrap">
		<div class="flex-1 min-w-0">
			<p class="text-sm font-semibold text-fg">Synchroniser depuis l'API</p>
			<p class="text-xs text-faint mt-0.5">Met à jour les horaires et IDs des matchs depuis The Odds API.</p>
		</div>
		<form method="POST" action="?/syncEvents" use:enhance={() => {
			syncLoading = true;
			syncFeedback = null;
			return async ({ result, update }) => {
				syncLoading = false;
				if (result.type === 'success' && result.data) {
					const d = result.data as any;
					const detail = d.unmatched?.length
						? `Non trouvés : ${d.unmatched.join(', ')}`
						: undefined;
					syncFeedback = {
						ok: true,
						msg: `✓ ${d.updated} match(s) mis à jour sur ${d.matched} trouvés`,
						detail
					};
					setTimeout(() => syncFeedback = null, 8000);
				} else if (result.type === 'failure') {
					syncFeedback = { ok: false, msg: (result.data as any)?.error ?? 'Erreur' };
				}
				await update({ reset: false });
			};
		}}>
			<button type="submit" disabled={syncLoading}
				class="rounded-lg bg-raised border border-wire hover:border-wire-hi disabled:opacity-40 px-4 py-2 text-sm text-fg transition-colors cursor-pointer whitespace-nowrap">
				{syncLoading ? 'Synchronisation...' : 'Sync API'}
			</button>
		</form>
	</div>

	{#if syncFeedback}
		<div class="rounded px-4 py-3 text-sm {syncFeedback.ok ? 'bg-accent-lo border border-accent/30 text-accent' : 'bg-err/10 border border-err/30 text-err'}">
			{syncFeedback.msg}
			{#if syncFeedback.detail}
				<p class="text-xs mt-1 opacity-70">{syncFeedback.detail}</p>
			{/if}
		</div>
	{/if}

	<!-- Reseed group stage from API (destructive) -->
	<div class="rounded-xl bg-panel border border-err/20 p-4 flex items-center gap-4 flex-wrap">
		<div class="flex-1 min-w-0">
			<p class="text-sm font-semibold text-fg">Reconstruire depuis l'API <span class="text-xs text-err font-normal ml-1">Destructif</span></p>
			<p class="text-xs text-faint mt-0.5">Supprime tous les matchs de groupe + pronostics et les recrée depuis The Odds API. Les phases éliminatoires (TBD) restent intactes.</p>
		</div>
		{#if confirmReseed}
			<div class="flex items-center gap-2 shrink-0">
				<span class="text-xs text-faint">Confirmer ?</span>
				<form method="POST" action="?/reseedFromApi" use:enhance={() => {
					reseedLoading = true;
					confirmReseed = false;
					reseedFeedback = null;
					return async ({ result, update }) => {
						reseedLoading = false;
						if (result.type === 'success' && result.data) {
							const d = result.data as any;
							reseedFeedback = {
								ok: true,
								msg: `✓ ${d.inserted} matchs insérés — ${d.api_confirmed ?? 0} horaires confirmés API, ${(d.inserted ?? 72) - (d.api_confirmed ?? 0)} approx.`,
							};
							setTimeout(() => reseedFeedback = null, 10000);
						} else if (result.type === 'failure') {
							reseedFeedback = { ok: false, msg: (result.data as any)?.error ?? 'Erreur' };
						}
						await update({ reset: false });
					};
				}}>
					<button type="submit" disabled={reseedLoading}
						class="rounded bg-err/10 border border-err/40 hover:bg-err/20 disabled:opacity-40 px-3 py-1.5 text-xs text-err transition-colors cursor-pointer">
						{reseedLoading ? '...' : 'Oui, reconstruire'}
					</button>
				</form>
				<button onclick={() => confirmReseed = false}
					class="text-xs text-muted hover:text-fg transition-colors cursor-pointer">
					Annuler
				</button>
			</div>
		{:else}
			<button onclick={() => confirmReseed = true}
				class="rounded-lg border border-err/30 hover:border-err/60 px-4 py-2 text-sm text-err/70 hover:text-err transition-colors cursor-pointer whitespace-nowrap shrink-0">
				Reconstruire
			</button>
		{/if}
	</div>

	{#if reseedFeedback}
		<div class="rounded px-4 py-3 text-sm {reseedFeedback.ok ? 'bg-accent-lo border border-accent/30 text-accent' : 'bg-err/10 border border-err/30 text-err'}">
			{reseedFeedback.msg}
			{#if reseedFeedback.detail}
				<p class="text-xs mt-1 opacity-70">{reseedFeedback.detail}</p>
			{/if}
		</div>
	{/if}

	{#if form?.error}
		<div class="rounded bg-err/10 border border-err/30 px-4 py-3 text-sm text-err">{form.error}</div>
	{/if}
	{#if feedback}
		<div class="rounded bg-accent-lo border border-accent/30 px-4 py-3 text-sm text-accent">{feedback.msg}</div>
	{/if}

	{#each grouped as { stage, matches }}
		<section>
			<h2 class="text-sm font-bold text-accent uppercase tracking-wider mb-3">
				{STAGE_LABELS_FR[stage] ?? stage}
			</h2>

			<div class="rounded-xl bg-panel border border-wire overflow-hidden">
				{#each matches as match, i}
					<div class="border-b border-wire last:border-0 p-4">
						<!-- Match header -->
						<div class="flex items-center gap-2 mb-3">
							{#if match.home_flag}<img src="https://flagcdn.com/w20/{match.home_flag.toLowerCase()}.png" alt="" class="w-5 h-3.5 object-cover rounded shrink-0" />{/if}
							<span class="font-semibold text-fg text-sm">{match.home_team}</span>
							<span class="text-faint text-xs mx-1">vs</span>
							<span class="font-semibold text-fg text-sm">{match.away_team}</span>
							{#if match.away_flag}<img src="https://flagcdn.com/w20/{match.away_flag.toLowerCase()}.png" alt="" class="w-5 h-3.5 object-cover rounded shrink-0" />{/if}
							<span class="ml-auto text-xs text-faint">{formatDate(match.match_datetime)}</span>
							<span class="text-xs {statusColors[match.status] ?? 'text-faint'} uppercase">
								{match.status === 'upcoming' ? 'À venir' : match.status === 'live' ? 'En cours' : match.status === 'finished' ? 'Terminé' : match.status}
							</span>
						</div>

						<!-- Controls -->
						<form method="POST" action="?/update" use:enhance={({ formData }) => {
							loadingId = match.id;
							return async ({ result, update }) => {
								loadingId = null;
								if (result.type === 'success') {
									feedback = { id: match.id, msg: `✓ ${match.home_team} – ${match.away_team} mis à jour` };
									setTimeout(() => feedback = null, 3000);
								}
								await update({ reset: false });
							};
						}} class="flex flex-wrap items-end gap-3">
							<input type="hidden" name="id" value={match.id} />

							<!-- Status -->
							<div>
								<label for="status-{match.id}" class="block text-xs text-muted mb-1">Statut</label>
								<select id="status-{match.id}" name="status"
									class="rounded bg-raised border border-wire px-2 py-1.5 text-sm text-fg focus:border-accent focus:outline-none">
									{#each [['upcoming', 'À venir'], ['live', 'En cours'], ['finished', 'Terminé']] as [val, label]}
										<option value={val} selected={match.status === val}>{label}</option>
									{/each}
								</select>
							</div>

							<!-- Scores -->
							<div>
								<label for="hs-{match.id}" class="block text-xs text-muted mb-1">{match.home_team}</label>
								<input id="hs-{match.id}" name="home_score" type="number" min="0" max="20"
									value={match.home_score ?? ''}
									class="w-16 rounded bg-raised border border-wire px-2 py-1.5 text-sm text-fg text-center focus:border-accent focus:outline-none"
									placeholder="–" />
							</div>

							<span class="text-faint font-bold pb-1.5">–</span>

							<div>
								<label for="as-{match.id}" class="block text-xs text-muted mb-1">{match.away_team}</label>
								<input id="as-{match.id}" name="away_score" type="number" min="0" max="20"
									value={match.away_score ?? ''}
									class="w-16 rounded bg-raised border border-wire px-2 py-1.5 text-sm text-fg text-center focus:border-accent focus:outline-none"
									placeholder="–" />
							</div>

							<button type="submit" disabled={loadingId === match.id}
								class="rounded bg-accent hover:bg-accent-hi disabled:opacity-40 px-3 py-1.5 text-sm text-canvas transition-colors cursor-pointer">
								{loadingId === match.id ? '...' : 'Appliquer'}
							</button>

							<!-- Calculate scores button (only for finished) -->
							{#if match.status === 'finished'}
								<form method="POST" action="?/calculate" use:enhance={() => {
									calcLoadingId = match.id;
									return async ({ result, update }) => {
										calcLoadingId = null;
										if (result.type === 'success' && result.data) {
											feedback = { id: match.id, msg: `✓ ${(result.data as any).scored} pronostic(s) calculé(s)` };
											setTimeout(() => feedback = null, 4000);
										}
										await update({ reset: false });
									};
								}}>
									<input type="hidden" name="match_id" value={match.id} />
									<button type="submit" disabled={calcLoadingId === match.id}
										class="rounded bg-accent-lo border border-accent/40 hover:bg-accent/20 disabled:opacity-40 px-3 py-1.5 text-sm text-accent transition-colors cursor-pointer whitespace-nowrap">
										{calcLoadingId === match.id ? '...' : 'Calculer scores'}
									</button>
								</form>
							{/if}
						</form>
					</div>
				{/each}
			</div>
		</section>
	{/each}
</div>
