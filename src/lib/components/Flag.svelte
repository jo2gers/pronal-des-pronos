<script lang="ts">
	// Flag thumbnail. Renders the flag in a 3:2 rectangular slot — all flags
	// share the same shape regardless of native aspect (Switzerland's square,
	// UK's 1:2, etc. get centre-cropped via object-cover for visual consistency).
	//
	// `size` is the slot HEIGHT in px. Width = size × 1.5.
	//
	// Usage:
	//   <Flag code="FR" size={48} alt="France" />

	type Props = {
		code: string | null | undefined;
		size?: number; // slot height in px
		alt?: string;
		class?: string;
	};

	let { code, size = 20, alt = '', class: extra = '' }: Props = $props();

	const width = $derived(Math.round(size * 1.5));

	// Corner radius scales with flag size — keeps the rounded-sticker look
	// consistent from a 16px schedule chip up to an 88px detail-page hero.
	const radius = $derived(Math.max(2, Math.round(size * 0.12)));

	// Ring is too loud at schedule-chip density (size <= 28); skip it there.
	const ringClass = $derived(size >= 32 ? 'ring-1 ring-fg/15' : '');

	// flagcdn ships sizes w20, w40, w80, w160 — pick the next-larger for crisp DPR
	const cdnWidth = $derived(width <= 40 ? 80 : width <= 80 ? 160 : 320);
	const src = $derived(code ? `https://flagcdn.com/w${cdnWidth}/${code.toLowerCase()}.png` : '');
</script>

<!-- Padding-ratio wrapper (not CSS aspect-ratio: iOS Safari computes a zero
     height for aspect-ratio + height:auto images inside flex columns). The
     spacer's padding-bottom is a % of the wrapper width, so the slot is always
     3:2 — and max-width:100% lets a tight column scale the whole flag down
     proportionally instead of cropping it into a portrait sliver. -->
<!-- width:100% capped at the slot size (not a fixed width): a fixed width
     floors the wrapper's min-content, which propagates up through flex/grid
     auto-sizing and pushes whole cards past the viewport edge on phones.
     With width:auto-ish sizing the wrapper contributes ~0 to intrinsic
     widths, fills its column, and the max-width cap sets the actual size. -->
<span class="relative block shrink-0 overflow-hidden {src ? '' : 'bg-raised'} {ringClass} {extra}"
	style="width: 100%; max-width: {width}px; border-radius: {radius}px;">
	<span class="block" style="padding-bottom: 66.667%" aria-hidden="true"></span>
	{#if src}
		<img {src} {alt} class="absolute inset-0 w-full h-full object-cover" />
	{/if}
</span>
