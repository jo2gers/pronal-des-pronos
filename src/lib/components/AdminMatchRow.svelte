<script lang="ts">
	import { enhance } from '$app/forms';
	import { formatDate } from '$lib/utils';
	import { teamLabel } from '$lib/wc2026';
	import Flag from '$lib/components/Flag.svelte';

	type MatchLike = {
		id: string;
		home_team: string;
		away_team: string;
		home_flag: string | null;
		away_flag: string | null;
		match_datetime: string;
		status: 'upcoming' | 'live' | 'finished';
		home_score: number | null;
		away_score: number | null;
		group_label?: string | null;
	};

	let { match }: { match: MatchLike } = $props();

	let home   = $state(match.home_score ?? 0);
	let away   = $state(match.away_score ?? 0);
	let status = $state<MatchLike['status']>(match.status);

	// Inline edit mode: clicking the score digit shows a text input.
	let editingHome = $state(false);
	let editingAway = $state(false);

	let saveStatus  = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');
	let saveMessage = $state<string | null>(null);  // e.g. "12 picks scored"
	let saveError   = $state<string | null>(null);
	let calcLoading = $state(false);
	let calcMessage = $state<string | null>(null);
	let formEl: HTMLFormElement | null = null;
	let saveTimer: ReturnType<typeof setTimeout> | null = null;

	function clamp(v: number) { return Math.max(0, Math.min(99, v)); }

	function bump(side: 'home' | 'away', dir: 1 | -1) {
		if (side === 'home') home = clamp(home + dir);
		else                 away = clamp(away + dir);
		// Auto-flip to "live" the moment a goal is entered on an upcoming match.
		if (status === 'upcoming' && (home > 0 || away > 0)) status = 'live';
		scheduleSave();
	}

	function commitScore(side: 'home' | 'away') {
		if (side === 'home') { home = clamp(home); editingHome = false; }
		else                 { away = clamp(away); editingAway = false; }
		scheduleSave();
	}

	function setStatus(next: MatchLike['status']) {
		status = next;
		if (next === 'upcoming') { home = 0; away = 0; }
		saveNow();
	}

	function scheduleSave() {
		if (saveTimer) clearTimeout(saveTimer);
		saveStatus = 'saving';
		saveTimer = setTimeout(() => formEl?.requestSubmit(), 500);
	}

	function saveNow() {
		if (saveTimer) clearTimeout(saveTimer);
		saveStatus = 'saving';
		formEl?.requestSubmit();
	}

	const statusColor: Record<MatchLike['status'], string> = {
		upcoming: 'text-faint',
		live:     'text-live font-bold',
		finished: 'text-accent'
	};
</script>

<div class="border-b border-wire last:border-0 p-4">
	<!-- Match header: flags + names + date -->
	<div class="flex items-center gap-2 mb-3 text-sm flex-wrap">
		<Flag code={match.home_flag} size={24} />
		<span class="font-semibold text-fg">{teamLabel(match.home_team)}</span>
		<span class="text-faint text-xs mx-1">vs</span>
		<span class="font-semibold text-fg">{teamLabel(match.away_team)}</span>
		<Flag code={match.away_flag} size={24} />
		<span class="ml-auto text-xs text-faint">{formatDate(match.match_datetime)}</span>
	</div>

	<!-- Hidden form — submitted programmatically on every change -->
	<form bind:this={formEl} method="POST" action="?/update"
		use:enhance={() => {
			return async ({ result, update }) => {
				if (result.type === 'success') {
					const d = result.data as any;
					saveStatus = 'saved';
					saveError = null;
					// Show how many picks were scored, if any.
					const picked: number = d?.scored ?? 0;
					saveMessage = picked > 0
						? `${picked} pronostic${picked > 1 ? 's' : ''} calculé${picked > 1 ? 's' : ''}`
						: null;
					setTimeout(() => {
						if (saveStatus === 'saved') { saveStatus = 'idle'; saveMessage = null; }
					}, 4000);
				} else if (result.type === 'failure') {
					saveStatus = 'error';
					saveError = (result.data as any)?.error ?? null;
				} else if (result.type === 'error') {
					saveStatus = 'error';
					saveError = result.error?.message ?? null;
				}
				await update({ reset: false });
			};
		}}>
		<input type="hidden" name="id"         value={match.id} />
		<input type="hidden" name="status"      value={status} />
		<input type="hidden" name="home_score"  value={home} />
		<input type="hidden" name="away_score"  value={away} />
	</form>

	<!-- Controls row -->
	<div class="flex items-center gap-3 flex-wrap">

		<!-- Status toggle: 3-button bar -->
		<div class="inline-flex rounded-lg bg-canvas border border-wire overflow-hidden text-xs">
			{#each [
				['upcoming', 'À venir'],
				['live',     'En cours'],
				['finished', 'Terminé']
			] as [val, label]}
				{@const isActive = status === val}
				<button type="button" onclick={() => setStatus(val as MatchLike['status'])}
					class="px-2.5 py-1.5 transition-colors cursor-pointer
						{isActive
							? 'bg-accent text-canvas font-semibold'
							: 'text-muted hover:text-fg hover:bg-raised'}">
					{label}
				</button>
			{/each}
		</div>

		<!-- Score entry: stepper buttons + clickable digit input -->
		<!-- HOME -->
		<div class="flex items-center gap-1.5">
			<button type="button" onclick={() => bump('home', -1)}
				disabled={home === 0}
				aria-label="−"
				class="w-9 h-9 rounded-lg bg-canvas hover:bg-wire-hi disabled:opacity-25 text-fg text-base font-bold transition-colors cursor-pointer border border-wire active:scale-95">−</button>

			{#if editingHome}
				<input
					type="number" min="0" max="99"
					bind:value={home}
					autofocus
					onblur={() => commitScore('home')}
					onkeydown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') commitScore('home'); }}
					class="w-12 h-9 rounded-lg bg-canvas border border-accent text-2xl font-bold tabular-nums text-center text-fg focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
					style="font-family: var(--font-display)"
				/>
			{:else}
				<button type="button" onclick={() => editingHome = true}
					title="Cliquer pour saisir"
					class="w-12 h-9 rounded-lg bg-canvas hover:bg-raised border border-wire hover:border-accent text-2xl font-bold tabular-nums text-center text-fg transition-colors cursor-text leading-none"
					style="font-family: var(--font-display)">
					{home}
				</button>
			{/if}

			<button type="button" onclick={() => bump('home', 1)}
				disabled={home === 99}
				aria-label="+"
				class="w-9 h-9 rounded-lg bg-canvas hover:bg-wire-hi disabled:opacity-25 text-fg text-base font-bold transition-colors cursor-pointer border border-wire active:scale-95">+</button>
		</div>

		<span class="text-xl text-wire-hi" style="font-family: var(--font-display)">–</span>

		<!-- AWAY -->
		<div class="flex items-center gap-1.5">
			<button type="button" onclick={() => bump('away', -1)}
				disabled={away === 0}
				aria-label="−"
				class="w-9 h-9 rounded-lg bg-canvas hover:bg-wire-hi disabled:opacity-25 text-fg text-base font-bold transition-colors cursor-pointer border border-wire active:scale-95">−</button>

			{#if editingAway}
				<input
					type="number" min="0" max="99"
					bind:value={away}
					autofocus
					onblur={() => commitScore('away')}
					onkeydown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') commitScore('away'); }}
					class="w-12 h-9 rounded-lg bg-canvas border border-accent text-2xl font-bold tabular-nums text-center text-fg focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
					style="font-family: var(--font-display)"
				/>
			{:else}
				<button type="button" onclick={() => editingAway = true}
					title="Cliquer pour saisir"
					class="w-12 h-9 rounded-lg bg-canvas hover:bg-raised border border-wire hover:border-accent text-2xl font-bold tabular-nums text-center text-fg transition-colors cursor-text leading-none"
					style="font-family: var(--font-display)">
					{away}
				</button>
			{/if}

			<button type="button" onclick={() => bump('away', 1)}
				disabled={away === 99}
				aria-label="+"
				class="w-9 h-9 rounded-lg bg-canvas hover:bg-wire-hi disabled:opacity-25 text-fg text-base font-bold transition-colors cursor-pointer border border-wire active:scale-95">+</button>
		</div>

		<!-- Save / score feedback -->
		<div class="flex items-center gap-2 text-[11px] min-w-[100px]">
			{#if saveStatus === 'saving'}
				<span class="text-faint flex items-center gap-1.5">
					<span class="w-1.5 h-1.5 rounded-full bg-accent animate-pulse"></span>
					Sauvegarde…
				</span>
			{:else if saveStatus === 'saved'}
				<span class="text-accent flex items-center gap-1">
					<svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
					</svg>
					{saveMessage ?? 'Enregistré'}
				</span>
			{:else if saveStatus === 'error'}
				<span class="text-err" title={saveError ?? ''}>⚠ {saveError}</span>
			{/if}
		</div>

		<!-- Recalculer — shown when finished, for when a score correction needs a forced rerun -->
		{#if status === 'finished'}
			<div class="ml-auto inline-flex items-center gap-2">
				<form method="POST" action="?/calculate" use:enhance={() => {
					calcLoading = true;
					calcMessage = null;
					return async ({ result, update }) => {
						calcLoading = false;
						if (result.type === 'success' && result.data) {
							const scored = (result.data as any).scored ?? 0;
							calcMessage = scored === 0
								? 'Aucun pronostic à calculer'
								: `${scored} pronostic(s) recalculé(s)`;
							setTimeout(() => calcMessage = null, 4000);
						} else if (result.type === 'failure') {
							calcMessage = `Erreur : ${(result.data as any)?.error ?? '?'}`;
						}
						await update({ reset: false });
					};
				}}>
					<input type="hidden" name="match_id" value={match.id} />
					<input type="hidden" name="force"    value="1" />
					<button type="submit" disabled={calcLoading || saveStatus === 'saving'}
						title="Forcer un recalcul (utile si le score a été corrigé après coup)"
						class="rounded-lg bg-raised border border-wire hover:border-wire-hi disabled:opacity-40 px-3 py-1.5 text-xs text-muted hover:text-fg transition-colors cursor-pointer whitespace-nowrap">
						{calcLoading ? '…' : 'Recalculer'}
					</button>
				</form>
				{#if calcMessage}
					<span class="text-[11px] {calcMessage.startsWith('Erreur') ? 'text-err' : 'text-accent'}">{calcMessage}</span>
				{/if}
			</div>
		{/if}
	</div>
</div>
