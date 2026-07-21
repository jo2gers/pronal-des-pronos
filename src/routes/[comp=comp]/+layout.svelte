<script lang="ts">
	// V2 competition shell: a sub-nav under the site header — competition
	// switcher (PL ⇄ UCL) on the left, section tabs (Matchs | Classement) on the
	// right. Every child page renders inside the active competition's context.
	import { page } from '$app/state';
	import { getLang, t } from '$lib/i18n.svelte';

	let { data, children } = $props();

	const name = (c: { name_fr: string; name_en: string }) => (getLang() === 'fr' ? c.name_fr : c.name_en);

	// Current section ('matches' | 'leaderboard') to keep it when switching competition.
	const section = $derived(page.url.pathname.split('/')[2] ?? 'matches');
	const tabs = $derived([
		{ seg: 'matches', label: t('nav_matches') },
		{ seg: 'leaderboard', label: t('nav_leaderboard') }
	]);
</script>

<div class="mb-6 -mx-4 px-4 border-b border-wire">
	<div class="flex items-center justify-between gap-3 flex-wrap py-2.5">
		<!-- Competition switcher -->
		<div class="flex gap-1 rounded-lg bg-raised border border-wire p-1">
			{#each data.activeCompetitions as c (c.slug)}
				<a href="/{c.slug}/{section}"
					class="rounded px-3 py-1.5 text-sm font-semibold transition-colors
						{c.slug === data.competition.slug ? 'bg-panel text-fg shadow-sm' : 'text-muted hover:text-fg'}">
					{name(c)}
				</a>
			{/each}
		</div>

		<!-- Section tabs -->
		<nav class="flex items-center gap-4">
			{#each tabs as tab (tab.seg)}
				<a href="/{data.competition.slug}/{tab.seg}"
					class="text-sm font-medium transition-colors {section === tab.seg ? 'text-accent' : 'text-muted hover:text-fg'}">
					{tab.label}
				</a>
			{/each}
		</nav>
	</div>
</div>

{@render children()}
