<script lang="ts">
	// The home = the HALL of the current game: banner + your dashboard (points /
	// rank / last week) + the CURRENT matchweek's fixtures, pickable inline. A
	// switch pill changes games. The WC archive is one link at the bottom.
	import { getLang, t } from '$lib/i18n.svelte';
	import { groupByDay } from '$lib/utils';
	import { reveal } from '$lib/motion';
	import CompMatchRow from '$lib/components/CompMatchRow.svelte';

	let { data } = $props();

	const fr = $derived(getLang() === 'fr');
	const name = (c: { name_fr: string; name_en: string }) => (fr ? c.name_fr : c.name_en);

	const current = $derived(data.current);
	const others = $derived(data.active.filter((c) => c.slug !== current?.slug));
	const days = $derived(groupByDay(data.matches, getLang()));

	const teamInfo = (team: string) => data.teamMap[team] ?? { short: team, logo: null };
</script>

<div class="max-w-2xl mx-auto space-y-6">

	<!-- ── Banner + dashboard ───────────────────────────────────────────────── -->
	<header class="pt-4 sm:pt-6" in:reveal={{ y: 12 }}>
		<p class="text-[10.5px] uppercase tracking-[0.2em] text-faint mb-2" style="font-family: var(--font-mono)">
			{fr ? 'Saison 2026-27' : '2026-27 season'}
		</p>
		<div class="flex items-start justify-between gap-3 flex-wrap">
			<h1 class="text-4xl sm:text-5xl font-bold leading-[0.95]"
				style="font-family: var(--font-display); letter-spacing: -0.04em; text-wrap: balance">
				{current ? name(current) : (fr ? 'La saison' : 'The season')}
			</h1>
			{#if others.length > 0}
				<div class="flex flex-wrap gap-2 pt-2 shrink-0">
					{#each others as c (c.slug)}
						<a href="?comp={c.slug}"
							class="inline-flex items-center gap-1.5 rounded-full border border-wire hover:border-accent px-3.5 py-2 text-xs font-semibold text-muted hover:text-fg transition-colors">
							<span aria-hidden="true">⇄</span> {name(c)}
						</a>
					{/each}
				</div>
			{/if}
		</div>

		{#if data.user && data.stats}
			<!-- Your dashboard for THIS game (points never mixed across games) -->
			<div class="mt-5 flex flex-wrap items-baseline gap-x-6 gap-y-2">
				<div class="flex items-baseline gap-2">
					<span class="text-[10.5px] uppercase tracking-[0.14em] text-faint" style="font-family: var(--font-mono)">{fr ? 'Mes points' : 'My points'}</span>
					<span class="text-3xl font-bold text-accent tabular-nums" style="font-family: var(--font-display)">{data.stats.totalPoints.toFixed(2)}</span>
				</div>
				<div class="flex items-baseline gap-2">
					<span class="text-[10.5px] uppercase tracking-[0.14em] text-faint" style="font-family: var(--font-mono)">{fr ? 'Rang' : 'Rank'}</span>
					<span class="text-lg font-semibold text-fg tabular-nums" style="font-family: var(--font-display)">{data.stats.rank != null ? `#${data.stats.rank}` : '—'}</span>
				</div>
				<div class="flex items-baseline gap-2">
					<span class="text-[10.5px] uppercase tracking-[0.14em] text-faint" style="font-family: var(--font-mono)">{fr ? 'Cette semaine' : 'This week'}</span>
					<span class="text-lg font-semibold tabular-nums {data.stats.weekPoints > 0 ? 'text-accent' : 'text-muted'}">{data.stats.weekPoints > 0 ? '+' : ''}{data.stats.weekPoints.toFixed(2)}</span>
				</div>
			</div>
		{:else if !data.user}
			<p class="text-[15px] leading-relaxed text-muted max-w-[46ch] mt-3">
				{fr
					? 'Pronostique chaque match, vise le score exact — les scores improbables paient gros.'
					: 'Call every match, chase the exact score — unlikely scorelines pay big.'}
			</p>
			<div class="mt-5 flex gap-3 flex-wrap">
				<a href="/auth/register" class="rounded-full bg-accent hover:bg-accent-hi px-6 py-3 text-sm font-bold text-canvas transition-colors">{t('nav_register')}</a>
				<a href="/auth/login" class="rounded-full border border-wire-hi hover:bg-panel px-6 py-3 text-sm font-medium text-fg transition-colors">{t('nav_login')}</a>
			</div>
		{/if}
	</header>

	{#snippet dayBlock(bucket: { key: string; label: string; items: any[] })}
		<div class="flex items-center gap-3 mb-2 px-1">
			<span class="flex-1 h-px bg-wire"></span>
			<span class="text-[11px] uppercase tracking-widest text-faint">{bucket.label}</span>
			<span class="flex-1 h-px bg-wire"></span>
		</div>
		<div class="-mx-4 sm:mx-0 divide-y divide-wire/60 border-y border-wire sm:border sm:rounded-xl sm:bg-panel/40 overflow-hidden">
			{#each bucket.items as m (m.id)}
				<CompMatchRow match={m}
					home={teamInfo(m.home_team)}
					away={teamInfo(m.away_team)}
					existingProno={data.pronosticsMap[m.id] ?? null}
					loggedIn={!!data.user}
					action="/{current?.slug}/matches?/pronostic"
					href="/{current?.slug}/matches/{m.id}" />
			{/each}
		</div>
	{/snippet}

	<!-- ── The current matchweek ────────────────────────────────────────────── -->
	{#if current && data.matches.length > 0}
		<section in:reveal={{ delay: 100, y: 10 }}>
			<div class="flex items-baseline justify-between gap-3 mb-3 px-1">
				<h2 class="text-lg font-bold text-fg" style="font-family: var(--font-display)">
					{#if data.currentMatchday != null}
						{fr ? 'Journée' : 'Matchweek'} {data.currentMatchday}
					{:else}
						{fr ? 'Prochains matchs' : 'Upcoming'}
					{/if}
				</h2>
				<a href="/{current.slug}/matches" class="text-sm text-muted hover:text-accent transition-colors shrink-0">
					{fr ? 'Toutes les journées →' : 'All matchweeks →'}
				</a>
			</div>
			<div class="space-y-4">
				{#each days as bucket (bucket.key)}
					<div>{@render dayBlock(bucket)}</div>
				{/each}
			</div>
		</section>
	{:else if current}
		<section class="rounded-2xl border border-wire bg-panel/50 px-5 py-8 text-center" in:reveal={{ delay: 100 }}>
			<p class="text-muted">{fr ? 'Le calendrier arrive avec le tirage de la phase de ligue.' : 'Fixtures arrive with the league-phase draw.'}</p>
		</section>
	{/if}

	<!-- ── Doors ────────────────────────────────────────────────────────────── -->
	{#if current}
		<div class="flex items-center gap-4 px-1 pt-1">
			<a href="/{current.slug}/leaderboard" class="text-sm font-semibold text-accent hover:text-accent-hi transition-colors">{t('nav_leaderboard')} →</a>
			<a href="/{current.slug}/matches" class="text-sm text-muted hover:text-fg transition-colors">{fr ? 'Tous les matchs' : 'All matches'}</a>
		</div>
	{/if}

	<!-- ── Archive: the final standings (who won) ───────────────────────────── -->
	<p class="text-center text-sm text-faint pt-2 pb-4">
		<a href="/leaderboard" class="hover:text-fg transition-colors underline decoration-wire underline-offset-4">
			{fr ? 'Archive · Coupe du Monde 2026 — classement final 🏆' : 'Archive · World Cup 2026 — final standings 🏆'}
		</a>
	</p>
</div>
