<script lang="ts">
	// The home is the HALL of the game you're in — it opens on your current
	// competition (last entered), named by a big banner, with a switch button to
	// change games. NOT a "choose every time" chooser. The WC archive is one link
	// at the bottom, pointing at the final standings (who won).
	import { getLang, t } from '$lib/i18n.svelte';
	import { formatDate, formatTime } from '$lib/utils';
	import { reveal } from '$lib/motion';
	import CountUp from '$lib/components/CountUp.svelte';

	let { data } = $props();

	const fr = $derived(getLang() === 'fr');
	const name = (c: { name_fr: string; name_en: string }) => (fr ? c.name_fr : c.name_en);

	const card = $derived(data.card);
	// Other games you can switch to (usually just the one — PL ⇄ UCL).
	const others = $derived(data.active.filter((c) => c.slug !== data.current?.slug));

	const daysToGo = $derived.by(() => {
		const s = card?.starts_at;
		return s ? Math.max(0, Math.ceil((new Date(s).getTime() - Date.now()) / 86400000)) : null;
	});

	const info = (team: string) => card?.teamMap[team] ?? { short: team, logo: null };
</script>

<div class="max-w-2xl mx-auto space-y-8">

	<!-- ── Banner: the current game + a switch button ───────────────────────── -->
	<header class="pt-4 sm:pt-6" in:reveal={{ y: 12 }}>
		<p class="text-[10.5px] uppercase tracking-[0.2em] text-faint mb-2" style="font-family: var(--font-mono)">
			{fr ? 'Saison 2026-27' : '2026-27 season'}
		</p>
		<div class="flex items-start justify-between gap-3 flex-wrap">
			<h1 class="text-4xl sm:text-5xl font-bold leading-[0.95]"
				style="font-family: var(--font-display); letter-spacing: -0.04em; text-wrap: balance">
				{card ? name(card) : (fr ? 'La saison' : 'The season')}
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
		<p class="text-[15px] leading-relaxed text-muted max-w-[46ch] mt-3">
			{fr
				? 'Pronostique chaque match, vise le score exact — les scores improbables paient gros.'
				: 'Call every match, chase the exact score — unlikely scorelines pay big.'}
		</p>
		{#if !data.user}
			<div class="mt-5 flex gap-3 flex-wrap">
				<a href="/auth/register" class="rounded-full bg-accent hover:bg-accent-hi px-6 py-3 text-sm font-bold text-canvas transition-colors">
					{t('nav_register')}
				</a>
				<a href="/auth/login" class="rounded-full border border-wire-hi hover:bg-panel px-6 py-3 text-sm font-medium text-fg transition-colors">
					{t('nav_login')}
				</a>
			</div>
		{/if}

		{#if data.user && data.stats}
			<!-- Logged-in: my dashboard for THIS game (points never mixed across games) -->
			<div class="mt-5 flex flex-wrap items-baseline gap-x-6 gap-y-2">
				<div class="flex items-baseline gap-2">
					<span class="text-[10.5px] uppercase tracking-[0.14em] text-faint" style="font-family: var(--font-mono)">{fr ? 'Mes points' : 'My points'}</span>
					<span class="text-3xl font-bold text-accent tabular-nums" style="font-family: var(--font-display)">{data.stats.totalPoints.toFixed(2)}</span>
				</div>
				<div class="flex items-baseline gap-2">
					<span class="text-[10.5px] uppercase tracking-[0.14em] text-faint" style="font-family: var(--font-mono)">{fr ? 'Cette semaine' : 'This week'}</span>
					<span class="text-lg font-semibold tabular-nums {data.stats.weekPoints > 0 ? 'text-accent' : 'text-muted'}">{data.stats.weekPoints > 0 ? '+' : ''}{data.stats.weekPoints.toFixed(2)}</span>
				</div>
			</div>
		{/if}
	</header>

	<!-- ── The current game ─────────────────────────────────────────────────── -->
	{#if card}
		<section class="relative rounded-2xl border border-wire bg-panel overflow-hidden" in:reveal={{ delay: 120, y: 12 }}>
			<span class="absolute inset-x-0 top-0 h-[2px] bg-accent" aria-hidden="true"></span>

			<div class="px-5 sm:px-6 pt-5 pb-4 flex items-end justify-between gap-3 flex-wrap">
				<div class="flex items-center gap-2">
					<span class="inline-block w-1.5 h-1.5 rounded-full bg-accent" aria-hidden="true"></span>
					<span class="text-[10.5px] uppercase tracking-[0.16em] text-accent" style="font-family: var(--font-mono)">
						{card.matchCount > 0 ? (fr ? 'La saison commence' : 'The season kicks off') : (fr ? 'À venir' : 'Coming soon')}
					</span>
				</div>
				{#if daysToGo != null && daysToGo > 0}
					<p class="text-right leading-none shrink-0">
						<span class="block text-2xl font-bold text-fg tabular-nums" style="font-family: var(--font-display)">{fr ? 'J' : 'D'}−<CountUp value={daysToGo} decimals={0} duration={700} /></span>
						{#if card.starts_at}
							<span class="block mt-1 text-[11px] text-faint tabular-nums" style="font-family: var(--font-mono)">{formatDate(card.starts_at, getLang())}</span>
						{/if}
					</p>
				{/if}
			</div>

			{#if card.next.length > 0}
				<div class="border-t border-wire/60 divide-y divide-wire/40">
					{#each card.next as m (m.id)}
						<a href="/{card.slug}/matches/{m.id}" class="flex items-center gap-3 px-5 sm:px-6 py-2.5 hover:bg-raised/40 transition-colors">
							<div class="flex-1 min-w-0 flex items-center justify-end gap-2">
								<span class="truncate text-sm text-fg text-right">{info(m.home_team).short}</span>
								{#if info(m.home_team).logo}<img src={info(m.home_team).logo} alt="" class="w-5 h-5 object-contain shrink-0" loading="lazy" />{/if}
							</div>
							<span class="shrink-0 text-[11px] text-faint tabular-nums w-14 text-center">{formatTime(m.match_datetime, getLang())}</span>
							<div class="flex-1 min-w-0 flex items-center gap-2">
								{#if info(m.away_team).logo}<img src={info(m.away_team).logo} alt="" class="w-5 h-5 object-contain shrink-0" loading="lazy" />{/if}
								<span class="truncate text-sm text-fg">{info(m.away_team).short}</span>
							</div>
						</a>
					{/each}
				</div>
			{:else}
				<p class="px-5 sm:px-6 py-6 text-sm text-muted border-t border-wire/60">
					{fr ? 'Le calendrier arrive avec le tirage de la phase de ligue.' : 'Fixtures arrive with the league-phase draw.'}
				</p>
			{/if}

			<div class="px-5 sm:px-6 py-4 border-t border-wire/60 flex items-center gap-3 flex-wrap">
				<a href="/{card.slug}/matches" class="rounded-full bg-accent hover:bg-accent-hi px-5 py-2.5 text-sm font-bold text-canvas transition-colors">
					{fr ? 'Entrer' : 'Enter'} →
				</a>
				<a href="/{card.slug}/leaderboard" class="text-sm text-muted hover:text-fg transition-colors">{t('nav_leaderboard')}</a>
				<a href="/{card.slug}/team" class="text-sm text-muted hover:text-fg transition-colors ml-auto">
					{#if card.myTeam}
						<span class="inline-flex items-center gap-1.5">
							{#if info(card.myTeam).logo}<img src={info(card.myTeam).logo} alt="" class="w-4 h-4 object-contain" />{/if}
							{info(card.myTeam).short}
						</span>
					{:else}
						{fr ? 'Choisir mon club' : 'Pick my club'}
					{/if}
				</a>
			</div>
		</section>
	{/if}

	<!-- ── The archive — the final standings (who won) ──────────────────────── -->
	<p class="text-center text-sm text-faint pb-4" in:reveal={{ delay: 260 }}>
		<a href="/leaderboard" class="hover:text-fg transition-colors underline decoration-wire underline-offset-4">
			{fr ? 'Archive · Coupe du Monde 2026 — classement final 🏆' : 'Archive · World Cup 2026 — final standings 🏆'}
		</a>
	</p>
</div>
