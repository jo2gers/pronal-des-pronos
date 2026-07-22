<script lang="ts">
	// V2 season home — one card per competition, the season countdown, and the
	// doors in. Logged-out visitors get the pitch + sign-up (reopened for the
	// new season); the WC archive is one link at the bottom.
	import { getLang, t } from '$lib/i18n.svelte';
	import { formatDate, formatTime } from '$lib/utils';
	import { reveal } from '$lib/motion';
	import CountUp from '$lib/components/CountUp.svelte';

	let { data } = $props();

	const fr = $derived(getLang() === 'fr');
	const name = (c: { name_fr: string; name_en: string }) => (fr ? c.name_fr : c.name_en);

	// Days until the earliest season kickoff (PL: Aug 21).
	const firstKickoff = $derived.by(() => {
		const dates = data.cards.map((c) => c.starts_at).filter(Boolean) as string[];
		return dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : null;
	});
	const daysToGo = $derived(
		firstKickoff ? Math.max(0, Math.ceil((new Date(firstKickoff).getTime() - Date.now()) / 86400000)) : null
	);

	const info = (card: any, team: string) => card.teamMap[team] ?? { short: team, logo: null };
</script>

<div class="max-w-2xl mx-auto space-y-10">

	<!-- ── Hero ─────────────────────────────────────────────────────────────── -->
	<section class="text-center pt-4 sm:pt-8" in:reveal={{ y: 12 }}>
		<p class="text-[10.5px] uppercase tracking-[0.2em] text-faint mb-4" style="font-family: var(--font-mono)">
			{fr ? 'Saison 2026-27' : '2026-27 season'}
		</p>
		<h1 class="text-4xl sm:text-5xl font-bold leading-[0.98]"
			style="font-family: var(--font-display); letter-spacing: -0.04em; text-wrap: balance">
			{fr ? 'La saison des pronos.' : 'The season of picks.'}
		</h1>
		<p class="text-[16px] leading-relaxed text-muted max-w-[48ch] mx-auto mt-4">
			{fr
				? 'Premier League et Ligue des Champions : pronostique chaque match, vise le score exact — les scores improbables paient gros.'
				: 'Premier League and Champions League: call every match, chase the exact score — unlikely scorelines pay big.'}
		</p>
		{#if daysToGo != null && daysToGo > 0}
			<p class="mt-5 text-2xl font-bold text-accent tabular-nums" style="font-family: var(--font-display)">
				J−<CountUp value={daysToGo} decimals={0} duration={700} />
			</p>
		{/if}
		{#if !data.user}
			<div class="mt-6 flex gap-3 justify-center flex-wrap">
				<a href="/auth/register" class="rounded-full bg-accent hover:bg-accent-hi px-6 py-3 text-sm font-bold text-canvas transition-colors">
					{t('nav_register')}
				</a>
				<a href="/auth/login" class="rounded-full border border-wire-hi hover:bg-panel px-6 py-3 text-sm font-medium text-fg transition-colors">
					{t('nav_login')}
				</a>
			</div>
		{/if}
	</section>

	<!-- ── One card per competition ─────────────────────────────────────────── -->
	{#each data.cards as card, i (card.slug)}
		<section class="rounded-2xl border border-wire bg-panel overflow-hidden" in:reveal={{ delay: 120 + i * 90, y: 12 }}>
			<div class="px-5 py-4 flex items-baseline justify-between gap-3 border-b border-wire/60">
				<h2 class="text-xl font-bold" style="font-family: var(--font-display); letter-spacing: -0.02em">
					{name(card)}
				</h2>
				<p class="text-[11px] text-faint tabular-nums" style="font-family: var(--font-mono)">
					{#if card.matchCount > 0}
						{card.matchCount} {fr ? 'matchs' : 'matches'}{card.starts_at ? ` · ${formatDate(card.starts_at, getLang())}` : ''}
					{:else}
						{fr ? 'tirage fin août' : 'draw late August'}
					{/if}
				</p>
			</div>

			{#if card.next.length > 0}
				<div class="divide-y divide-wire/40">
					{#each card.next as m (m.id)}
						<a href="/{card.slug}/matches/{m.id}" class="flex items-center gap-3 px-5 py-2.5 hover:bg-raised/40 transition-colors">
							<div class="flex-1 min-w-0 flex items-center justify-end gap-2">
								<span class="truncate text-sm text-fg text-right">{info(card, m.home_team).short}</span>
								{#if info(card, m.home_team).logo}<img src={info(card, m.home_team).logo} alt="" class="w-5 h-5 object-contain shrink-0" loading="lazy" />{/if}
							</div>
							<span class="shrink-0 text-[11px] text-faint tabular-nums w-14 text-center">{formatTime(m.match_datetime, getLang())}</span>
							<div class="flex-1 min-w-0 flex items-center gap-2">
								{#if info(card, m.away_team).logo}<img src={info(card, m.away_team).logo} alt="" class="w-5 h-5 object-contain shrink-0" loading="lazy" />{/if}
								<span class="truncate text-sm text-fg">{info(card, m.away_team).short}</span>
							</div>
						</a>
					{/each}
				</div>
			{:else}
				<p class="px-5 py-6 text-sm text-muted text-center">
					{fr ? 'Le calendrier arrive avec le tirage de la phase de ligue.' : 'Fixtures arrive with the league-phase draw.'}
				</p>
			{/if}

			<div class="px-5 py-3.5 border-t border-wire/60 flex items-center gap-4 flex-wrap">
				<a href="/{card.slug}/matches" class="text-sm font-semibold text-accent hover:text-accent-hi transition-colors">
					{fr ? 'Pronostiquer' : 'Make picks'} →
				</a>
				<a href="/{card.slug}/leaderboard" class="text-sm text-muted hover:text-fg transition-colors">
					{t('nav_leaderboard')}
				</a>
				<a href="/{card.slug}/team" class="text-sm text-muted hover:text-fg transition-colors ml-auto">
					{#if card.myTeam}
						<span class="inline-flex items-center gap-1.5">
							{#if info(card, card.myTeam).logo}<img src={info(card, card.myTeam).logo} alt="" class="w-4 h-4 object-contain" />{/if}
							{info(card, card.myTeam).short}
						</span>
					{:else}
						{fr ? 'Choisir mon club' : 'Pick my club'}
					{/if}
				</a>
			</div>
		</section>
	{/each}

	<!-- ── The archive ──────────────────────────────────────────────────────── -->
	<p class="text-center text-sm text-faint pb-4" in:reveal={{ delay: 320 }}>
		<a href="/matches" class="hover:text-fg transition-colors underline decoration-wire underline-offset-4">
			{fr ? 'Archive · Coupe du Monde 2026 🏆 Espagne' : 'Archive · World Cup 2026 🏆 Spain'}
		</a>
	</p>
</div>
