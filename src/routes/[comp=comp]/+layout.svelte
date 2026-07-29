<script lang="ts">
	// V2 competition shell. You ENTER one competition from the home chooser and
	// live inside it — there is no PL⇄UCL switcher here (that would undo the
	// "commit to one competition" model). This slim bar is just the way back to
	// the chooser plus the section tabs; each child page's own <h1> carries the
	// competition identity (kept big so the competition feels like the world
	// you're in).
	import { page } from '$app/state';
	import { getLang, t } from '$lib/i18n.svelte';

	let { data, children } = $props();

	const fr = $derived(getLang() === 'fr');

	const section = $derived(page.url.pathname.split('/')[2] ?? 'matches');
	// Club-picking lives on the profile now (scoped to the current game), so it's
	// no longer a tab here.
	const tabs = $derived([
		{ seg: 'matches', label: t('nav_matches') },
		{ seg: 'leaderboard', label: t('nav_leaderboard') }
	]);
</script>

<div class="mb-6 -mx-4 px-4 border-b border-wire">
	<div class="flex items-center justify-between gap-3 flex-wrap py-1.5">
		<!-- Back to the chooser -->
		<a href="/" class="inline-flex items-center gap-1 py-1.5 text-[11px] uppercase tracking-[0.12em] text-faint hover:text-fg transition-colors"
			style="font-family: var(--font-mono)">
			<span aria-hidden="true">‹</span> {fr ? 'Accueil' : 'Home'}
		</a>

		<!-- Section tabs -->
		<nav class="flex items-center gap-1">
			{#each tabs as tab (tab.seg)}
				<a href="/{data.competition.slug}/{tab.seg}"
					class="px-2 py-1.5 text-sm font-medium transition-colors {section === tab.seg ? 'text-accent' : 'text-muted hover:text-fg'}">
					{tab.label}
				</a>
			{/each}
		</nav>
	</div>
</div>

{@render children()}
