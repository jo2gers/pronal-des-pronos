<script lang="ts">
	// Real connector bracket: a left→right tree (R32 → R16 → ¼ → ½ → Final) with
	// branch lines, horizontally scrollable. Card positions are computed (each
	// deeper card sits at the midpoint of its two feeders) and connectors drawn as
	// SVG elbows, so the geometry is exact rather than relying on flexbox hacks.
	import Flag from '$lib/components/Flag.svelte';
	import { teamLabel } from '$lib/wc2026';
	import { getLang } from '$lib/i18n.svelte';
	import { STAGE_LABELS_FR, STAGE_LABELS_EN } from '$lib/wc2026';
	import { roundShort, sourceLabel } from '$lib/bracketMap';

	type M = {
		id: string; slot_code: string; stage: string;
		home_team: string; away_team: string;
		home_flag: string | null; away_flag: string | null;
		home_source: string | null; away_source: string | null;
		home_score: number | null; away_score: number | null;
		status: string; match_datetime: string;
	};
	type Round = { stage: string; matches: M[] };

	let { rounds }: { rounds: Round[] } = $props();

	const CARD_H = 44;
	const CARD_W = 150;
	const COL_W = 196;
	const PITCH = 56;
	const HEAD = 26;

	const MAIN = ['round_of_32', 'round_of_16', 'quarters', 'semis', 'final'];
	const tree = $derived(MAIN.map((s) => rounds.find((r) => r.stage === s) ?? { stage: s, matches: [] }));
	const third = $derived(rounds.find((r) => r.stage === 'third')?.matches?.[0] ?? null);
	const labels = $derived(getLang() === 'fr' ? STAGE_LABELS_FR : STAGE_LABELS_EN);

	function centerY(r: number, i: number): number {
		if (r <= 0) return HEAD + i * PITCH + CARD_H / 2;
		return (centerY(r - 1, i * 2) + centerY(r - 1, i * 2 + 1)) / 2;
	}

	const totalW = $derived(tree.length * COL_W - (COL_W - CARD_W));
	const totalH = $derived(HEAD + (tree[0]?.matches.length ?? 16) * PITCH);

	const connectors = $derived.by(() => {
		const out: string[] = [];
		for (let r = 1; r < tree.length; r++) {
			for (let i = 0; i < tree[r].matches.length; i++) {
				const ay = centerY(r - 1, 2 * i);
				const by = centerY(r - 1, 2 * i + 1);
				const ty = centerY(r, i);
				const fx = (r - 1) * COL_W + CARD_W;
				const sx = fx + (COL_W - CARD_W) / 2;
				const tx = r * COL_W;
				out.push(`M${fx} ${ay} H${sx} M${fx} ${by} H${sx} M${sx} ${ay} V${by} M${sx} ${ty} H${tx}`);
			}
		}
		return out;
	});

	const isReal = (m: M) => m.home_team !== 'TBD' && m.away_team !== 'TBD';
</script>

{#snippet face(m: M)}
	{@const real = isReal(m)}
	{@const played = m.status === 'finished' || m.status === 'live'}
	{@const live = m.status === 'live'}
	<div class="flex h-full flex-col justify-center rounded-lg border bg-panel px-2
		{real ? 'border-wire hover:border-wire-hi transition-colors' : 'border-wire/60'}">
		<div class="flex items-center gap-1.5 min-w-0">
			<Flag code={m.home_flag} size={13} />
			<span class="truncate text-[11px] {real ? 'text-fg font-medium' : 'text-faint'}">{real ? teamLabel(m.home_team) : sourceLabel(m.home_source)}</span>
			{#if played}<span class="ml-auto text-[11px] font-bold tabular-nums {live ? 'text-live' : 'text-fg'}">{m.home_score ?? 0}</span>{/if}
		</div>
		<div class="flex items-center gap-1.5 min-w-0 mt-1">
			<Flag code={m.away_flag} size={13} />
			<span class="truncate text-[11px] {real ? 'text-fg font-medium' : 'text-faint'}">{real ? teamLabel(m.away_team) : sourceLabel(m.away_source)}</span>
			{#if played}<span class="ml-auto text-[11px] font-bold tabular-nums {live ? 'text-live' : 'text-fg'}">{m.away_score ?? 0}</span>{/if}
		</div>
	</div>
{/snippet}

<div class="-mx-4 px-4 overflow-x-auto" style="-webkit-overflow-scrolling: touch;">
	<div class="relative" style="width: {totalW}px; height: {totalH}px;">
		<svg class="absolute inset-0 pointer-events-none" width={totalW} height={totalH} aria-hidden="true">
			{#each connectors as d}
				<path {d} fill="none" stroke="var(--color-wire)" stroke-width="1.5" />
			{/each}
		</svg>

		{#each tree as round, r}
			<div class="absolute font-mono text-[10px] uppercase tracking-wide text-faint"
				style="left: {r * COL_W}px; top: 4px; width: {CARD_W}px;">
				<span class="sm:hidden">{roundShort(round.stage)}</span>
				<span class="hidden sm:inline">{labels[round.stage]}</span>
			</div>
			{#each round.matches as m, i}
				<div class="absolute" style="left: {r * COL_W}px; top: {centerY(r, i) - CARD_H / 2}px; width: {CARD_W}px; height: {CARD_H}px;">
					{#if isReal(m)}
						<a href="/matches/{m.id}" class="block h-full">{@render face(m)}</a>
					{:else}
						<div class="h-full">{@render face(m)}</div>
					{/if}
				</div>
			{/each}
		{/each}
	</div>
</div>

{#if third}
	<div class="mt-3">
		<p class="text-[10px] uppercase tracking-wide text-faint font-mono mb-1.5">{labels['third']}</p>
		<div class="max-w-[260px]">
			{#if isReal(third)}
				<a href="/matches/{third.id}" class="block">{@render face(third)}</a>
			{:else}
				<div style="height: {CARD_H}px;">{@render face(third)}</div>
			{/if}
		</div>
	</div>
{/if}
