<script lang="ts">
	import { t, getLang } from '$lib/i18n.svelte';
	import { formatDate } from '$lib/utils';
	import Flag from '$lib/components/Flag.svelte';

	let { data } = $props();
	let expanded = $state<string | null>(null);
	let allExpanded = $state(false);

	function toggle(label: string) {
		expanded = expanded === label ? null : label;
		allExpanded = false;
	}

	function isOpen(label: string): boolean {
		return allExpanded || expanded === label;
	}

	function onKey(e: KeyboardEvent) {
		// Don't hijack typing inside form inputs
		const tag = (e.target as HTMLElement)?.tagName;
		if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
		if (e.key === 'e' || e.key === 'E') {
			allExpanded = !allExpanded;
			if (!allExpanded) expanded = null;
			e.preventDefault();
		}
		if (e.key === 'Escape') {
			expanded = null;
			allExpanded = false;
		}
	}

	// Position styling: 1-2 qualify, 3 = best-thirds path, 4 = eliminated
	function posColor(pos: number, played: number, total: number): string {
		// Until all 6 matches of the group are played, just dim everyone equally
		if (played < total) {
			if (pos === 1) return 'text-accent font-semibold';
			return 'text-fg';
		}
		if (pos <= 2) return 'text-accent font-semibold';
		if (pos === 3) return 'text-fg';
		return 'text-faint';
	}

	// Qualification status as a leading dot (no side-stripe — see absolute_bans)
	function posDot(pos: number, played: number, total: number): { color: string; title: string } | null {
		if (played < total) return null;
		if (pos <= 2)  return { color: 'var(--color-accent)', title: 'Qualifié' };
		if (pos === 3) return { color: 'var(--color-bonus)',  title: 'Meilleur 3ème' };
		return null;
	}
</script>

<svelte:window onkeydown={onKey} />

<div class="space-y-6">
	<header class="space-y-3">
		<div class="flex items-baseline justify-between flex-wrap gap-2">
			<div>
				<p class="text-[11px] text-faint uppercase tracking-widest mb-1">{t('schedule_eyebrow')}</p>
				<h1 class="text-2xl font-bold text-fg" style="font-family: var(--font-display); letter-spacing: 0.02em">
					{t('schedule_title')}
				</h1>
			</div>
		</div>
		<!-- Mobile-only expand-all toggle (keyboard hint hidden, so give touch an affordance) -->
		<button
			type="button"
			onclick={() => { allExpanded = !allExpanded; if (!allExpanded) expanded = null; }}
			aria-pressed={allExpanded}
			class="sm:hidden self-start rounded border border-wire hover:border-wire-hi px-3 py-1.5 text-xs text-muted hover:text-fg transition-colors cursor-pointer">
			{allExpanded ? t('schedule_collapse_all_mobile') : t('schedule_expand_all_mobile')}
		</button>

		<!-- Legend + kbd hint (desktop only) -->
		<dl class="hidden sm:flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-faint">
			<div class="flex items-center gap-1.5">
				<span class="inline-block w-1.5 h-1.5 rounded-full" style="background: var(--color-accent)"></span>
				<dt>{t('schedule_legend_qualified')}</dt>
			</div>
			<div class="flex items-center gap-1.5">
				<span class="inline-block w-1.5 h-1.5 rounded-full" style="background: var(--color-bonus)"></span>
				<dt>{t('schedule_legend_thirds')}</dt>
			</div>
			<div class="flex items-center gap-1.5">
				<span class="inline-block w-1.5 h-1.5 rounded-full bg-wire"></span>
				<dt>{t('schedule_legend_out')}</dt>
			</div>
			<div class="ml-auto text-faint/80 tabular-nums">
				<kbd class="px-1 py-px rounded bg-raised border border-wire text-[10px] font-mono">E</kbd> {t('schedule_kbd_expand')}
			</div>
		</dl>
	</header>

	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
		{#each data.groups as g}
			<section class="rounded-xl bg-panel border border-wire overflow-hidden">
				<!-- Group header (single toggle affordance with chevron + aria) -->
				<button
					type="button"
					onclick={() => toggle(g.label)}
					aria-expanded={isOpen(g.label)}
					aria-controls={`schedule-group-${g.label}`}
					class="w-full flex items-center justify-between gap-2 px-4 py-3 border-b border-wire hover:bg-raised/50 transition-colors cursor-pointer text-left">
					<h2 class="text-base font-semibold text-fg" style="font-family: var(--font-display)">
						{t('group_short')} {g.label}
					</h2>
					<div class="flex items-center gap-2 shrink-0">
						<span class="text-[11px] text-faint tabular-nums">
							{g.played}/{g.total} {t('schedule_played')}
						</span>
						<svg class="w-3.5 h-3.5 text-faint transition-transform duration-200 {isOpen(g.label) ? 'rotate-180' : ''}"
							fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
						</svg>
					</div>
				</button>

				<!-- Standings table -->
				<table class="w-full text-sm">
					<thead>
						<tr class="text-[10px] text-faint font-semibold border-b border-wire/60">
							<th class="px-2 py-1.5 text-left w-5">#</th>
							<th class="px-2 py-1.5 text-left">{t('schedule_team')}</th>
							<th class="px-1.5 py-1.5 text-right w-6 tabular-nums" title={t('schedule_played_t')}>{t('schedule_p')}</th>
							<th class="px-1.5 py-1.5 text-right w-6 tabular-nums" title={t('schedule_gd_t')}>{t('schedule_gd')}</th>
							<th class="px-2 py-1.5 text-right w-8 tabular-nums" title={t('schedule_pts_t')}>{t('schedule_pts')}</th>
						</tr>
					</thead>
					<tbody>
						{#each g.rows as row}
							{@const dot = posDot(row.pos, g.played, g.total)}
							<tr class="border-b border-wire/40 last:border-0">
								<td class="pl-2 pr-1 py-2 text-xs text-faint tabular-nums">
									<span class="inline-flex items-center gap-1.5">
										{#if dot}
											<span class="w-1.5 h-1.5 rounded-full shrink-0" style="background: {dot.color}" title={dot.title}></span>
										{:else}
											<span class="w-1.5 h-1.5 shrink-0" aria-hidden="true"></span>
										{/if}
										{row.pos}
									</span>
								</td>
								<td class="px-2 py-2">
									<div class="flex items-center gap-1.5 min-w-0">
										<Flag code={row.flag} size={20} />
										<span class="text-xs truncate {posColor(row.pos, g.played, g.total)}">{row.team}</span>
									</div>
								</td>
								<td class="px-1.5 py-2 text-right text-xs text-muted tabular-nums">{row.played}</td>
								<td class="px-1.5 py-2 text-right text-xs tabular-nums {row.gd > 0 ? 'text-fg' : row.gd < 0 ? 'text-faint' : 'text-muted'}">
									{row.gd > 0 ? '+' : ''}{row.gd}
								</td>
								<td class="px-2 py-2 text-right tabular-nums font-bold {posColor(row.pos, g.played, g.total)}"
									style="font-family: var(--font-display)">
									{row.pts}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>

				<!-- Expandable: full match list for this group -->
				{#if isOpen(g.label)}
					<div id={`schedule-group-${g.label}`} class="border-t border-wire/60 divide-y divide-wire/40">
						{#each g.matches as m}
							<a href="/matches/{m.id}"
								class="flex items-center gap-2 px-4 py-2.5 hover:bg-raised/50 transition-colors text-xs">
								<div class="flex-1 min-w-0 flex items-center gap-1.5">
									<Flag code={m.home_flag} size={20} />
									<span class="truncate text-fg">{m.home_team}</span>
								</div>

								<div class="shrink-0 min-w-[60px] text-center tabular-nums">
									{#if m.status === 'finished' && m.home_score !== null}
										<span class="font-bold text-fg" style="font-family: var(--font-display)">
											{m.home_score} – {m.away_score}
										</span>
									{:else if m.status === 'live'}
										<span class="font-bold text-live" style="font-family: var(--font-display)">
											{m.home_score ?? 0} – {m.away_score ?? 0}
										</span>
									{:else}
										<span class="text-faint text-[10px]">{formatDate(m.match_datetime)}</span>
									{/if}
								</div>

								<div class="flex-1 min-w-0 flex items-center justify-end gap-1.5">
									<span class="truncate text-fg text-right">{m.away_team}</span>
									<Flag code={m.away_flag} size={20} />
								</div>
							</a>
						{/each}
					</div>
				{/if}
			</section>
		{/each}
	</div>
</div>
