<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { formatDate, timeUntilMatch, MATCH_LOCK_MS } from '$lib/utils';
	import { t } from '$lib/i18n.svelte';
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
		home_score?: number | null;
		away_score?: number | null;
		group_label?: string | null;
		odds_home?: number | null;
		odds_draw?: number | null;
		odds_away?: number | null;
	};

	type PronoLike = {
		predicted_home: number;
		predicted_away: number;
		is_scored?: boolean;
		points_earned?: number | null;
	};

	let {
		match,
		existingProno = null,
		loggedIn = false,
		action = '?/pronostic'
	}: {
		match: MatchLike;
		existingProno?: PronoLike | null;
		loggedIn?: boolean;
		action?: string;
	} = $props();

	let home = $state(existingProno?.predicted_home ?? 0);
	let away = $state(existingProno?.predicted_away ?? 0);
	let hasProno = $state(!!existingProno);
	let saveStatus = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');
	let saveError = $state<string | null>(null);
	let formEl: HTMLFormElement | null = null;
	let saveTimer: ReturnType<typeof setTimeout> | null = null;

	function urgency(): 'none' | 'locked' | 'critical' | 'warning' | 'normal' {
		if (match.status !== 'upcoming') return 'none';
		const ms = new Date(match.match_datetime).getTime() - Date.now();
		if (ms <= 0) return 'none';
		if (ms < MATCH_LOCK_MS)   return 'locked';
		if (ms < 6 * 3600000)     return 'critical';
		if (ms < 24 * 3600000)    return 'warning';
		return 'normal';
	}

	const u = $derived(urgency());
	const pickable = $derived(loggedIn && match.status === 'upcoming' && u !== 'locked');
	const outcome = $derived(Math.sign(home - away));

	function bump(side: 'home' | 'away', dir: 1 | -1) {
		if (!pickable) return;
		if (side === 'home') home = Math.max(0, Math.min(20, home + dir));
		else                 away = Math.max(0, Math.min(20, away + dir));
		scheduleSave();
	}

	function scheduleSave() {
		if (!hasProno && home === 0 && away === 0) {
			saveStatus = 'idle';
			if (saveTimer) clearTimeout(saveTimer);
			return;
		}
		if (saveTimer) clearTimeout(saveTimer);
		saveStatus = 'saving';
		saveTimer = setTimeout(() => formEl?.requestSubmit(), 700);
	}

	function retrySave() {
		saveStatus = 'idle';
		saveError = null;
		scheduleSave();
	}

	function finishedVerdict(): 'exact' | 'correct' | 'wrong' | null {
		if (match.status !== 'finished' || !existingProno?.is_scored) return null;
		if (existingProno.predicted_home === match.home_score && existingProno.predicted_away === match.away_score) return 'exact';
		const ph = existingProno.predicted_home, pa = existingProno.predicted_away;
		const mh = match.home_score ?? 0, ma = match.away_score ?? 0;
		return Math.sign(ph - pa) === Math.sign(mh - ma) ? 'correct' : 'wrong';
	}
	const verdict = $derived(finishedVerdict());

	const flagSize = 56;
</script>

{#snippet teamPairGridMobile()}
	<div class="grid grid-cols-2 gap-3">
		<a href="/matches/{match.id}" class="flex flex-col items-center gap-1.5 min-w-0 group/team">
			<Flag code={match.home_flag} size={flagSize} />
			<span class="text-sm font-semibold text-fg group-hover/team:text-accent transition-colors truncate max-w-full text-center">
				{teamLabel(match.home_team)}
			</span>
		</a>
		<a href="/matches/{match.id}" class="flex flex-col items-center gap-1.5 min-w-0 group/team">
			<Flag code={match.away_flag} size={flagSize} />
			<span class="text-sm font-semibold text-fg group-hover/team:text-accent transition-colors truncate max-w-full text-center">
				{teamLabel(match.away_team)}
			</span>
		</a>
	</div>
{/snippet}

{#snippet metaLine()}
	<a href="/matches/{match.id}" class="flex flex-col items-center text-[10px] leading-tight hover:opacity-80 transition-opacity">
		<span class="text-faint truncate">{formatDate(match.match_datetime)}</span>
		<span class="flex items-center gap-1.5 mt-0.5">
			<span class="tabular-nums font-semibold
				{u === 'critical' ? 'text-live' :
				 u === 'warning'  ? 'text-warn'  :
				                    'text-accent'}">
				{timeUntilMatch(match.match_datetime)}
			</span>
			{#if match.group_label}
				<span class="text-wire-hi">·</span>
				<span class="text-faint">{t('group_short')} {match.group_label}</span>
			{/if}
			{#if u === 'critical' && !hasProno}
				<span class="w-1.5 h-1.5 rounded-full bg-live animate-pulse ml-0.5" title="Lock soon"></span>
			{/if}
		</span>
	</a>
{/snippet}

{#snippet oddsLine()}
	{#if match.odds_home && match.odds_draw && match.odds_away}
		<div class="flex items-center justify-center gap-1.5 text-[11px] tabular-nums mt-1.5">
			<span class="inline-flex items-baseline gap-1 {outcome > 0 ? 'text-accent font-bold' : 'text-faint'}" title={teamLabel(match.home_team)}>
				<span class="text-faint font-normal text-[9px] uppercase tracking-wider">1</span>
				{match.odds_home.toFixed(2)}
			</span>
			<span class="text-wire-hi">·</span>
			<span class="inline-flex items-baseline gap-1 {outcome === 0 ? 'text-accent font-bold' : 'text-faint'}" title={t('match_draw')}>
				<span class="text-faint font-normal text-[9px] uppercase tracking-wider">N</span>
				{match.odds_draw.toFixed(2)}
			</span>
			<span class="text-wire-hi">·</span>
			<span class="inline-flex items-baseline gap-1 {outcome < 0 ? 'text-accent font-bold' : 'text-faint'}" title={teamLabel(match.away_team)}>
				<span class="text-faint font-normal text-[9px] uppercase tracking-wider">2</span>
				{match.odds_away.toFixed(2)}
			</span>
		</div>
	{/if}
{/snippet}

{#snippet stepperButton(side: 'home' | 'away', dir: 1 | -1)}
	{@const value = side === 'home' ? home : away}
	{@const label = dir === 1 ? '+' : '−'}
	{@const disabled = dir === 1 ? value === 20 : value === 0}
	<button type="button" onclick={(e) => { e.stopPropagation(); bump(side, dir); }}
		{disabled}
		aria-label={label}
		class="w-10 h-10 sm:w-9 sm:h-9 rounded-lg bg-canvas hover:bg-wire-hi disabled:opacity-25 text-fg text-base font-bold transition-colors cursor-pointer border border-wire active:scale-95 tabular-nums">{label}</button>
{/snippet}

{#snippet pickableCentre()}
	{@const scoreColour = hasProno || home > 0 || away > 0 ? 'text-accent' : 'text-faint'}
	<div class="text-center">
		{@render metaLine()}
		<div class="flex items-center justify-center gap-3 sm:gap-4 mt-2">
			<!-- Home triple: [-] HOME_DIGIT [+] -->
			<div class="flex items-center gap-1.5 sm:gap-2">
				{@render stepperButton('home', -1)}
				<a href="/matches/{match.id}" class="hover:opacity-80 transition-opacity">
					<span class="text-3xl sm:text-4xl font-bold tabular-nums leading-none w-7 sm:w-9 text-center block {scoreColour}"
						style="font-family: var(--font-display)">
						{home}
					</span>
				</a>
				{@render stepperButton('home', 1)}
			</div>

			<span class="text-2xl sm:text-3xl text-wire-hi" style="font-family: var(--font-display)">–</span>

			<!-- Away triple: [-] AWAY_DIGIT [+] -->
			<div class="flex items-center gap-1.5 sm:gap-2">
				{@render stepperButton('away', -1)}
				<a href="/matches/{match.id}" class="hover:opacity-80 transition-opacity">
					<span class="text-3xl sm:text-4xl font-bold tabular-nums leading-none w-7 sm:w-9 text-center block {scoreColour}"
						style="font-family: var(--font-display)">
						{away}
					</span>
				</a>
				{@render stepperButton('away', 1)}
			</div>
		</div>
		{@render oddsLine()}
	</div>
{/snippet}

<div class="px-4 py-3 transition-colors {pickable ? 'hover:bg-raised/30' : 'hover:bg-raised/60'}">

	{#if pickable}
		<form bind:this={formEl} method="POST" {action}
			use:enhance={({ formData }) => {
				formData.set('match_id', match.id);
				formData.set('predicted_home', String(home));
				formData.set('predicted_away', String(away));
				return async ({ result }) => {
					if (result.type === 'success') {
						saveStatus = 'saved';
						hasProno = true;
						saveError = null;
						setTimeout(() => { if (saveStatus === 'saved') saveStatus = 'idle'; }, 1800);
						// Bust prefetch cache so detail-page load sees fresh pronostic on navigation.
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
			<input type="hidden" name="predicted_home" value={home} />
			<input type="hidden" name="predicted_away" value={away} />

			<!-- ── Mobile layout: flag+name pair stacked above centre block ─────── -->
			<div class="sm:hidden space-y-3">
				{@render teamPairGridMobile()}
				{@render pickableCentre()}
			</div>

			<!-- ── Desktop layout: flag+name on each side, centre block in middle ── -->
			<div class="hidden sm:flex items-center gap-4">
				<a href="/matches/{match.id}" class="flex items-center gap-2.5 min-w-0 flex-1 group/team">
					<Flag code={match.home_flag} size={flagSize} />
					<span class="text-base font-semibold text-fg group-hover/team:text-accent group-hover/team:underline underline-offset-4 transition-colors truncate">
						{teamLabel(match.home_team)}
					</span>
				</a>

				<div class="shrink-0">
					{@render pickableCentre()}
				</div>

				<a href="/matches/{match.id}" class="flex items-center gap-2.5 min-w-0 flex-1 justify-end group/team">
					<span class="text-base font-semibold text-fg group-hover/team:text-accent group-hover/team:underline underline-offset-4 transition-colors truncate text-right">
						{teamLabel(match.away_team)}
					</span>
					<Flag code={match.away_flag} size={flagSize} />
				</a>

				<a href="/matches/{match.id}" aria-label={t('match_view_details')} title={t('match_view_details')}
					class="shrink-0 w-7 h-7 -mr-1 flex items-center justify-center text-faint hover:text-accent hover:bg-raised rounded-md transition-colors">
					<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" aria-hidden="true">
						<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
					</svg>
				</a>
			</div>

			<!-- Save status line (shared) -->
			<div class="mt-1.5 flex items-center justify-center gap-2 h-4 text-[11px]">
				{#if saveStatus === 'saving'}
					<span class="text-faint flex items-center gap-1.5">
						<span class="w-1.5 h-1.5 rounded-full bg-accent animate-pulse"></span>
						{t('saving')}
					</span>
				{:else if saveStatus === 'saved'}
					<span class="text-accent flex items-center gap-1">
						<svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
						</svg>
						{t('match_saved')}
					</span>
				{:else if saveStatus === 'error'}
					<span class="text-err flex items-center gap-2">
						<span>{saveError ?? '!'}</span>
						<button type="button" onclick={(e) => { e.stopPropagation(); retrySave(); }}
							class="underline hover:text-err/80 cursor-pointer">{t('retry')}</button>
					</span>
				{/if}
			</div>
		</form>

	{:else}
		<!-- ── Mobile non-pickable: flag+name pair + center info below ───────── -->
		<div class="sm:hidden space-y-3">
			{@render teamPairGridMobile()}

			<div class="flex justify-center">
				{#if match.status === 'finished' && match.home_score != null}
					<a href="/matches/{match.id}" class="text-center block">
						<span class="font-bold text-fg tabular-nums hover:text-accent transition-colors text-2xl block"
							style="font-family: var(--font-display)">
							{match.home_score} – {match.away_score}
						</span>
						{#if existingProno}
							<span class="block tabular-nums text-xs mt-1
								{verdict === 'exact' ? 'text-accent font-bold' :
								 verdict === 'correct' ? 'text-fg/70' : 'text-faint'}">
								{existingProno.predicted_home}–{existingProno.predicted_away}
								{#if existingProno.is_scored}
									· {existingProno.points_earned != null
										? (existingProno.points_earned > 0 ? '+' : '') + Number(existingProno.points_earned).toFixed(2)
										: '–'}
								{/if}
							</span>
						{/if}
					</a>
				{:else if match.status === 'live'}
					<a href="/matches/{match.id}" class="text-center block">
						<span class="font-bold text-live tabular-nums leading-none block text-2xl"
							style="font-family: var(--font-display)">
							{match.home_score ?? 0} – {match.away_score ?? 0}
						</span>
						<span class="inline-flex items-center gap-1 rounded bg-live px-1.5 py-0.5 text-[10px] font-bold text-fg mt-1.5">
							<span class="w-1 h-1 rounded-full bg-fg/80 animate-pulse"></span>
							{t('match_live')}
						</span>
					</a>
				{:else}
					<a href="/matches/{match.id}" class="text-center block">
						{#if hasProno}
							<span class="font-bold tabular-nums text-fg/80 block text-2xl"
								style="font-family: var(--font-display)">{home} – {away}</span>
						{:else}
							<span class="text-sm text-faint italic">— · —</span>
						{/if}
						<div class="flex items-center justify-center gap-1.5 text-[10px] mt-1.5 leading-tight">
							<span class="text-faint truncate">{formatDate(match.match_datetime)}</span>
							{#if u === 'locked'}
								<span class="text-wire-hi">·</span>
								<span class="inline-flex items-center gap-0.5 text-faint">
									<svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5"
											d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
									</svg>
									{t('locked_short')}
								</span>
							{/if}
							{#if match.group_label}
								<span class="text-wire-hi">·</span>
								<span class="text-faint">{t('group_short')} {match.group_label}</span>
							{/if}
						</div>
					</a>
				{/if}
			</div>
		</div>

		<!-- ── Desktop non-pickable: single horizontal row ───────────────────── -->
		<div class="hidden sm:flex items-center gap-3">
			<a href="/matches/{match.id}" aria-label={teamLabel(match.home_team)} class="shrink-0">
				<Flag code={match.home_flag} size={flagSize} />
			</a>

			<a href="/matches/{match.id}" class="flex-1 min-w-0 group/team">
				<span class="text-base font-semibold text-fg group-hover/team:text-accent group-hover/team:underline underline-offset-4 transition-colors truncate block">
					{teamLabel(match.home_team)}
				</span>
			</a>

			<div class="text-center shrink-0 min-w-[120px]">
				{#if match.status === 'finished' && match.home_score != null}
					<a href="/matches/{match.id}"
						class="font-bold text-fg tabular-nums hover:text-accent transition-colors text-2xl block"
						style="font-family: var(--font-display)">
						{match.home_score} – {match.away_score}
					</a>
					{#if existingProno}
						<span class="block tabular-nums text-xs mt-1
							{verdict === 'exact' ? 'text-accent font-bold' :
							 verdict === 'correct' ? 'text-fg/70' : 'text-faint'}">
							{existingProno.predicted_home}–{existingProno.predicted_away}
							{#if existingProno.is_scored}
								· {existingProno.points_earned != null
									? (existingProno.points_earned > 0 ? '+' : '') + Number(existingProno.points_earned).toFixed(2)
									: '–'}
							{/if}
						</span>
					{/if}
				{:else if match.status === 'live'}
					<a href="/matches/{match.id}" class="block">
						<span class="font-bold text-live tabular-nums leading-none block text-2xl"
							style="font-family: var(--font-display)">
							{match.home_score ?? 0} – {match.away_score ?? 0}
						</span>
						<span class="inline-flex items-center gap-1 rounded bg-live px-1.5 py-0.5 text-[10px] font-bold text-fg mt-1.5">
							<span class="w-1 h-1 rounded-full bg-fg/80 animate-pulse"></span>
							{t('match_live')}
						</span>
					</a>
				{:else}
					{#if hasProno}
						<a href="/matches/{match.id}" class="block">
							<span class="font-bold tabular-nums text-fg/80 block text-2xl"
								style="font-family: var(--font-display)">{home} – {away}</span>
						</a>
					{:else}
						<a href="/matches/{match.id}" class="block">
							<span class="text-sm text-faint italic">— · —</span>
						</a>
					{/if}
					<div class="flex items-center justify-center gap-1.5 text-[10px] mt-1.5 leading-tight">
						<span class="text-faint truncate">{formatDate(match.match_datetime)}</span>
						{#if u === 'locked'}
							<span class="text-wire-hi">·</span>
							<span class="inline-flex items-center gap-0.5 text-faint">
								<svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5"
										d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
								</svg>
								{t('locked_short')}
							</span>
						{/if}
						{#if match.group_label}
							<span class="text-wire-hi">·</span>
							<span class="text-faint">{t('group_short')} {match.group_label}</span>
						{/if}
					</div>
				{/if}
			</div>

			<a href="/matches/{match.id}" class="flex-1 min-w-0 group/team">
				<span class="text-base font-semibold text-fg group-hover/team:text-accent group-hover/team:underline underline-offset-4 transition-colors truncate block text-right">
					{teamLabel(match.away_team)}
				</span>
			</a>

			<a href="/matches/{match.id}" aria-label={teamLabel(match.away_team)} class="shrink-0">
				<Flag code={match.away_flag} size={flagSize} />
			</a>

			<a href="/matches/{match.id}" aria-label={t('match_view_details')} title={t('match_view_details')}
				class="shrink-0 w-7 h-7 -mr-1 flex items-center justify-center text-faint hover:text-accent hover:bg-raised rounded-md transition-colors">
				<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" aria-hidden="true">
					<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
				</svg>
			</a>
		</div>
	{/if}
</div>
