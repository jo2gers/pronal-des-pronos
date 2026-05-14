<script lang="ts">
	// NOTE: Admin page is intentionally French-only.
	// It is a single-operator surface; bilingual i18n is not worth the maintenance cost.
	import { enhance } from '$app/forms';
	import { formatDate } from '$lib/utils';
	import { STAGE_LABELS_FR } from '$lib/wc2026';
	import AdminMatchRow from '$lib/components/AdminMatchRow.svelte';

	let { data, form } = $props();

	const stageOrder = ['group', 'round_of_32', 'round_of_16', 'quarters', 'semis', 'third', 'final'];

	const grouped = $derived(
		stageOrder.flatMap((s) => {
			const matches = data.matches.filter((m) => m.stage === s);
			return matches.length ? [{ stage: s, matches }] : [];
		})
	);

	let resetLoading = $state(false);
	let confirmReset = $state(false);
	let oddsLoading = $state(false);
	let wcOddsLoading = $state(false);
	let scorerOddsLoading = $state(false);
	let goalLoadingPlayer = $state<string | null>(null);
	let resetFeedback = $state<{ ok: boolean; msg: string } | null>(null);
	let oddsFeedback = $state<{ ok: boolean; msg: string; detail?: string } | null>(null);
	let wcOddsFeedback = $state<{ ok: boolean; msg: string; detail?: string } | null>(null);
	let scorerOddsFeedback = $state<{ ok: boolean; msg: string; detail?: string } | null>(null);
	let goalsFeedback = $state<{ ok: boolean; msg: string } | null>(null);
	let bracketLoading = $state(false);
	let bracketFeedback = $state<{ ok: boolean; msg: string } | null>(null);
	let calcAllLoading = $state(false);
	let calcAllFeedback = $state<{ ok: boolean; msg: string } | null>(null);
	let confirmDeleteGroupId = $state<string | null>(null);

	const liveCount = $derived(data.matches.filter((m) => m.status === 'live').length);
	const finishedCount = $derived(data.matches.filter((m) => m.status === 'finished').length);

	function ago(ts: string | null): string {
		if (!ts) return 'jamais';
		const diff = Date.now() - new Date(ts).getTime();
		const m = Math.floor(diff / 60000);
		if (m < 1) return "à l'instant";
		if (m < 60) return `il y a ${m} min`;
		const h = Math.floor(m / 60);
		if (h < 24) return `il y a ${h} h`;
		const d = Math.floor(h / 24);
		return `il y a ${d} j`;
	}

	// Color-code freshness. Cron runs daily, so healthy can be up to ~26h old.
	//   ≤ 26h → fg (healthy, within one cycle)
	//   26–50h → warn (missed one cycle)
	//   > 50h or never → err (missed multiple cycles — investigate)
	function staleClass(ts: string | null): string {
		if (!ts) return 'text-err';
		const hours = (Date.now() - new Date(ts).getTime()) / 3_600_000;
		if (hours <= 26) return 'text-fg';
		if (hours <= 50) return 'text-warn';
		return 'text-err';
	}
	let deleteGroupLoadingId = $state<string | null>(null);
	let groupFeedback = $state<{ ok: boolean; msg: string } | null>(null);
</script>

<div class="space-y-6">
	<div class="flex items-baseline justify-between flex-wrap gap-2">
		<h1 class="text-2xl font-bold text-fg" style="font-family: var(--font-display); letter-spacing: 0.02em">Simulateur de matchs</h1>
		<p class="text-xs text-faint">Cron auto-sync : 1×/jour (06:00 UTC)</p>
	</div>

	<!-- KPI status strip — at-a-glance freshness for every sync source -->
	<dl class="grid grid-cols-2 sm:grid-cols-4 gap-3">
		<div class="rounded-lg bg-panel border border-wire px-3 py-2.5">
			<dt class="text-[11px] text-faint">Cotes matchs</dt>
			<dd class="text-sm font-semibold mt-0.5 {staleClass(data.oddsFreshness?.matchOdds ?? null)}">
				{ago(data.oddsFreshness?.matchOdds ?? null)}
			</dd>
		</div>
		<div class="rounded-lg bg-panel border border-wire px-3 py-2.5">
			<dt class="text-[11px] text-faint">Cotes vainqueur</dt>
			<dd class="text-sm font-semibold mt-0.5 {staleClass(data.oddsFreshness?.wcWinnerOdds ?? null)}">
				{ago(data.oddsFreshness?.wcWinnerOdds ?? null)}
			</dd>
		</div>
		<div class="rounded-lg bg-panel border border-wire px-3 py-2.5">
			<dt class="text-[11px] text-faint">Cotes buteur</dt>
			<dd class="text-sm font-semibold mt-0.5 {staleClass(data.oddsFreshness?.topScorerOdds ?? null)}">
				{ago(data.oddsFreshness?.topScorerOdds ?? null)}
			</dd>
		</div>
		<div class="rounded-lg bg-panel border border-wire px-3 py-2.5">
			<dt class="text-[11px] text-faint">Matchs</dt>
			<dd class="text-sm font-semibold mt-0.5 tabular-nums">
				{#if liveCount > 0}<span class="text-live">{liveCount} en direct</span> · {/if}<span class="text-fg">{finishedCount}</span><span class="text-faint">/{data.matches.length}</span>
			</dd>
		</div>
	</dl>

	<!-- Sync WC winner odds from Polymarket -->
	<div class="rounded-xl bg-panel border border-wire p-4 flex items-center gap-4 flex-wrap">
		<div class="flex-1 min-w-0">
			<p class="text-sm font-semibold text-fg">Cotes vainqueur CM · Polymarket</p>
			<p class="text-xs text-faint mt-0.5">Met à jour les cotes « Qui va gagner la Coupe du Monde » dans wc_winner_odds (utilisées pour les bonus équipe).</p>
			<p class="text-[11px] text-faint mt-1">Dernière mise à jour : <span class="text-muted">{ago(data.oddsFreshness?.wcWinnerOdds ?? null)}</span></p>
		</div>
		<form method="POST" action="?/syncWCWinnerOdds" use:enhance={() => {
			wcOddsLoading = true;
			wcOddsFeedback = null;
			return async ({ result, update }) => {
				wcOddsLoading = false;
				if (result.type === 'success' && result.data) {
					const d = result.data as any;
					const detail = d.unmatched?.length ? `Non trouvés : ${d.unmatched.join(', ')}` : undefined;
					wcOddsFeedback = { ok: true, msg: `${d.updated} équipe(s) mises à jour`, detail };
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
			<p class="text-[11px] text-faint mt-1">Dernière mise à jour : <span class="text-muted">{ago(data.oddsFreshness?.topScorerOdds ?? null)}</span></p>
		</div>
		<form method="POST" action="?/syncTopScorerOdds" use:enhance={() => {
			scorerOddsLoading = true;
			scorerOddsFeedback = null;
			return async ({ result, update }) => {
				scorerOddsLoading = false;
				if (result.type === 'success' && result.data) {
					const d = result.data as any;
					const detail = d.skipped?.length ? `Ignorés : ${d.skipped.join(', ')}` : undefined;
					scorerOddsFeedback = { ok: true, msg: `${d.updated} buteur(s) mis à jour`, detail };
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

	<!-- Goals scored editor (collapsible) -->
	{#if data.scorers && data.scorers.length > 0}
		<details open class="group/details rounded-xl bg-panel border border-wire overflow-hidden">
			<summary class="cursor-pointer px-4 py-3 flex items-center justify-between hover:bg-raised/40 transition-colors gap-3 select-none">
				<div class="min-w-0">
					<p class="text-sm font-semibold text-fg">Buts marqués par buteur</p>
					<p class="text-xs text-faint mt-0.5">{data.scorers.length} joueurs · cliquer pour replier/déplier</p>
				</div>
				<svg class="w-4 h-4 text-faint shrink-0 transition-transform group-open/details:rotate-180"
					fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" aria-hidden="true">
					<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
				</svg>
			</summary>
			<div class="px-4 pb-4 pt-1 border-t border-wire/60">
				<p class="text-xs text-faint mb-3">Mettre à jour le nombre de buts. Le bonus = ROUND(LN(cote), 1) × buts.</p>
				{#if goalsFeedback}
					<div class="rounded px-3 py-2 text-xs mb-3 {goalsFeedback.ok ? 'bg-accent-lo border border-accent/30 text-accent' : 'bg-err/10 border border-err/30 text-err'}">
						{goalsFeedback.msg}
					</div>
				{/if}
				<div class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="text-left text-[11px] text-faint font-semibold border-b border-wire">
							<th class="px-2 py-2">Joueur</th>
							<th class="px-2 py-2 text-right">Cote</th>
							<th class="px-2 py-2 text-right">Mult.</th>
							<th class="px-2 py-2 text-right">Buts</th>
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
												goalsFeedback = { ok: true, msg: `${d.player} : ${d.goals} but(s) · bonus ${d.bonus} pts` };
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
		</details>
	{/if}

	<!-- Sync odds from Polymarket -->
	<div class="rounded-xl bg-panel border border-wire p-4 flex items-center gap-4 flex-wrap">
		<div class="flex-1 min-w-0">
			<p class="text-sm font-semibold text-fg">Syncer les cotes Polymarket</p>
			<p class="text-xs text-faint mt-0.5">Récupère les probabilités de victoire/nul/défaite pour chaque match depuis Polymarket et les enregistre en base.</p>
			<p class="text-[11px] text-faint mt-1">Dernière mise à jour : <span class="text-muted">{ago(data.oddsFreshness?.matchOdds ?? null)}</span></p>
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
					oddsFeedback = { ok: true, msg: `${d.updated} match(s) mis à jour`, detail };
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

	<!-- Resolve knockout bracket from standings -->
	<div class="rounded-xl bg-panel border border-wire p-4 flex items-center gap-4 flex-wrap">
		<div class="flex-1 min-w-0">
			<p class="text-sm font-semibold text-fg">Bracket — propager les résultats</p>
			<p class="text-xs text-faint mt-0.5">
				Calcule les classements de groupe (W/R + T1..T8) et remplit les matchs des phases finales (R32 → Final).
				Cascade automatiquement : finir un R32 remplit le R16 correspondant au prochain clic.
			</p>
		</div>
		<form method="POST" action="?/resolveBracket" use:enhance={() => {
			bracketLoading = true;
			bracketFeedback = null;
			return async ({ result, update }) => {
				bracketLoading = false;
				if (result.type === 'success' && result.data) {
					const d = result.data as any;
					bracketFeedback = { ok: true, msg: `${d.updated} match(s) mis à jour (${d.inspected} inspectés)` };
					setTimeout(() => bracketFeedback = null, 6000);
				} else if (result.type === 'failure') {
					bracketFeedback = { ok: false, msg: (result.data as any)?.error ?? 'Erreur' };
				}
				await update({ reset: false });
			};
		}}>
			<button type="submit" disabled={bracketLoading}
				class="rounded-lg bg-raised border border-wire hover:border-wire-hi disabled:opacity-40 px-4 py-2 text-sm text-fg transition-colors cursor-pointer whitespace-nowrap">
				{bracketLoading ? '...' : 'Propager bracket'}
			</button>
		</form>
	</div>

	{#if bracketFeedback}
		<div class="rounded px-4 py-3 text-sm {bracketFeedback.ok ? 'bg-accent-lo border border-accent/30 text-accent' : 'bg-err/10 border border-err/30 text-err'}">
			{bracketFeedback.msg}
		</div>
	{/if}

	<!-- Bulk: recompute scores for every finished match -->
	<div class="rounded-xl bg-panel border border-wire p-4 flex items-center gap-4 flex-wrap">
		<div class="flex-1 min-w-0">
			<p class="text-sm font-semibold text-fg">Calculer tous les scores</p>
			<p class="text-xs text-faint mt-0.5">
				Reset complet : remet à zéro les <span class="text-muted">bonus équipe</span> de tous les profils et le flag
				<span class="text-muted">bonus_calculated</span> de chaque match, puis recalcule tout depuis zéro
				(pronostics + bonus). Idempotent — relancer donne le même résultat.
			</p>
		</div>
		<form method="POST" action="?/calculateAll" use:enhance={() => {
			calcAllLoading = true;
			calcAllFeedback = null;
			return async ({ result, update }) => {
				calcAllLoading = false;
				if (result.type === 'success' && result.data) {
					const d = result.data as any;
					const errs = d.errors ? ` · ${d.errors} erreur(s)` : '';
					const bonus = d.bonusAwarded ? ` · ${d.bonusAwarded} bonus équipe attribué(s)` : '';
					calcAllFeedback = { ok: true, msg: `${d.matches} match(s) · ${d.totalScored} pronostic(s) recalculé(s)${bonus}${errs}` };
					setTimeout(() => calcAllFeedback = null, 10000);
				} else if (result.type === 'failure') {
					calcAllFeedback = { ok: false, msg: (result.data as any)?.error ?? 'Erreur' };
				}
				await update({ reset: false });
			};
		}}>
			<button type="submit" disabled={calcAllLoading}
				class="rounded-lg bg-accent hover:bg-accent-hi disabled:opacity-40 px-4 py-2 text-sm font-bold text-canvas transition-colors cursor-pointer whitespace-nowrap">
				{calcAllLoading ? 'Calcul…' : `Calculer tous (${finishedCount})`}
			</button>
		</form>
	</div>

	{#if calcAllFeedback}
		<div class="rounded px-4 py-3 text-sm {calcAllFeedback.ok ? 'bg-accent-lo border border-accent/30 text-accent' : 'bg-err/10 border border-err/30 text-err'}">
			{calcAllFeedback.msg}
		</div>
	{/if}

	<!-- Leagues management (collapsible, default closed) -->
	{#if data.groups && data.groups.length > 0}
		<details class="group/details rounded-xl bg-panel border border-wire overflow-hidden">
			<summary class="cursor-pointer px-4 py-3 flex items-center justify-between hover:bg-raised/40 transition-colors gap-3 select-none">
				<div class="min-w-0">
					<p class="text-sm font-semibold text-fg">Ligues ({data.groups.length})</p>
					<p class="text-xs text-faint mt-0.5">Cliquer pour gérer la liste</p>
				</div>
				<svg class="w-4 h-4 text-faint shrink-0 transition-transform group-open/details:rotate-180"
					fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" aria-hidden="true">
					<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
				</svg>
			</summary>
			<div class="px-4 pb-4 pt-1 border-t border-wire/60">
				<p class="text-xs text-faint mb-3">Supprimer une ligue efface aussi ses membres, invitations et demandes en attente.</p>
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
		</details>
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
							resetFeedback = { ok: true, msg: 'Tout a été réinitialisé' };
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

	{#each grouped as { stage, matches }, sIdx}
		{@const finishedInStage = matches.filter((m) => m.status === 'finished').length}
		{@const liveInStage = matches.filter((m) => m.status === 'live').length}
		<details open={sIdx === 0 || liveInStage > 0} class="group/details rounded-xl bg-panel border border-wire overflow-hidden">
			<summary class="cursor-pointer px-4 py-3 flex items-center gap-3 hover:bg-raised/40 transition-colors select-none">
				<h2 class="text-base font-semibold text-fg" style="font-family: var(--font-display)">
					{STAGE_LABELS_FR[stage] ?? stage}
				</h2>
				<span class="text-xs text-faint tabular-nums">
					{#if liveInStage > 0}<span class="text-live font-bold">{liveInStage} live</span> · {/if}{finishedInStage}/{matches.length}
				</span>
				<svg class="w-4 h-4 text-faint ml-auto shrink-0 transition-transform group-open/details:rotate-180"
					fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" aria-hidden="true">
					<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
				</svg>
			</summary>

			<div class="border-t border-wire/60">
				{#each matches as match}
					<AdminMatchRow {match} />
				{/each}
			</div>
		</details>
	{/each}
</div>

<style>
	summary { list-style: none; }
	summary::-webkit-details-marker { display: none; }
</style>
