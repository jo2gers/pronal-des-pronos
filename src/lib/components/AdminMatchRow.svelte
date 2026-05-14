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

	let home = $state(match.home_score ?? 0);
	let away = $state(match.away_score ?? 0);
	let status = $state<MatchLike['status']>(match.status);
	let saveStatus = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');
	let saveError = $state<string | null>(null);
	let calcLoading = $state(false);
	let calcMessage = $state<string | null>(null);
	let formEl: HTMLFormElement | null = null;
	let saveTimer: ReturnType<typeof setTimeout> | null = null;

	function bump(side: 'home' | 'away', dir: 1 | -1) {
		if (side === 'home') home = Math.max(0, Math.min(99, home + dir));
		else                 away = Math.max(0, Math.min(99, away + dir));
		// Auto-flip to "live" the moment a goal is entered on an upcoming match.
		if (status === 'upcoming' && (home > 0 || away > 0)) status = 'live';
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
	<!-- Match header line: flags + names + date -->
	<div class="flex items-center gap-2 mb-3 text-sm flex-wrap">
		<Flag code={match.home_flag} size={24} />
		<span class="font-semibold text-fg">{teamLabel(match.home_team)}</span>
		<span class="text-faint text-xs mx-1">vs</span>
		<span class="font-semibold text-fg">{teamLabel(match.away_team)}</span>
		<Flag code={match.away_flag} size={24} />
		<span class="ml-auto text-xs text-faint">{formatDate(match.match_datetime)}</span>
	</div>

	<!-- Hidden form for auto-save -->
	<form bind:this={formEl} method="POST" action="?/update"
		use:enhance={() => {
			return async ({ result, update }) => {
				if (result.type === 'success') {
					saveStatus = 'saved';
					saveError = null;
					setTimeout(() => { if (saveStatus === 'saved') saveStatus = 'idle'; }, 1500);
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
		<input type="hidden" name="id" value={match.id} />
		<input type="hidden" name="status" value={status} />
		<input type="hidden" name="home_score" value={home} />
		<input type="hidden" name="away_score" value={away} />
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

		<!-- Home stepper -->
		<div class="flex items-center gap-1.5">
			<button type="button" onclick={() => bump('home', -1)}
				disabled={home === 0}
				aria-label="−"
				class="w-9 h-9 rounded-lg bg-canvas hover:bg-wire-hi disabled:opacity-25 text-fg text-base font-bold transition-colors cursor-pointer border border-wire active:scale-95 tabular-nums">−</button>
			<span class="text-2xl font-bold tabular-nums w-8 text-center text-fg leading-none"
				style="font-family: var(--font-display)">{home}</span>
			<button type="button" onclick={() => bump('home', 1)}
				disabled={home === 99}
				aria-label="+"
				class="w-9 h-9 rounded-lg bg-canvas hover:bg-wire-hi disabled:opacity-25 text-fg text-base font-bold transition-colors cursor-pointer border border-wire active:scale-95 tabular-nums">+</button>
		</div>

		<span class="text-xl text-wire-hi" style="font-family: var(--font-display)">–</span>

		<!-- Away stepper -->
		<div class="flex items-center gap-1.5">
			<button type="button" onclick={() => bump('away', -1)}
				disabled={away === 0}
				aria-label="−"
				class="w-9 h-9 rounded-lg bg-canvas hover:bg-wire-hi disabled:opacity-25 text-fg text-base font-bold transition-colors cursor-pointer border border-wire active:scale-95 tabular-nums">−</button>
			<span class="text-2xl font-bold tabular-nums w-8 text-center text-fg leading-none"
				style="font-family: var(--font-display)">{away}</span>
			<button type="button" onclick={() => bump('away', 1)}
				disabled={away === 99}
				aria-label="+"
				class="w-9 h-9 rounded-lg bg-canvas hover:bg-wire-hi disabled:opacity-25 text-fg text-base font-bold transition-colors cursor-pointer border border-wire active:scale-95 tabular-nums">+</button>
		</div>

		<!-- Save indicator -->
		<div class="flex items-center text-[11px] min-w-[80px]">
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
					Enregistré
				</span>
			{:else if saveStatus === 'error'}
				<span class="text-err" title={saveError ?? ''}>! {saveError}</span>
			{/if}
		</div>

		<!-- Calculate scores: shown when finished. Always uses force=1 so re-clicks
		     after a score correction (or after our scoring fixes) actually recompute
		     existing pronostics. Team-bonus double-award is guarded server-side by
		     match.bonus_calculated, so re-running is safe. -->
		{#if status === 'finished'}
			{@const pending = saveStatus === 'saving' || calcLoading}
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
								: `${scored} pronostic(s) calculé(s)`;
							setTimeout(() => calcMessage = null, 4000);
						} else if (result.type === 'failure') {
							calcMessage = `Erreur : ${(result.data as any)?.error ?? '?'}`;
						}
						await update({ reset: false });
					};
				}}>
					<input type="hidden" name="match_id" value={match.id} />
					<input type="hidden" name="force" value="1" />
					<button type="submit" disabled={pending}
						title={saveStatus === 'saving' ? 'Attends que le score soit enregistré…' : 'Recompute scores from current home/away values'}
						class="rounded-lg bg-accent-lo border border-accent/40 hover:bg-accent/20 disabled:opacity-40 px-3 py-1.5 text-xs font-semibold text-accent transition-colors cursor-pointer whitespace-nowrap">
						{calcLoading ? '…' : saveStatus === 'saving' ? 'Sauvegarde…' : 'Calculer scores'}
					</button>
				</form>

				{#if calcMessage}
					<span class="text-[11px] {calcMessage.startsWith('Erreur') ? 'text-err' : 'text-accent'}">{calcMessage}</span>
				{/if}
			</div>
		{/if}
	</div>
</div>
