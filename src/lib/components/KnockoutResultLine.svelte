<script lang="ts">
	// Small line shown under a knockout match's 90-minute score: the deciding
	// extra-time or penalty result + the team that advanced. Renders nothing for
	// matches settled in regulation.
	import { t } from '$lib/i18n.svelte';
	import { teamLabel } from '$lib/wc2026';
	import { knockoutOutcome } from '$lib/utils';

	let { match, class: extra = '' }: { match: any; class?: string } = $props();
	const o = $derived(knockoutOutcome(match));
	const winnerName = $derived(o ? (o.winner === 'home' ? match.home_team : match.away_team) : '');
</script>

{#if o}
	<span class="inline-flex items-center gap-1.5 text-xs tabular-nums {extra}">
		<span class="text-faint">{o.decided === 'pens' ? t('result_pens') : t('result_aet')} {o.home}<span class="mx-0.5">–</span>{o.away}</span>
		<span class="text-muted">· {teamLabel(winnerName)} {t('result_qualified')}</span>
	</span>
{/if}
