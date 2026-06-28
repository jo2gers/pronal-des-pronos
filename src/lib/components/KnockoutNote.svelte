<script lang="ts">
	// Inline reminder that knockout matches are scored on the 90-minute result.
	// Shown where users actually predict (home page + knockout match pages),
	// translated, instead of a site-wide banner.
	import { t } from '$lib/i18n.svelte';
</script>

<div class="flex items-start gap-2 rounded-lg border border-wire bg-panel px-3 py-2 text-xs text-muted">
	<svg class="w-4 h-4 mt-px shrink-0 text-faint" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
		<path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
	</svg>
	<span class="leading-snug">{t('banner_knockout_90min')}</span>
</div>
