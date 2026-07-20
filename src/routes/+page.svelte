<script lang="ts">
	// Farewell home — the tournament is over. Thank-you note (visitor's language),
	// world champion, players' final podium, and the two doors that stay open.
	import { t, getLang } from '$lib/i18n.svelte';
	import { teamLabel } from '$lib/wc2026';
	import { knockoutOutcome } from '$lib/utils';
	import { reveal, pop } from '$lib/motion';
	import Flag from '$lib/components/Flag.svelte';
	import CountUp from '$lib/components/CountUp.svelte';

	let { data } = $props();

	const fin = $derived(data.finalMatch as any);
	// Effective final result: 90' score + the ET/pens line (Spain won 1-0 a.p.).
	const outcome = $derived(fin ? knockoutOutcome(fin) : null);
	const champTeam = $derived.by(() => {
		if (!fin) return null;
		const homeWon = outcome ? outcome.winner === 'home' : (fin.home_score ?? 0) > (fin.away_score ?? 0);
		return {
			name: homeWon ? fin.home_team : fin.away_team,
			flag: homeWon ? fin.home_flag : fin.away_flag
		};
	});

	const medal = ['text-accent', 'text-fg/80', 'text-bonus'];
</script>

<div class="max-w-2xl mx-auto space-y-12 pt-6 sm:pt-12 pb-8">

	<!-- ── Thank you ─────────────────────────────────────────────────────────── -->
	<section class="text-center" in:reveal={{ y: 12 }}>
		<p class="text-[10.5px] uppercase tracking-[0.2em] text-faint mb-5" style="font-family: var(--font-mono)">
			{getLang() === 'fr' ? 'Coupe du Monde 2026 · 11 juin – 19 juillet' : 'World Cup 2026 · June 11 – July 19'}
		</p>
		<h1 class="text-5xl sm:text-6xl font-bold leading-[0.98]"
			style="font-family: var(--font-display); letter-spacing: -0.04em; text-wrap: balance">
			{t('over_title')}
		</h1>
		<p class="text-[17px] leading-relaxed text-muted max-w-[46ch] mx-auto mt-6">
			{t('over_body')}
		</p>
	</section>

	<!-- ── Feedback survey invite — until this account has answered ──────────── -->
	{#if !data.surveyDone}
		<section in:reveal={{ delay: 80, y: 12 }}>
			<a href="/survey"
				class="block rounded-2xl border border-accent/30 px-6 py-6 text-center hover:border-accent/60 transition-colors"
				style="background: var(--color-accent-lo)">
				<p class="text-lg font-bold text-fg" style="font-family: var(--font-display); letter-spacing: -0.02em">
					💬 {t('home_survey_title')}
				</p>
				<p class="text-sm text-muted mt-2 max-w-[46ch] mx-auto">{t('home_survey_body')}</p>
				<span class="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-canvas mt-4">
					{t('home_survey_cta')}
					<span aria-hidden="true">→</span>
				</span>
			</a>
		</section>
	{/if}

	<!-- ── World champion ────────────────────────────────────────────────────── -->
	{#if fin && champTeam}
		<section in:reveal={{ delay: 120, y: 12 }}>
			<a href="/matches/{fin.id}"
				class="block rounded-2xl border border-wire bg-panel px-6 py-7 text-center hover:border-wire-hi transition-colors">
				<p class="text-[10px] uppercase tracking-[0.14em] text-faint mb-4" style="font-family: var(--font-mono)">
					🏆 {t('over_champion')}
				</p>
				<div class="flex items-center justify-center gap-3" in:pop={{ delay: 260 }}>
					<Flag code={champTeam.flag} size={44} alt={teamLabel(champTeam.name)} />
					<span class="text-3xl sm:text-4xl font-bold text-fg"
						style="font-family: var(--font-display); letter-spacing: -0.02em">
						{teamLabel(champTeam.name)}
					</span>
				</div>
				<p class="text-sm text-faint mt-4 tabular-nums">
					{teamLabel(fin.home_team)} {fin.home_score}–{fin.away_score} {teamLabel(fin.away_team)}
					{#if outcome}
						<span class="text-muted"> · {outcome.decided === 'pens' ? t('result_pens') : t('result_aet')} {outcome.home}–{outcome.away}</span>
					{/if}
				</p>
			</a>
		</section>
	{/if}

	<!-- ── Players' final podium ─────────────────────────────────────────────── -->
	{#if data.top3.length > 0}
		<section in:reveal={{ delay: 220, y: 12 }}>
			<p class="text-[11px] uppercase tracking-[0.1em] text-faint mb-3 px-1" style="font-family: var(--font-mono)">
				{t('over_podium')}
			</p>
			<div class="-mx-4 sm:mx-0 divide-y divide-wire/60 border-y border-wire sm:border sm:rounded-xl sm:bg-panel/40 overflow-hidden">
				{#each data.top3 as p, i}
					<a href="/profile/{p.id}" class="flex items-center gap-3 px-4 py-3.5 hover:bg-raised/40 transition-colors">
						<span class="w-7 text-center text-lg font-bold tabular-nums {medal[i]}"
							style="font-family: var(--font-display)">{i + 1}</span>
						{#if p.avatar_url}
							<img src={p.avatar_url} alt="" class="w-9 h-9 rounded-full object-cover shrink-0" />
						{:else}
							<span class="w-9 h-9 rounded-full bg-raised border border-wire flex items-center justify-center text-sm font-bold text-muted shrink-0">
								{(p.display_name ?? p.username ?? '?')[0]?.toUpperCase()}
							</span>
						{/if}
						<span class="flex-1 min-w-0 truncate text-sm font-semibold text-fg">
							{p.display_name ?? p.username ?? '?'}
						</span>
						<span class="font-bold tabular-nums {i === 0 ? 'text-accent' : 'text-fg/80'}"
							style="font-family: var(--font-display)">
							<CountUp value={p.total} />
						</span>
					</a>
				{/each}
			</div>
			{#if data.myRank && data.myRank > 3}
				<p class="text-sm text-faint mt-3 px-1 text-center">
					{t('your_rank')} · <span class="text-fg font-semibold tabular-nums">#{data.myRank}</span>
					<span class="text-faint">/ {data.playerCount}</span>
				</p>
			{/if}
		</section>
	{/if}

	<!-- ── The two doors that stay open ──────────────────────────────────────── -->
	<section class="flex gap-3 justify-center flex-wrap" in:reveal={{ delay: 320, y: 10 }}>
		<a href="/leaderboard"
			class="inline-flex items-center gap-2 rounded-full bg-accent hover:bg-accent-hi px-6 py-3 text-sm font-semibold text-canvas transition-colors">
			{t('over_cta_leaderboard')}
			<span aria-hidden="true">→</span>
		</a>
		<a href="/matches"
			class="inline-flex items-center rounded-full border border-wire-hi hover:bg-panel px-6 py-3 text-sm font-medium text-fg transition-colors">
			{t('over_cta_matches')}
		</a>
	</section>
</div>
