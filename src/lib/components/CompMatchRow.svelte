<script lang="ts">
	// V2 pick row for club competitions (PL/UCL): crest badges, the proven
	// debounced-autosave stepper from MatchPickRow, and the V2 twist — the
	// exact-score multiplier (Poisson/Dixon-Coles from the match odds) computed
	// client-side and shown LIVE while you dial your score. Indicative before
	// the lock; the server freezes the matrix at lock and scoring uses that.
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { getLang } from '$lib/i18n.svelte';
	import { formatTime, MATCH_LOCK_MS } from '$lib/utils';
	import { scorelineModel, type ScorelineModel } from '$lib/scorelines';
	import { punch, pop } from '$lib/motion';

	type Team = { short: string | null; logo: string | null };
	type MatchLike = {
		id: string;
		home_team: string;
		away_team: string;
		match_datetime: string;
		status: string;
		home_score?: number | null;
		away_score?: number | null;
		odds_home?: number | null;
		odds_draw?: number | null;
		odds_away?: number | null;
	};

	let {
		match,
		home,
		away,
		existingProno = null,
		loggedIn = false,
		action = '?/pronostic'
	}: {
		match: MatchLike;
		home: Team;
		away: Team;
		existingProno?: { predicted_home: number; predicted_away: number } | null;
		loggedIn?: boolean;
		action?: string;
	} = $props();

	let h = $state(existingProno?.predicted_home ?? 0);
	let a = $state(existingProno?.predicted_away ?? 0);
	let touched = $state(!!existingProno);
	let saveStatus = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');
	let saveError = $state<string | null>(null);
	let hasProno = $state(!!existingProno);
	let formEl: HTMLFormElement | null = null;
	let saveTimer: ReturnType<typeof setTimeout> | null = null;

	// Lock ticking (5 min before kickoff), same cadence as MatchPickRow.
	let nowMs = $state(Date.now());
	$effect(() => {
		const id = setInterval(() => (nowMs = Date.now()), 5000);
		return () => clearInterval(id);
	});
	const locked = $derived(new Date(match.match_datetime).getTime() - nowMs < MATCH_LOCK_MS);
	const pickable = $derived(loggedIn && match.status === 'upcoming' && !locked);
	const fr = $derived(getLang() === 'fr');

	// Exact-score multiplier — lazily fit the scoreline model on first touch
	// (a few ms of pure math; never run for the 300+ untouched rows on a page).
	let model = $state<ScorelineModel | null>(null);
	const hasOdds = $derived(match.odds_home != null && match.odds_draw != null && match.odds_away != null);
	$effect(() => {
		if (touched && hasOdds && !model) {
			model = scorelineModel(Number(match.odds_home), Number(match.odds_draw), Number(match.odds_away));
		}
	});
	const exactMult = $derived(model && touched ? model.exactMultiplier(h, a) : null);

	function bump(side: 'home' | 'away', dir: 1 | -1) {
		if (!pickable) return;
		touched = true;
		if (side === 'home') h = Math.max(0, Math.min(20, h + dir));
		else a = Math.max(0, Math.min(20, a + dir));
		if (saveTimer) clearTimeout(saveTimer);
		saveStatus = 'saving';
		saveTimer = setTimeout(() => formEl?.requestSubmit(), 700);
	}

	const scoreColour = $derived(touched ? 'text-accent' : 'text-faint');
</script>

{#snippet stepper(side: 'home' | 'away')}
	{@const value = side === 'home' ? h : a}
	<div class="flex items-center gap-1.5">
		<button type="button" onclick={(e) => { e.stopPropagation(); bump(side, -1); }} disabled={value === 0} aria-label="−"
			class="w-9 h-9 rounded-lg bg-canvas hover:bg-wire-hi disabled:opacity-25 text-fg text-base font-bold transition-colors cursor-pointer border border-wire tabular-nums">−</button>
		{#key touched ? value : -1}
			<span in:punch class="text-3xl font-bold tabular-nums leading-none w-8 text-center block {scoreColour}"
				style="font-family: var(--font-display)">{touched ? value : '–'}</span>
		{/key}
		<button type="button" onclick={(e) => { e.stopPropagation(); bump(side, 1); }} disabled={value === 20} aria-label="+"
			class="w-9 h-9 rounded-lg bg-canvas hover:bg-wire-hi disabled:opacity-25 text-fg text-base font-bold transition-colors cursor-pointer border border-wire tabular-nums">+</button>
	</div>
{/snippet}

{#snippet teamSide(team: string, info: Team, align: 'end' | 'start')}
	<div class="flex-1 min-w-0 flex items-center gap-2 {align === 'end' ? 'justify-end' : ''}">
		{#if align === 'start' && info.logo}<img src={info.logo} alt="" class="w-6 h-6 object-contain shrink-0" loading="lazy" />{/if}
		<span class="truncate text-sm font-medium text-fg {align === 'end' ? 'text-right' : ''}">{info.short ?? team}</span>
		{#if align === 'end' && info.logo}<img src={info.logo} alt="" class="w-6 h-6 object-contain shrink-0" loading="lazy" />{/if}
	</div>
{/snippet}

<div class="px-4 py-3 {pickable ? 'hover:bg-raised/30' : 'hover:bg-raised/50'} transition-colors">
	{#if pickable}
		<form bind:this={formEl} method="POST" {action}
			use:enhance={({ formData }) => {
				formData.set('match_id', match.id);
				formData.set('predicted_home', String(h));
				formData.set('predicted_away', String(a));
				return async ({ result }) => {
					if (result.type === 'success') {
						saveStatus = 'saved';
						hasProno = true;
						saveError = null;
						setTimeout(() => { if (saveStatus === 'saved') saveStatus = 'idle'; }, 1800);
						invalidateAll();
					} else if (result.type === 'failure') {
						saveStatus = 'error';
						saveError = (result.data as any)?.error ?? null;
					} else if (result.type === 'error') {
						saveStatus = 'error';
						saveError = result.error?.message ?? null;
					}
				};
			}}>
			<input type="hidden" name="match_id" value={match.id} />
			<input type="hidden" name="predicted_home" value={h} />
			<input type="hidden" name="predicted_away" value={a} />

			<div class="flex items-center gap-3">
				{@render teamSide(match.home_team, home, 'end')}
				<div class="shrink-0 flex items-center gap-2">
					{@render stepper('home')}
					<span class="text-xl text-wire-hi" style="font-family: var(--font-display)">–</span>
					{@render stepper('away')}
				</div>
				{@render teamSide(match.away_team, away, 'start')}
			</div>

			<!-- V2: live exact-score multiplier + save state -->
			<div class="mt-1.5 flex items-center justify-center gap-3 h-4 text-[11px] tabular-nums">
				<span class="text-faint">{formatTime(match.match_datetime, getLang())}</span>
				{#if exactMult != null}
					<span class="text-accent font-semibold">
						{fr ? 'score exact' : 'exact score'} ×{exactMult}
					</span>
				{/if}
				{#if saveStatus === 'saving'}
					<span class="text-faint flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-accent animate-pulse"></span>{fr ? 'sauvegarde…' : 'saving…'}</span>
				{:else if saveStatus === 'saved' || (saveStatus === 'idle' && hasProno)}
					<span in:pop={{ duration: 320 }} class="flex items-center gap-1 font-medium" style="color: var(--color-success)">
						<svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
						{fr ? 'enregistré' : 'saved'}
					</span>
				{:else if saveStatus === 'error'}
					<span class="text-err">{saveError ?? '!'}</span>
				{/if}
			</div>
		</form>
	{:else}
		<div class="flex items-center gap-3">
			{@render teamSide(match.home_team, home, 'end')}
			<div class="shrink-0 text-center w-16">
				{#if match.status === 'finished' || match.status === 'live'}
					<span class="font-bold tabular-nums {match.status === 'live' ? 'text-live' : 'text-fg'}" style="font-family: var(--font-display)">
						{match.home_score ?? 0}–{match.away_score ?? 0}
					</span>
				{:else}
					<span class="text-xs text-faint tabular-nums">{formatTime(match.match_datetime, getLang())}</span>
				{/if}
			</div>
			{@render teamSide(match.away_team, away, 'start')}
		</div>
		{#if existingProno}
			<p class="mt-1 text-center text-[11px] text-faint tabular-nums">
				{fr ? 'Ton prono' : 'Your pick'} <span class="text-muted font-semibold">{existingProno.predicted_home}–{existingProno.predicted_away}</span>
			</p>
		{/if}
	{/if}
</div>
