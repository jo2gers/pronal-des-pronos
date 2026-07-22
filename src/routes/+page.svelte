<script lang="ts">
	// V2 season home = the competition CHOOSER. You pick ONE competition and
	// enter its world; there is no side-by-side "both at once". The competition
	// already under way (fixtures loaded) is FEATURED — a large panel with the
	// countdown, next fixtures and the primary "Entrer" door. The rest are quiet
	// secondary teasers. This season: Premier League featured, Champions League
	// waiting on its late-August draw.
	import { getLang, t } from '$lib/i18n.svelte';
	import { formatDate, formatTime } from '$lib/utils';
	import { reveal } from '$lib/motion';
	import CountUp from '$lib/components/CountUp.svelte';

	let { data } = $props();

	const fr = $derived(getLang() === 'fr');
	const name = (c: { name_fr: string; name_en: string }) => (fr ? c.name_fr : c.name_en);

	// Featured = the competition that has fixtures (is live / ready). Everything
	// else is a secondary teaser. Robust to ordering and to UCL going live later.
	const featured = $derived(data.cards.find((c) => c.matchCount > 0) ?? data.cards[0] ?? null);
	const others = $derived(data.cards.filter((c) => c !== featured));

	const daysToGo = (starts: string | null) =>
		starts ? Math.max(0, Math.ceil((new Date(starts).getTime() - Date.now()) / 86400000)) : null;

	const info = (card: any, team: string) => card?.teamMap[team] ?? { short: team, logo: null };
</script>

<div class="max-w-2xl mx-auto space-y-8">

	<!-- ── Hero: the page IS a choice ───────────────────────────────────────── -->
	<section class="pt-4 sm:pt-8" in:reveal={{ y: 12 }}>
		<p class="text-[10.5px] uppercase tracking-[0.2em] text-faint mb-3" style="font-family: var(--font-mono)">
			{fr ? 'Saison 2026-27' : '2026-27 season'}
		</p>
		<h1 class="text-4xl sm:text-5xl font-bold leading-[0.98]"
			style="font-family: var(--font-display); letter-spacing: -0.04em; text-wrap: balance">
			{fr ? 'Choisis ta compétition.' : 'Pick your competition.'}
		</h1>
		<p class="text-[16px] leading-relaxed text-muted max-w-[46ch] mt-4">
			{fr
				? 'Premier League ou Ligue des Champions — pronostique chaque match, vise le score exact. Les scores improbables paient gros.'
				: 'Premier League or Champions League — call every match, chase the exact score. Unlikely scorelines pay big.'}
		</p>
		{#if !data.user}
			<div class="mt-6 flex gap-3 flex-wrap">
				<a href="/auth/register" class="rounded-full bg-accent hover:bg-accent-hi px-6 py-3 text-sm font-bold text-canvas transition-colors">
					{t('nav_register')}
				</a>
				<a href="/auth/login" class="rounded-full border border-wire-hi hover:bg-panel px-6 py-3 text-sm font-medium text-fg transition-colors">
					{t('nav_login')}
				</a>
			</div>
		{/if}
	</section>

	<!-- ── Featured competition ─────────────────────────────────────────────── -->
	{#if featured}
		{@const d = daysToGo(featured.starts_at)}
		<section class="relative rounded-2xl border border-wire bg-panel overflow-hidden" in:reveal={{ delay: 120, y: 12 }}>
			<!-- featured cue: the app's "active = lime bar" motif -->
			<span class="absolute inset-x-0 top-0 h-[2px] bg-accent" aria-hidden="true"></span>

			<div class="px-5 sm:px-6 pt-5 pb-4">
				<div class="flex items-center gap-2 mb-3">
					<span class="inline-block w-1.5 h-1.5 rounded-full bg-accent" aria-hidden="true"></span>
					<span class="text-[10.5px] uppercase tracking-[0.16em] text-accent" style="font-family: var(--font-mono)">
						{fr ? 'La saison commence' : 'The season kicks off'}
					</span>
				</div>
				<div class="flex items-end justify-between gap-3 flex-wrap">
					<h2 class="text-3xl sm:text-4xl font-bold leading-[0.95]" style="font-family: var(--font-display); letter-spacing: -0.03em">
						{name(featured)}
					</h2>
					{#if d != null && d > 0}
						<p class="text-right leading-none shrink-0">
							<span class="block text-2xl font-bold text-fg tabular-nums" style="font-family: var(--font-display)">{fr ? 'J' : 'D'}−<CountUp value={d} decimals={0} duration={700} /></span>
							{#if featured.starts_at}
								<span class="block mt-1 text-[11px] text-faint tabular-nums" style="font-family: var(--font-mono)">{formatDate(featured.starts_at, getLang())}</span>
							{/if}
						</p>
					{/if}
				</div>
			</div>

			<!-- next fixtures marquee -->
			{#if featured.next.length > 0}
				<div class="border-t border-wire/60 divide-y divide-wire/40">
					{#each featured.next as m (m.id)}
						<a href="/{featured.slug}/matches/{m.id}" class="flex items-center gap-3 px-5 sm:px-6 py-2.5 hover:bg-raised/40 transition-colors">
							<div class="flex-1 min-w-0 flex items-center justify-end gap-2">
								<span class="truncate text-sm text-fg text-right">{info(featured, m.home_team).short}</span>
								{#if info(featured, m.home_team).logo}<img src={info(featured, m.home_team).logo} alt="" class="w-5 h-5 object-contain shrink-0" loading="lazy" />{/if}
							</div>
							<span class="shrink-0 text-[11px] text-faint tabular-nums w-14 text-center">{formatTime(m.match_datetime, getLang())}</span>
							<div class="flex-1 min-w-0 flex items-center gap-2">
								{#if info(featured, m.away_team).logo}<img src={info(featured, m.away_team).logo} alt="" class="w-5 h-5 object-contain shrink-0" loading="lazy" />{/if}
								<span class="truncate text-sm text-fg">{info(featured, m.away_team).short}</span>
							</div>
						</a>
					{/each}
				</div>
			{/if}

			<!-- doors — Entrer is the committed way in -->
			<div class="px-5 sm:px-6 py-4 border-t border-wire/60 flex items-center gap-3 flex-wrap">
				<a href="/{featured.slug}/matches" class="rounded-full bg-accent hover:bg-accent-hi px-5 py-2.5 text-sm font-bold text-canvas transition-colors">
					{fr ? 'Entrer' : 'Enter'} →
				</a>
				<a href="/{featured.slug}/leaderboard" class="text-sm text-muted hover:text-fg transition-colors">{t('nav_leaderboard')}</a>
				<a href="/{featured.slug}/team" class="text-sm text-muted hover:text-fg transition-colors ml-auto">
					{#if featured.myTeam}
						<span class="inline-flex items-center gap-1.5">
							{#if info(featured, featured.myTeam).logo}<img src={info(featured, featured.myTeam).logo} alt="" class="w-4 h-4 object-contain" />{/if}
							{info(featured, featured.myTeam).short}
						</span>
					{:else}
						{fr ? 'Choisir mon club' : 'Pick my club'}
					{/if}
				</a>
			</div>
		</section>
	{/if}

	<!-- ── Secondary competitions — quieter, one tap to enter their world ────── -->
	{#each others as card, i (card.slug)}
		<a href="/{card.slug}/matches"
			class="group block rounded-2xl border border-wire/70 bg-panel/40 hover:border-wire-hi hover:bg-panel/70 transition-colors overflow-hidden"
			in:reveal={{ delay: 220 + i * 80, y: 12 }}>
			<div class="px-5 py-4 flex items-center justify-between gap-3">
				<div class="min-w-0">
					<div class="flex items-center gap-2">
						<h2 class="text-xl font-bold text-fg leading-tight" style="font-family: var(--font-display); letter-spacing: -0.02em">{name(card)}</h2>
						{#if card.matchCount === 0}
							<span class="rounded-full border border-wire px-2 py-0.5 text-[10px] uppercase tracking-wider text-faint" style="font-family: var(--font-mono)">{fr ? 'À venir' : 'Soon'}</span>
						{/if}
					</div>
					<p class="text-[13px] text-faint mt-1 truncate">
						{#if card.matchCount > 0}
							{card.matchCount} {fr ? 'matchs' : 'matches'}{card.starts_at ? ` · ${formatDate(card.starts_at, getLang())}` : ''}
						{:else}
							{fr ? 'Tirage fin août · le calendrier suit' : 'Draw late August · fixtures follow'}
						{/if}
					</p>
				</div>
				<span class="shrink-0 text-muted group-hover:text-fg transition-colors" aria-hidden="true">→</span>
			</div>
		</a>
	{/each}

	<!-- ── The archive ──────────────────────────────────────────────────────── -->
	<p class="text-center text-sm text-faint pb-4" in:reveal={{ delay: 320 }}>
		<a href="/matches" class="hover:text-fg transition-colors underline decoration-wire underline-offset-4">
			{fr ? 'Archive · Coupe du Monde 2026 🏆 Espagne' : 'Archive · World Cup 2026 🏆 Spain'}
		</a>
	</p>
</div>
