<script lang="ts">
	// One match in the knockout bracket. A real (decided) match is a tappable link
	// to its page; an undecided slot is a non-interactive row whose teams are
	// derived from the source tokens ("Winner R16·3" etc.).
	import Flag from '$lib/components/Flag.svelte';
	import { teamLabel } from '$lib/wc2026';
	import { getLang, t } from '$lib/i18n.svelte';
	import { formatDate, formatTime, knockoutOutcome } from '$lib/utils';
	import { sourceLabel, feedsIntoLabel, resolveSourceTeam, type SlotTeam } from '$lib/bracketMap';

	type M = {
		id: string;
		slot_code: string;
		home_team: string;
		away_team: string;
		home_flag: string | null;
		away_flag: string | null;
		home_source: string | null;
		away_source: string | null;
		home_score: number | null;
		away_score: number | null;
		ft_home_score?: number | null;
		ft_away_score?: number | null;
		pen_home?: number | null;
		pen_away?: number | null;
		status: string;
		match_datetime: string;
	};

	type SlotResults = { win: Map<string, SlotTeam>; lose: Map<string, SlotTeam> };
	let { match, slotResults }: { match: M; slotResults: SlotResults } = $props();

	const isReal = $derived(match.home_team !== 'TBD' && match.away_team !== 'TBD');
	const finished = $derived(match.status === 'finished');
	const live = $derived(match.status === 'live');
	const feed = $derived(feedsIntoLabel(match.slot_code));
	// For an undecided slot, surface the team that already qualified into it (its
	// feeder is finished) instead of a "Winner R32·3" label; null until then.
	const rh = $derived(isReal ? null : resolveSourceTeam(match.home_source, slotResults));
	const ra = $derived(isReal ? null : resolveSourceTeam(match.away_source, slotResults));
	const homeName = $derived(isReal ? teamLabel(match.home_team) : rh ? teamLabel(rh.team) : sourceLabel(match.home_source));
	const awayName = $derived(isReal ? teamLabel(match.away_team) : ra ? teamLabel(ra.team) : sourceLabel(match.away_source));
	// Winner emphasis on a finished match — penalties/extra time decide it, not
	// the 90-min score.
	const outcome = $derived(knockoutOutcome(match));
	const homeWon = $derived(finished && (outcome ? outcome.winner === 'home' : (match.home_score ?? 0) > (match.away_score ?? 0)));
	const awayWon = $derived(finished && (outcome ? outcome.winner === 'away' : (match.away_score ?? 0) > (match.home_score ?? 0)));
</script>

{#snippet inner()}
	<!-- micro line: date · status/feed cue -->
	<div class="flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-wide text-faint mb-1.5">
		<span class="truncate">{formatDate(match.match_datetime, getLang())}</span>
		<span class="flex items-center gap-1.5 shrink-0">
			{#if live}
				<span class="inline-flex items-center gap-1 rounded bg-live px-1.5 py-0.5 text-[9px] font-bold text-fg normal-case tracking-normal">
					<span class="w-1 h-1 rounded-full bg-fg/80 animate-pulse"></span>LIVE
				</span>
			{/if}
			{#if outcome}<span class="text-faint normal-case">{outcome.decided === 'pens' ? t('result_pens') : t('result_aet')} {outcome.home}<span class="mx-px">–</span>{outcome.away}</span>{/if}
			{#if feed}<span class="text-faint">→ {feed}</span>{/if}
		</span>
	</div>

	<div class="flex items-center gap-3">
		<!-- teams -->
		<div class="flex-1 min-w-0 space-y-1">
			<div class="flex items-center gap-2 min-w-0">
				<Flag code={isReal ? match.home_flag : rh?.flag ?? null} size={18} alt={isReal ? match.home_team : rh?.team ?? ''} />
				<span class="truncate text-sm {isReal ? `font-semibold ${homeWon ? 'text-fg' : awayWon ? 'text-muted' : 'text-fg'}` : rh ? 'text-muted' : 'text-faint'}">{homeName}</span>
			</div>
			<div class="flex items-center gap-2 min-w-0">
				<Flag code={isReal ? match.away_flag : ra?.flag ?? null} size={18} alt={isReal ? match.away_team : ra?.team ?? ''} />
				<span class="truncate text-sm {isReal ? `font-semibold ${awayWon ? 'text-fg' : homeWon ? 'text-muted' : 'text-fg'}` : ra ? 'text-muted' : 'text-faint'}">{awayName}</span>
			</div>
		</div>

		<!-- status: score (finished/live) or kickoff time (upcoming) -->
		<div class="shrink-0 text-right tabular-nums">
			{#if finished || live}
				<div class="font-display font-bold text-lg leading-none {live ? 'text-live' : 'text-fg'}"
					style="font-family: var(--font-display)">
					{match.home_score ?? 0}<span class="text-faint mx-1">–</span>{match.away_score ?? 0}
				</div>
			{:else}
				<div class="text-sm text-faint">{formatTime(match.match_datetime, getLang())}</div>
			{/if}
		</div>

		{#if isReal}
			<svg class="w-4 h-4 text-faint shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
				<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
			</svg>
		{/if}
	</div>
{/snippet}

{#if isReal}
	<a href="/matches/{match.id}" class="block px-4 py-3 hover:bg-raised/40 active:bg-raised/60 transition-colors">
		{@render inner()}
	</a>
{:else}
	<div class="px-4 py-3">{@render inner()}</div>
{/if}
