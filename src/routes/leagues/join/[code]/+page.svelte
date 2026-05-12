<script lang="ts">
	import { t } from '$lib/i18n.svelte';
	let showFallback = $state(false);
	$effect(() => {
		const id = setTimeout(() => (showFallback = true), 4000);
		return () => clearTimeout(id);
	});
</script>

<div class="mx-auto max-w-md mt-24 text-center px-4">
	<div class="inline-flex items-center gap-3 text-muted">
		<span class="relative flex h-2.5 w-2.5">
			<span class="absolute inline-flex h-full w-full rounded-full bg-accent opacity-60 animate-ping"></span>
			<span class="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent"></span>
		</span>
		<span class="text-sm">{t('join_redirecting')}</span>
	</div>

	{#if showFallback}
		<div class="mt-8 border-t border-wire pt-6">
			<p class="text-sm text-faint mb-3">{t('join_fallback')}</p>
			<a href="/leagues"
				class="inline-block rounded-lg border border-wire hover:border-wire-hi text-fg text-sm px-4 py-2 transition-colors">
				{t('join_open_groups')}
			</a>
		</div>
	{/if}
</div>
