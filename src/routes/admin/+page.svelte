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
	let resetLoading = $state(false);
	let confirmReset = $state(false);
	let oddsLoading = $state(false);
	let wcOddsLoading = $state(false);
	let scorerOddsLoading = $state(false);
	let goalLoadingPlayer = $state<string | null>(null);
	let feedback = $state<{ id: string; msg: string } | null>(null);
	let resetFeedback = $state<{ ok: boolean; msg: string } | null>(null);
	let oddsFeedback = $state<{ ok: boolean; msg: string; detail?: string } | null>(null);
	let wcOddsFeedback = $state<{ ok: boolean; msg: string; detail?: string } | null>(null);
	let scorerOddsFeedback = $state<{ ok: boolean; msg: string; detail?: string } | null>(null);
	let goalsFeedback = $state<{ ok: boolean; msg: string } | null>(null);
	let confirmDeleteGroupId = $state<string | null>(null);
	let deleteGroupLoadingId = $state<string | null>(null);
	let groupFeedback = $state<{ ok: boolean; msg: string } | null>(null);
</script>

<div class="space-y-6">
	<div class="flex items-center gap-3">
		<h1 class="text-2xl font-bold text-fg" style="font-family: var(--font-display); letter-spacing: 0.02em">Simulateur de matchs</h1>
		<span class="rounded bg-live/10 border border-live/30 px-2 py-0.5 text-xs text-live">ADMIN</span>
	</div>

	<!-- Sync WC winner odds from Polymarket -->
	<div class="rounded-xl bg-panel border border-wire p-4 flex items-center gap-4 flex-wrap">
		<div class="flex-1 min-w-0">
			<p class="text-sm font-semibold text-fg">Cotes vainqueur CM · Polymarket</p>
			<p class="text-xs text-faint mt-0.5">Met à jour les cotes « Qui va gagner la Coupe du Monde » dans wc_winner_odds (utilisées pour les bonus équipe).</p>
		</div>
		<form method="POST" action="?/syncWCWinnerOdds" use:enhance={() => {
			wcOddsLoading = true;
			wcOddsFeedback = null;
			return async ({ result, update }) => {
				wcOddsLoading = false;
				if (result.type === 'success' && result.data) {
					const d = result.data as any;
					const detail = d.unmatched?.length ? `Non trouvés : ${d.unmatched.join(', ')}` : undefined;
					wcOddsFeedback = { ok: true, msg: `✓ ${d.updated} équipe(s) mises à jour`, detail };
					setTimeout(() => wcOddsFeedback = null, 8000);
				} else if (result.type === 'failure') {
					wcOddsFeedback = { ok: false, msg: (result.data as any)?.error ?? 'Erreur' };
				}
				await update({ reset: false });
			};
		}}>
			<button type="submit" disabled={wcOddsLoading}
				class="rounded-lg bg-raised border border-wire hover:border-wire-hi disabled:opacity-40 px-4 py-2 text-sm text-fg transition-colors cursor-pointer whitespace-nowrap">
				{wcOddsLoading ? '...' : 'Sync vainqueur'}
			</button>
		</form>
	</div>

	{#if wcOddsFeedback}
		<div class="rounded px-4 py-3 text-sm {wcOddsFeedback.ok ? 'bg-accent-lo border border-accent/30 text-accent' : 'bg-err/10 border border-err/30 text-err'}">
			{wcOddsFeedback.msg}
			{#if wcOddsFeedback.detail}<p class="text-xs mt-1 opacity-70">{wcOddsFeedback.detail}</p>{/if}
		</div>
	{/if}

	<!-- Sync top scorer odds from Polymarket -->
	<div class="rounded-xl bg-panel border border-wire p-4 flex items-center gap-4 flex-wrap">
		<div class="flex-1 min-w-0">
			<p class="text-sm font-semibold text-fg">Cotes meilleur buteur · Polymarket</p>
			<p class="text-xs text-faint mt-0.5">Met à jour les cotes « Meilleur buteur de la CM » dans wc_top_scorers (utilisées pour le bonus buteur).</p>
		</div>
		<form method="POST" action="?/syncTopScorerOdds" use:enhance={() => {
			scorerOddsLoading = true;
			scorerOddsFeedback = null;
			return async ({ result, update }) => {
				scorerOddsLoading = false;
				if (result.type === 'success' && result.data) {
					const d = result.data as any;
					const detail = d.skipped?.length ? `Ignorés : ${d.skipped.join(', ')}` : undefined;
					scorerOddsFeedback = { ok: true, msg: `✓ ${d.updated} buteur(s) mis à jour`, detail };
					setTimeout(() => scorerOddsFeedback = null, 8000);
				} else if (result.type === 'failure') {
					scorerOddsFeedback = { ok: false, msg: (result.data as any)?.error ?? 'Erreur' };
				}
				await update({ reset: false });
			};
		}}>
			<button type="submit" disabled={scorerOddsLoading}
				class="rounded-lg bg-raised border border-wire hover:border-wire-hi disabled:opacity-40 px-4 py-2 text-sm text-fg transition-colors cursor-pointer whitespace-nowrap">
				{scorerOddsLoading ? '...' : 'Sync buteurs'}
			</button>
		</form>
	</div>

	{#if scorerOddsFeedback}
		<div class="rounded px-4 py-3 text-sm {scorerOddsFeedback.ok ? 'bg-accent-lo border border-accent/30 text-accent' : 'bg-err/10 border border-err/30 text-err'}">
			{scorerOddsFeedback.msg}
			{#if scorerOddsFeedback.detail}<p class="text-xs mt-1 opacity-70">{scorerOddsFeedback.detail}</p>{/if}
		</div>
	{/if}

	<!-- Goals scored editor -->
	{#if data.scorers && data.scorers.length > 0}
		<div class="rounded-xl bg-panel border border-wire p-4">
			<div class="flex items-center justify-between mb-3 flex-wrap gap-2">
				<div>
					<p class="text-sm font-semibold text-fg">Buts marqués par buteur</p>
					<p class="text-xs text-faint mt-0.5">Mettre à jour le nombre de buts. Le bonus = ROUND(LN(cote), 1) × buts.</p>
				</div>
			</div>
			{#if goalsFeedback}
				<div class="rounded px-3 py-2 text-xs mb-3 {goalsFeedback.ok ? 'bg-accent-lo border border-accent/30 text-accent' : 'bg-err/10 border border-err/30 text-err'}">
					{goalsFeedback.msg}
				</div>
			{/if}
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="text-left text-xs text-faint uppercase tracking-wider border-b border-wire">
							<th class="px-2 py-2 font-semibold">Joueur</th>
							<th class="px-2 py-2 font-semibold text-right">Cote</th>
							<th class="px-2 py-2 font-semibold text-right">Mult.</th>
							<th class="px-2 py-2 font-semibold text-right">Buts</th>
							<th class="px-2 py-2"></th>
						</tr>
					</thead>
					<tbody>
						{#each data.scorers as s}
							<tr class="border-b border-wire/40 last:border-0">
								<td class="px-2 py-2 text-fg font-medium">{s.player_name}</td>
								<td class="px-2 py-2 text-right tabular-nums text-muted">{Number(s.odds).toFixed(2)}</td>
								<td class="px-2 py-2 text-right tabular-nums text-accent font-semibold">{Number(s.multiplier).toFixed(1)}</td>
								<td class="px-2 py-2 text-right">
									<form method="POST" action="?/updateScorerGoals" use:enhance={() => {
										goalLoadingPlayer = s.player_name;
										goalsFeedback = null;
										return async ({ result, update }) => {
											goalLoadingPlayer = null;
											if (result.type === 'success' && result.data) {
												const d = result.data as any;
												goalsFeedback = { ok: true, msg: `✓ ${d.player} : ${d.goals} but(s) · bonus ${d.bonus} pts` };
												setTimeout(() => goalsFeedback = null, 5000);
											} else if (result.type === 'failure') {
												goalsFeedback = { ok: false, msg: (result.data as any)?.error ?? 'Erreur' };
											}
											await update({ reset: false });
										};
									}} class="flex items-center justify-end gap-1.5">
										<input type="hidden" name="player_name" value={s.player_name} />
										<input
											type="number" name="goals_scored" min="0" max="50"
											value={s.goals_scored}
											class="w-16 rounded bg-raised border border-wire px-2 py-1 text-right text-sm text-fg focus:border-accent focus:outline-none"
										/>
										<button type="submit" disabled={goalLoadingPlayer === s.player_name}
											class="rounded bg-accent hover:bg-accent-hi disabled:opacity-40 px-2.5 py-1 text-xs font-semibold text-canvas transition-colors cursor-pointer">
											{goalLoadingPlayer === s.player_name ? '…' : 'OK'}
										</button>
									</form>
								</td>
								<td></td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}

	<!-- Sync odds from Polymarket -->
	<div class="rounded-xl bg-panel border border-wire p-4 flex items-center gap-4 flex-wrap">
		<div class="flex-1 min-w-0">
			<p class="text-sm font-semibold text-fg">Syncer les cotes Polymarket</p>
			<p class="text-xs text-faint mt-0.5">Récupère les probabilités de victoire/nul/défaite pour chaque match depuis Polymarket et les enregistre en base.</p>
		</div>
		<form method="POST" action="?/syncOdds" use:enhance={() => {
			oddsLoading = true;
			oddsFeedback = null;
			return async ({ result, update }) => {
				oddsLoading = false;
				if (result.type === 'success' && result.data) {
					const d = result.data as any;
					const detail = d.unmatched?.length
						? `Non trouvés : ${d.unmatched.join(', ')}`
						: undefined;
					oddsFeedback = { ok: true, msg: `✓ ${d.updated} match(s) mis à jour`, detail };
					setTimeout(() => oddsFeedback = null, 8000);
				} else if (result.type === 'failure') {
					oddsFeedback = { ok: false, msg: (result.data as any)?.error ?? 'Erreur' };
				}
				await update({ reset: false });
			};
		}}>
			<button type="submit" disabled={oddsLoading}
				class="rounded-lg bg-raised border border-wire hover:border-wire-hi disabled:opacity-40 px-4 py-2 text-sm text-fg transition-colors cursor-pointer whitespace-nowrap">
				{oddsLoading ? 'Synchronisation...' : 'Sync cotes'}
			</button>
		</form>
	</div>

	{#if oddsFeedback}
		<div class="rounded px-4 py-3 text-sm {oddsFeedback.ok ? 'bg-accent-lo border border-accent/30 text-accent' : 'bg-err/10 border border-err/30 text-err'}">
			{oddsFeedback.msg}
			{#if oddsFeedback.detail}
				<p class="text-xs mt-1 opacity-70">{oddsFeedback.detail}</p>
			{/if}
		</div>
	{/if}

	<!-- Groups management -->
	{#if data.groups && data.groups.length > 0}
		<div class="rounded-xl bg-panel border border-wire p-4">
			<div class="mb-3">
				<p class="text-sm font-semibold text-fg">Groupes ({data.groups.length})</p>
				<p class="text-xs text-faint mt-0.5">Supprimer un groupe efface aussi ses membres, invitations et demandes en attente.</p>
			</div>
			{#if groupFeedback}
				<div class="rounded px-3 py-2 text-xs mb-3 {groupFeedback.ok ? 'bg-accent-lo border border-accent/30 text-accent' : 'bg-err/10 border border-err/30 text-err'}">
					{groupFeedback.msg}
				</div>
			{/if}
			<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="text-left text-[11px] text-faint font-semibold border-b border-wire">
							<th class="px-2 py-2">Nom</th>
							<th class="px-2 py-2">Code</th>
							<th class="px-2 py-2 text-center">Visibilité</th>
							<th class="px-2 py-2 text-right">Membres</th>
							<th class="px-2 py-2"></th>
						</tr>
					</thead>
					<tbody>
						{#each data.groups as g}
							<tr class="border-b border-wire/40 last:border-0">
								<td class="px-2 py-2 text-fg font-medium">{g.name}</td>
								<td class="px-2 py-2 text-muted tabular-nums">{g.invite_code}</td>
								<td class="px-2 py-2 text-center text-xs text-muted">{g.is_public === false ? 'Privé' : 'Public'}</td>
								<td class="px-2 py-2 text-right tabular-nums text-fg">{g.member_count}</td>
								<td class="px-2 py-2 text-right">
									{#if confirmDeleteGroupId === g.id}
										<form method="POST" action="?/deleteGroup" use:enhance={() => {
											deleteGroupLoadingId = g.id;
											confirmDeleteGroupId = null;
											groupFeedback = null;
											return async ({ result, update }) => {
												deleteGroupLoadingId = null;
												if (result.type === 'success') {
													groupFeedback = { ok: true, msg: `« ${g.name} » supprimé` };
													setTimeout(() => groupFeedback = null, 5000);
												} else if (result.type === 'failure') {
													groupFeedback = { ok: false, msg: (result.data as any)?.error ?? 'Erreur' };
												}
												await update({ reset: false });
											};
										}} class="inline-flex items-center gap-1.5">
											<input type="hidden" name="group_id" value={g.id} />
											<button type="submit" disabled={deleteGroupLoadingId === g.id}
												class="rounded bg-err/10 border border-err/40 hover:bg-err/20 disabled:opacity-40 px-2.5 py-1 text-xs text-err transition-colors cursor-pointer">
												{deleteGroupLoadingId === g.id ? '...' : 'Confirmer'}
											</button>
											<button type="button" onclick={() => confirmDeleteGroupId = null}
												class="text-xs text-muted hover:text-fg transition-colors cursor-pointer">
												Annuler
											</button>
										</form>
									{:else}
										<button onclick={() => confirmDeleteGroupId = g.id}
											class="rounded border border-err/30 hover:border-err/60 px-2.5 py-1 text-xs text-err/70 hover:text-err transition-colors cursor-pointer">
											Supprimer
										</button>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}

	<!-- Reset all (destructive) -->
	<div class="rounded-xl bg-panel border border-err/20 p-4 flex items-center gap-4 flex-wrap">
		<div class="flex-1 min-w-0">
			<p class="text-sm font-semibold text-fg">Tout réinitialiser <span class="text-xs text-err font-normal ml-1">Destructif</span></p>
			<p class="text-xs text-faint mt-0.5">Supprime tous les pronostics, remet tous les scores à zéro et efface les bonus équipe.</p>
		</div>
		{#if confirmReset}
			<div class="flex items-center gap-2 shrink-0">
				<span class="text-xs text-faint">Confirmer ?</span>
				<form method="POST" action="?/resetAll" use:enhance={() => {
					resetLoading = true;
					confirmReset = false;
					resetFeedback = null;
					return async ({ result, update }) => {
						resetLoading = false;
						if (result.type === 'success') {
							resetFeedback = { ok: true, msg: '✓ Tout a été réinitialisé' };
							setTimeout(() => resetFeedback = null, 6000);
						} else if (result.type === 'failure') {
							resetFeedback = { ok: false, msg: (result.data as any)?.error ?? 'Erreur' };
						}
						await update({ reset: false });
					};
				}}>
					<button type="submit" disabled={resetLoading}
						class="rounded bg-err/10 border border-err/40 hover:bg-err/20 disabled:opacity-40 px-3 py-1.5 text-xs text-err transition-colors cursor-pointer">
						{resetLoading ? '...' : 'Oui, tout réinitialiser'}
					</button>
				</form>
				<button onclick={() => confirmReset = false}
					class="text-xs text-muted hover:text-fg transition-colors cursor-pointer">
					Annuler
				</button>
			</div>
		{:else}
			<button onclick={() => confirmReset = true}
				class="rounded-lg border border-err/30 hover:border-err/60 px-4 py-2 text-sm text-err/70 hover:text-err transition-colors cursor-pointer whitespace-nowrap shrink-0">
				Réinitialiser
			</button>
		{/if}
	</div>

	{#if resetFeedback}
		<div class="rounded px-4 py-3 text-sm {resetFeedback.ok ? 'bg-accent-lo border border-accent/30 text-accent' : 'bg-err/10 border border-err/30 text-err'}">
			{resetFeedback.msg}
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
