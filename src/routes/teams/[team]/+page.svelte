<script lang="ts">
	import { formatDate } from '$lib/utils';
	import { STAGE_LABELS_FR, STAGE_LABELS_EN, teamLabel } from '$lib/wc2026';
	import { t, getLang } from '$lib/i18n.svelte';
	import Flag from '$lib/components/Flag.svelte';

	let { data } = $props();

	let showAllUpcoming = $state(false);
	let showAllResults  = $state(false);

	const nextMatch = $derived(data.upcoming[0] ?? null);
	const laterMatches = $derived(data.upcoming.slice(1));
	const visibleUpcoming = $derived(showAllUpcoming ? laterMatches : laterMatches.slice(0, 3));
	const visibleResults  = $derived(showAllResults ? data.finished : data.finished.slice(0, 3));

	const stageLabels = $derived(getLang() === 'fr' ? STAGE_LABELS_FR : STAGE_LABELS_EN);

	// Result from this team's perspective: 'W' | 'D' | 'L'
	function outcome(m: any): 'W' | 'D' | 'L' {
		const isHome = m.home_team === data.team;
		const gf = isHome ? m.home_score : m.away_score;
		const ga = isHome ? m.away_score : m.home_score;
		return gf > ga ? 'W' : gf === ga ? 'D' : 'L';
	}

	const outcomeStyle = $derived<Record<string, { bg: string; label: string }>>({
		W: { bg: 'var(--color-accent)',  label: t('team_w') },
		D: { bg: 'var(--color-wire-hi)', label: t('team_d') },
		L: { bg: 'var(--color-err)',     label: t('team_l') }
	});

	function opponent(m: any) {
		return m.home_team === data.team
			? { name: m.away_team, flag: m.away_flag }
			: { name: m.home_team, flag: m.home_flag };
	}

	// Ratio bar segments — only when at least one match has been played
	const ratioSegments = $derived.by(() => {
		const { wins, draws, losses, played } = data.stats;
		if (played === 0) return [];
		return [
			{ key: 'W', pct: (wins   / played) * 100, color: 'var(--color-accent)' },
			{ key: 'D', pct: (draws  / played) * 100, color: 'var(--color-wire-hi)' },
			{ key: 'L', pct: (losses / played) * 100, color: 'var(--color-err)' }
		].filter((s) => s.pct > 0);
	});

	// Form: last 5 results, oldest → newest (reading order ends on the latest)
	const form = $derived(data.finished.slice(0, 5).reverse().map(outcome));
</script>

<div class="max-w-2xl mx-auto space-y-6">

	<button type="button" onclick={() => history.back()}
		class="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg transition-colors cursor-pointer -mb-1 group/back">
		<svg class="w-4 h-4 group-hover/back:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" aria-hidden="true">
			<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
		</svg>
		<span>{t('back')}</span>
	</button>

	<!-- ── Header: flag + name + group ─────────────────────────────────── -->
	<header class="flex items-center gap-4">
		<Flag code={data.flag} size={56} alt={teamLabel(data.team)} />
		<div class="min-w-0">
			<h1 class="text-2xl font-bold text-fg leading-tight" style="font-family: var(--font-display); letter-spacing: 0.02em">
				{teamLabel(data.team)}
			</h1>
			{#if data.groupLabel}
				<p class="text-xs text-faint mt-0.5">{t('group_short')} {data.groupLabel}</p>
			{/if}
		</div>
	</header>

	<!-- ── Record: W-D-L ratio + goal stats ────────────────────────────── -->
	{#if data.stats.played > 0}
		<section class="space-y-3">
			<div class="flex items-baseline justify-between">
				<div class="flex items-baseline gap-3 text-sm tabular-nums">
					<span class="font-bold text-accent">{data.stats.wins}<span class="text-[11px] font-normal ml-0.5">{t('team_w')}</span></span>
					<span class="font-bold text-muted">{data.stats.draws}<span class="text-[11px] font-normal ml-0.5">{t('team_d')}</span></span>
					<span class="font-bold text-err">{data.stats.losses}<span class="text-[11px] font-normal ml-0.5">{t('team_l')}</span></span>
				</div>
				<span class="text-xs text-faint tabular-nums">{data.stats.played} {t('team_played_suffix')}</span>
			</div>

			<!-- Ratio bar -->
			<div class="flex h-2 rounded-full overflow-hidden bg-raised gap-px">
				{#each ratioSegments as seg (seg.key)}
					<div class="h-full transition-all" style="width: {seg.pct}%; background: {seg.color}"></div>
				{/each}
			</div>

			<dl class="flex items-center gap-5 text-sm tabular-nums">
				<div class="flex items-baseline gap-1.5">
					<dt class="text-[11px] text-faint">{t('team_gf')}</dt>
					<dd class="font-semibold text-fg">{data.stats.goalsFor}</dd>
				</div>
				<div class="flex items-baseline gap-1.5">
					<dt class="text-[11px] text-faint">{t('team_ga')}</dt>
					<dd class="font-semibold text-fg">{data.stats.goalsAgainst}</dd>
				</div>
				<div class="flex items-baseline gap-1.5">
					<dt class="text-[11px] text-faint">{t('team_diff')}</dt>
					<dd class="font-semibold {data.stats.diff > 0 ? 'text-accent' : data.stats.diff < 0 ? 'text-err' : 'text-muted'}">
						{data.stats.diff > 0 ? '+' : ''}{data.stats.diff}
					</dd>
				</div>
				{#if data.stats.cleanSheets > 0}
					<div class="flex items-baseline gap-1.5">
						<dt class="text-[11px] text-faint">{t('team_clean_sheets')}</dt>
						<dd class="font-semibold text-fg">{data.stats.cleanSheets}</dd>
					</div>
				{/if}
			</dl>

			<!-- Form: last 5, oldest → latest -->
			{#if form.length >= 2}
				<div class="flex items-center gap-2">
					<span class="text-[11px] text-faint">{t('team_form')}</span>
					<div class="flex gap-1">
						{#each form as res, i (i)}
							<span class="w-4 h-4 rounded-sm flex items-center justify-center text-[9px] font-bold"
								style="background: {outcomeStyle[res].bg}; color: var(--color-canvas)">
								{outcomeStyle[res].label}
							</span>
						{/each}
					</div>
				</div>
			{/if}
		</section>
	{/if}

	<!-- ── Flavour stats: bonus multiplier + supporters ────────────────── -->
	<!-- The MULTIPLIER, not the raw Polymarket odds: it's the number the
	     site actually applies to favorite-team bonuses. -->
	{#if data.multiplier || data.supporters > 0}
		<dl class="flex items-center gap-5 text-sm tabular-nums {data.stats.played > 0 ? 'pt-4 border-t border-wire/60' : ''}">
			{#if data.multiplier}
				<div class="flex items-baseline gap-1.5" title={t('team_winner_odds_title')}>
					<dt class="text-[11px] text-faint">{t('team_winner_odds')}</dt>
					<dd class="font-semibold text-accent">×{data.multiplier.toFixed(1)}</dd>
				</div>
			{/if}
			{#if data.supporters > 0}
				<div class="flex items-baseline gap-1.5">
					<dt class="text-[11px] text-faint">{t('team_supporters')}</dt>
					<dd class="font-semibold text-fg">{data.supporters}</dd>
				</div>
			{/if}
		</dl>
	{/if}

	<!-- ── Scorers + cards (from match timelines) ───────────────────────── -->
	{#if data.scorers.length > 0 || data.cards.length > 0}
		<div class="grid gap-4 {data.scorers.length > 0 && data.cards.length > 0 ? 'sm:grid-cols-2' : ''}">
			{#if data.scorers.length > 0}
				<section>
					<h2 class="text-[11px] text-faint uppercase tracking-widest mb-2">{t('team_scorers')}</h2>
					<ul class="divide-y divide-wire/40 border-y border-wire/40">
						{#each data.scorers as s (s.player)}
							<li class="flex items-center gap-2 py-2 text-sm">
								<span class="shrink-0">⚽</span>
								<span class="flex-1 text-fg truncate">{s.player}</span>
								{#if s.goals > 1}
									<span class="text-xs font-bold text-accent tabular-nums shrink-0">×{s.goals}</span>
								{/if}
							</li>
						{/each}
					</ul>
				</section>
			{/if}

			{#if data.cards.length > 0}
				<section>
					<h2 class="text-[11px] text-faint uppercase tracking-widest mb-2">{t('team_cards')}</h2>
					<ul class="divide-y divide-wire/40 border-y border-wire/40">
						{#each data.cards as c (c.player)}
							<li class="flex items-center gap-2 py-2 text-sm">
								<span class="flex gap-0.5 shrink-0">
									{#each Array(c.red) as _}
										<span class="w-2.5 h-3.5 rounded-[2px] bg-err"></span>
									{/each}
									{#each Array(c.yellow) as _}
										<span class="w-2.5 h-3.5 rounded-[2px]" style="background: var(--color-warn, #eab308)"></span>
									{/each}
								</span>
								<span class="flex-1 text-fg truncate">{c.player}</span>
							</li>
						{/each}
					</ul>
				</section>
			{/if}
		</div>
	{/if}

	<!-- ── Live now ─────────────────────────────────────────────────────── -->
	{#if data.live}
		{@const opp = opponent(data.live)}
		<a href="/matches/{data.live.id}"
			class="flex items-center gap-3 rounded-xl bg-panel border border-live/40 p-4 hover:border-live transition-colors">
			<span class="inline-flex items-center gap-1.5 shrink-0">
				<span class="w-1.5 h-1.5 rounded-full bg-live animate-pulse"></span>
				<span class="text-[10px] font-bold text-live uppercase tracking-widest">LIVE</span>
			</span>
			<span class="flex-1 text-sm text-fg truncate">{t('team_vs')} {teamLabel(opp.name)}</span>
			<span class="text-xl font-bold text-live tabular-nums" style="font-family: var(--font-display)">
				{data.live.home_score ?? 0} – {data.live.away_score ?? 0}
			</span>
		</a>
	{/if}

	<!-- ── Next match ───────────────────────────────────────────────────── -->
	{#if nextMatch}
		{@const opp = opponent(nextMatch)}
		<section>
			<h2 class="text-[11px] text-faint uppercase tracking-widest mb-2">{t('team_next_match')}</h2>
			<a href="/matches/{nextMatch.id}"
				class="flex items-center gap-3 rounded-xl bg-panel border border-wire p-4 hover:border-accent/60 transition-colors">
				<Flag code={opp.flag} size={32} alt={teamLabel(opp.name)} />
				<div class="flex-1 min-w-0">
					<p class="text-sm font-semibold text-fg truncate">{t('team_vs')} {teamLabel(opp.name)}</p>
					<p class="text-xs text-faint mt-0.5">
						{stageLabels[nextMatch.stage] ?? nextMatch.stage}
						{nextMatch.group_label ? ` · ${t('group_short')} ${nextMatch.group_label}` : ''}
					</p>
				</div>
				<span class="text-xs text-muted tabular-nums shrink-0">{formatDate(nextMatch.match_datetime)}</span>
			</a>
		</section>
	{/if}

	<!-- ── Upcoming matches (after the next one) ───────────────────────── -->
	{#if laterMatches.length > 0}
		<section>
			<h2 class="text-[11px] text-faint uppercase tracking-widest mb-2">{t('team_upcoming')}</h2>
			<div class="-mx-4 sm:mx-0 sm:rounded-xl sm:border sm:border-wire overflow-hidden border-y border-wire sm:border-y-0">
				{#each visibleUpcoming as m (m.id)}
					{@const opp = opponent(m)}
					<a href="/matches/{m.id}"
						class="flex items-center gap-3 px-4 py-3 border-b border-wire/40 last:border-0 hover:bg-raised/40 transition-colors">
						<Flag code={opp.flag} size={20} alt={teamLabel(opp.name)} />
						<span class="flex-1 text-sm text-fg truncate">{t('team_vs')} {teamLabel(opp.name)}</span>
						<span class="text-xs text-faint tabular-nums shrink-0">{formatDate(m.match_datetime)}</span>
					</a>
				{/each}
			</div>
			{#if laterMatches.length > 3}
				<button type="button" onclick={() => showAllUpcoming = !showAllUpcoming}
					class="mt-2 text-xs text-muted hover:text-fg transition-colors cursor-pointer">
					{showAllUpcoming ? t('team_show_less') : `${t('team_show_all')} (${laterMatches.length})`}
				</button>
			{/if}
		</section>
	{/if}

	<!-- ── Recent results ──────────────────────────────────────────────── -->
	<section>
		<h2 class="text-[11px] text-faint uppercase tracking-widest mb-2">{t('team_results')}</h2>
		{#if data.finished.length === 0}
			<p class="text-sm text-faint py-4 text-center">{t('team_no_results')}</p>
		{:else}
			<div class="-mx-4 sm:mx-0 sm:rounded-xl sm:border sm:border-wire overflow-hidden border-y border-wire sm:border-y-0">
				{#each visibleResults as m (m.id)}
					{@const opp = opponent(m)}
					{@const res = outcome(m)}
					{@const isHome = m.home_team === data.team}
					<a href="/matches/{m.id}"
						class="flex items-center gap-3 px-4 py-3 border-b border-wire/40 last:border-0 hover:bg-raised/40 transition-colors">
						<!-- W/D/L chip -->
						<span class="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold shrink-0"
							style="background: {outcomeStyle[res].bg}; color: var(--color-canvas)">
							{outcomeStyle[res].label}
						</span>
						<Flag code={opp.flag} size={20} alt={teamLabel(opp.name)} />
						<span class="flex-1 text-sm text-fg truncate">{t('team_vs')} {teamLabel(opp.name)}</span>
						<span class="text-sm font-bold tabular-nums shrink-0
							{res === 'W' ? 'text-accent' : res === 'L' ? 'text-err' : 'text-muted'}"
							style="font-family: var(--font-display)">
							{isHome ? m.home_score : m.away_score} – {isHome ? m.away_score : m.home_score}
						</span>
					</a>
				{/each}
			</div>
			{#if data.finished.length > 3}
				<button type="button" onclick={() => showAllResults = !showAllResults}
					class="mt-2 text-xs text-muted hover:text-fg transition-colors cursor-pointer">
					{showAllResults ? t('team_show_less') : `${t('team_show_all')} (${data.finished.length})`}
				</button>
			{/if}
		{/if}
	</section>
</div>
