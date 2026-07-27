<script lang="ts">
	// V2 match detail — the scoreline GRID is the picker: every cell shows the
	// exact-score multiplier (frozen at lock, else computed live from the odds)
	// and tapping a cell IS your prediction. Steppers handle scores beyond the
	// grid. Locked/live/finished states show the community picks and points.
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { getLang, t } from '$lib/i18n.svelte';
	import { formatDate, formatTime, MATCH_LOCK_MS, liveClock } from '$lib/utils';
	import { scorelineModel } from '$lib/scorelines';
	import { reveal, pop, punch } from '$lib/motion';
	import CountUp from '$lib/components/CountUp.svelte';

	let { data } = $props();

	const fr = $derived(getLang() === 'fr');
	const m = $derived(data.match as any);
	const info = (team: string) => (data.teamMap as any)[team] ?? { short: team, logo: null };

	// ── Pick state (stepper + grid share it; debounced autosave) ─────────────
	let h = $state((data.userProno?.predicted_home as number | undefined) ?? 0);
	let a = $state((data.userProno?.predicted_away as number | undefined) ?? 0);
	let touched = $state(!!data.userProno);
	let saveStatus = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');
	let saveError = $state<string | null>(null);
	let hasProno = $state(!!data.userProno);
	let formEl: HTMLFormElement | null = null;
	let saveTimer: ReturnType<typeof setTimeout> | null = null;

	let nowMs = $state(Date.now());
	$effect(() => {
		const id = setInterval(() => (nowMs = Date.now()), 5000);
		return () => clearInterval(id);
	});
	const locked = $derived(
		data.locked || new Date(m.match_datetime).getTime() - nowMs < MATCH_LOCK_MS
	);
	const pickable = $derived(!!data.user && m.status === 'upcoming' && !locked);

	// ── Multipliers: frozen matrix once the server wrote it, else live model ──
	const hasOdds = $derived(m.odds_home != null && m.odds_draw != null && m.odds_away != null);
	const frozen = $derived((m.scoreline_multipliers ?? null) as Record<string, number> | null);
	const model = $derived.by(() => {
		if (frozen || !hasOdds) return null;
		return scorelineModel(Number(m.odds_home), Number(m.odds_draw), Number(m.odds_away));
	});
	const multOf = (hh: number, aa: number): number | null => {
		if (frozen) return frozen[`${hh}-${aa}`] ?? null;
		if (model) return model.exactMultiplier(hh, aa);
		return null;
	};
	const GRID = [0, 1, 2, 3, 4, 5];
	const currentMult = $derived(touched ? multOf(h, a) : null);

	function scheduleSave() {
		if (saveTimer) clearTimeout(saveTimer);
		saveStatus = 'saving';
		saveTimer = setTimeout(() => formEl?.requestSubmit(), 700);
	}
	function setScore(hh: number, aa: number) {
		if (!pickable) return;
		touched = true;
		h = hh;
		a = aa;
		scheduleSave();
	}
	function bump(side: 'home' | 'away', dir: 1 | -1) {
		if (!pickable) return;
		touched = true;
		if (side === 'home') h = Math.max(0, Math.min(20, h + dir));
		else a = Math.max(0, Math.min(20, a + dir));
		scheduleSave();
	}

	const clock = $derived(
		m.status === 'live' ? liveClock(m.live_elapsed, m.live_period, getLang() as 'fr' | 'en', m.last_score_sync_at, m.match_datetime) : null
	);
</script>

<div class="max-w-xl mx-auto space-y-8">
	<!-- ── Header: crests · state ─────────────────────────────────────────── -->
	<header class="text-center" in:reveal={{ y: 10 }}>
		<p class="text-[10.5px] uppercase tracking-[0.14em] text-faint" style="font-family: var(--font-mono)">
			{formatDate(m.match_datetime, getLang())}{m.venue ? ` · ${m.venue}` : ''}
		</p>
		<div class="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
			<div class="flex flex-col items-center gap-2 min-w-0">
				{#if info(m.home_team).logo}<img src={info(m.home_team).logo} alt="" class="w-14 h-14 object-contain" />{/if}
				<span class="text-sm font-semibold truncate max-w-full" style="font-family: var(--font-display)">{m.home_team}</span>
			</div>
			<div class="text-center px-2">
				{#if m.status === 'finished' || m.status === 'live'}
					<p class="text-5xl font-bold tabular-nums leading-none {m.status === 'live' ? 'text-live' : 'text-accent'}"
						style="font-family: var(--font-display)">
						{m.home_score ?? 0}<span class="text-2xl text-muted mx-1.5">–</span>{m.away_score ?? 0}
					</p>
					{#if m.status === 'live'}
						<span class="inline-flex items-center gap-1.5 mt-2 rounded bg-live px-2 py-0.5 text-[10px] font-bold text-fg tracking-widest">
							<span class="w-1 h-1 rounded-full bg-fg/80 animate-pulse"></span>LIVE{#if clock}<span class="tabular-nums normal-case">· {clock}</span>{/if}
						</span>
					{/if}
				{:else}
					<p class="text-3xl text-faint tabular-nums" style="font-family: var(--font-display)">
						{formatTime(m.match_datetime, getLang())}
					</p>
				{/if}
			</div>
			<div class="flex flex-col items-center gap-2 min-w-0">
				{#if info(m.away_team).logo}<img src={info(m.away_team).logo} alt="" class="w-14 h-14 object-contain" />{/if}
				<span class="text-sm font-semibold truncate max-w-full" style="font-family: var(--font-display)">{m.away_team}</span>
			</div>
		</div>
		{#if hasOdds}
			<p class="mt-4 text-[11px] text-faint tabular-nums" style="font-family: var(--font-mono)">
				1 <span class="text-muted">{Number(m.odds_home).toFixed(2)}</span>
				· N <span class="text-muted">{Number(m.odds_draw).toFixed(2)}</span>
				· 2 <span class="text-muted">{Number(m.odds_away).toFixed(2)}</span>
			</p>
		{/if}
	</header>

	{#if pickable}
		<!-- ── Your pick: stepper + the scoreline grid ─────────────────────── -->
		<form bind:this={formEl} method="POST" action="?/pronostic"
			use:enhance={({ formData }) => {
				formData.set('predicted_home', String(h));
				formData.set('predicted_away', String(a));
				return async ({ result }) => {
					if (result.type === 'success') {
						saveStatus = 'saved'; hasProno = true; saveError = null;
						setTimeout(() => { if (saveStatus === 'saved') saveStatus = 'idle'; }, 1800);
						invalidateAll();
					} else if (result.type === 'failure') {
						saveStatus = 'error'; saveError = (result.data as any)?.error ?? null;
					} else if (result.type === 'error') {
						saveStatus = 'error'; saveError = result.error?.message ?? null;
					}
				};
			}}
			class="space-y-5" in:reveal={{ delay: 90, y: 10 }}>
			<input type="hidden" name="predicted_home" value={h} />
			<input type="hidden" name="predicted_away" value={a} />

			<div class="rounded-2xl border border-wire bg-panel px-5 py-6">
				<p class="text-[11px] uppercase tracking-[0.1em] text-faint text-center mb-4" style="font-family: var(--font-mono)">
					{fr ? 'Ton prono' : 'Your pick'}
				</p>

				<!-- Stepper -->
				<div class="flex items-center justify-center gap-4">
					{#each (['home', 'away'] as const) as side, si}
						{#if si === 1}<span class="text-2xl text-wire-hi" style="font-family: var(--font-display)">–</span>{/if}
						{@const value = side === 'home' ? h : a}
						<div class="flex items-center gap-2">
							<button type="button" onclick={() => bump(side, -1)} disabled={value === 0} aria-label="−"
								class="w-10 h-10 rounded-lg bg-canvas hover:bg-wire-hi disabled:opacity-25 text-fg text-base font-bold transition-colors cursor-pointer border border-wire">−</button>
							{#key touched ? value : -1}
								<span in:punch class="text-4xl font-bold tabular-nums leading-none w-9 text-center block {touched ? 'text-accent' : 'text-faint'}"
									style="font-family: var(--font-display)">{touched ? value : '–'}</span>
							{/key}
							<button type="button" onclick={() => bump(side, 1)} disabled={value === 20} aria-label="+"
								class="w-10 h-10 rounded-lg bg-canvas hover:bg-wire-hi disabled:opacity-25 text-fg text-base font-bold transition-colors cursor-pointer border border-wire">+</button>
						</div>
					{/each}
				</div>

				<!-- Save state + current multiplier -->
				<div class="mt-3 flex items-center justify-center gap-3 h-4 text-[11px] tabular-nums">
					{#if currentMult != null}
						<span class="text-accent font-semibold">{fr ? 'score exact' : 'exact score'} ×{currentMult}</span>
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
			</div>

			<!-- Scoreline grid — tap a cell to pick that exact score -->
			{#if hasOdds}
				<div in:reveal={{ delay: 160, y: 10 }}>
					<div class="flex items-baseline justify-between mb-2 px-1">
						<p class="text-[11px] uppercase tracking-[0.1em] text-faint" style="font-family: var(--font-mono)">
							{fr ? 'La grille des scores' : 'The scoreline grid'}
						</p>
						<p class="text-[10px] text-faint">
							{fr ? 'multiplicateur si score exact' : 'multiplier if exact'}
						</p>
					</div>
					<div class="rounded-xl border border-wire overflow-hidden">
						<div class="grid" style="grid-template-columns: auto repeat({GRID.length}, 1fr)">
							<!-- corner + away header -->
							<div class="bg-raised px-2 py-1.5 text-[9px] text-faint flex items-end justify-center" style="font-family: var(--font-mono)">
								{info(m.home_team).short} ↓ · {info(m.away_team).short} →
							</div>
							{#each GRID as aa}
								<div class="bg-raised py-1.5 text-center text-[11px] font-bold text-muted tabular-nums">{aa}</div>
							{/each}
							{#each GRID as hh}
								<div class="bg-raised px-3 py-1.5 text-center text-[11px] font-bold text-muted tabular-nums flex items-center justify-center">{hh}</div>
								{#each GRID as aa}
									{@const mult = multOf(hh, aa)}
									{@const selected = touched && h === hh && a === aa}
									<button type="button" onclick={() => setScore(hh, aa)}
										class="py-2 text-center text-[11px] tabular-nums border-t border-l border-wire/40 transition-colors cursor-pointer
											{selected ? 'bg-accent text-canvas font-bold' : mult != null && mult >= 5 ? 'text-accent hover:bg-raised' : mult != null && mult >= 3.5 ? 'text-fg hover:bg-raised' : 'text-faint hover:bg-raised'}">
										{mult != null ? `×${mult}` : '–'}
									</button>
								{/each}
							{/each}
						</div>
					</div>
					<p class="mt-2 text-[10px] text-faint px-1">
						{fr ? 'Touche une case = ton prono. Gain si score exact : 1 × cote du résultat + le multiplicateur.' : 'Tap a cell = your pick. Exact score pays 1 × outcome odds + the multiplier.'}
					</p>
				</div>
			{/if}
		</form>
	{:else if data.userProno}
		<!-- Locked / live / finished: your pick, and your points once scored -->
		<section class="rounded-2xl border border-wire bg-panel px-5 py-5 text-center" in:reveal={{ delay: 90, y: 10 }}>
			<p class="text-[11px] uppercase tracking-[0.1em] text-faint mb-2" style="font-family: var(--font-mono)">
				{fr ? 'Ton prono' : 'Your pick'}
			</p>
			<p class="text-3xl font-bold tabular-nums text-fg" style="font-family: var(--font-display)">
				{data.userProno.predicted_home}–{data.userProno.predicted_away}
			</p>
			{#if data.userProno.is_scored}
				<p class="mt-2 text-sm tabular-nums">
					<span class="font-bold {Number(data.userProno.points_earned) > 0 ? 'text-accent' : 'text-faint'}">
						{Number(data.userProno.points_earned ?? 0) > 0 ? '+' : ''}<CountUp value={Number(data.userProno.points_earned ?? 0)} /> {t('match_pts')}
					</span>
					{#if data.userProno.exact_multiplier != null}
						<span class="text-faint text-[11px]"> · {fr ? 'score exact' : 'exact'} ×{data.userProno.exact_multiplier}</span>
					{/if}
				</p>
			{/if}
		</section>
	{/if}

	<!-- ── Community picks (public from the lock) ──────────────────────────── -->
	{#if data.allPronostics?.length}
		<section in:reveal={{ delay: 170, y: 10 }}>
			<p class="text-[11px] uppercase tracking-[0.1em] text-faint mb-2 px-1" style="font-family: var(--font-mono)">
				{fr ? 'Les pronos' : 'The picks'} · {data.allPronostics.length}
			</p>
			<div class="-mx-4 sm:mx-0 divide-y divide-wire/60 border-y border-wire sm:border sm:rounded-xl sm:bg-panel/40 overflow-hidden">
				{#each data.allPronostics as p (p.user_id)}
					{@const me = p.user_id === data.user?.id}
					<a href="/profile/{p.user_id}" class="flex items-center gap-3 px-4 py-2.5 transition-colors {me ? 'bg-accent-lo/60' : 'hover:bg-raised/40'}">
						{#if p.profiles?.avatar_url}
							<img src={p.profiles.avatar_url} alt="" class="w-6 h-6 rounded-full object-cover shrink-0" />
						{:else}
							<span class="w-6 h-6 rounded-full bg-raised border border-wire flex items-center justify-center text-[10px] font-bold text-muted shrink-0">
								{(p.profiles?.display_name ?? p.profiles?.username ?? '?')[0]?.toUpperCase()}
							</span>
						{/if}
						<span class="flex-1 min-w-0 truncate text-sm {me ? 'text-accent font-semibold' : 'text-fg'}">
							{p.profiles?.display_name ?? p.profiles?.username ?? '?'}
						</span>
						<span class="text-sm font-semibold tabular-nums text-muted">{p.predicted_home}–{p.predicted_away}</span>
						{#if p.is_scored}
							<span class="w-14 text-right text-sm font-bold tabular-nums {Number(p.points_earned) > 0 ? 'text-accent' : 'text-faint'}"
								style="font-family: var(--font-display)">{Number(p.points_earned ?? 0).toFixed(2)}</span>
						{/if}
					</a>
				{/each}
			</div>
		</section>
	{/if}

	<a href="/{data.competition.slug}/matches" class="block text-center text-sm text-muted hover:text-fg transition-colors">
		← {t('nav_matches')}
	</a>
</div>
