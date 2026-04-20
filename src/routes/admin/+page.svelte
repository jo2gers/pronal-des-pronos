<script lang="ts">
	import { enhance } from '$app/forms';
	import { isoToFlag, formatDate } from '$lib/utils';
	import { STAGE_LABELS } from '$lib/wc2026';

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
	let feedback = $state<{ id: string; msg: string } | null>(null);
</script>

<div class="space-y-6">
	<div class="flex items-center gap-3">
		<h1 class="text-2xl font-bold text-fg">Simulateur de matchs</h1>
		<span class="rounded bg-live/10 border border-live/30 px-2 py-0.5 text-xs text-live">ADMIN</span>
	</div>

	{#if form?.error}
		<div class="rounded bg-err/10 border border-err/30 px-4 py-3 text-sm text-err">{form.error}</div>
	{/if}
	{#if feedback}
		<div class="rounded bg-accent-lo border border-accent/30 px-4 py-3 text-sm text-accent">{feedback.msg}</div>
	{/if}

	{#each grouped as { stage, matches }}
		<section>
			<h2 class="text-sm font-bold text-accent uppercase tracking-wider mb-3">
				{STAGE_LABELS[stage] ?? stage}
			</h2>

			<div class="rounded-xl bg-panel border border-wire overflow-hidden">
				{#each matches as match, i}
					<div class="border-b border-wire last:border-0 p-4">
						<!-- Match header -->
						<div class="flex items-center gap-2 mb-3">
							<span class="text-base">{isoToFlag(match.home_flag)}</span>
							<span class="font-semibold text-fg text-sm">{match.home_team}</span>
							<span class="text-faint text-xs mx-1">vs</span>
							<span class="font-semibold text-fg text-sm">{match.away_team}</span>
							<span class="text-base">{isoToFlag(match.away_flag)}</span>
							<span class="ml-auto text-xs text-faint">{formatDate(match.match_datetime)}</span>
							<span class="text-xs {statusColors[match.status] ?? 'text-faint'} uppercase">
								{match.status}
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
									{#each ['upcoming', 'live', 'finished'] as s}
										<option value={s} selected={match.status === s}>{s}</option>
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
