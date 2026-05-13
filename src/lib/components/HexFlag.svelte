<script lang="ts">
	// Flag thumbnail. Renders the flag in a 3:2 rectangular slot (matches
	// most national flag ratios — France, Mexico, Brazil etc. fill perfectly).
	// Outlier ratios (Switzerland 1:1, UK 1:2) are object-contained so no
	// crop, with thin transparent letterboxing.
	//
	// `size` is the slot HEIGHT in px. Width = size × 1.5.
	//
	// Usage:
	//   <HexFlag code="FR" size={48} alt="France" />

	type Props = {
		code: string | null | undefined;
		size?: number; // slot height in px
		alt?: string;
		class?: string;
	};

	let { code, size = 20, alt = '', class: extra = '' }: Props = $props();

	const width = $derived(Math.round(size * 1.5));

	// flagcdn ships sizes w20, w40, w80, w160 — pick the next-larger for crisp DPR
	const cdnWidth = $derived(width <= 40 ? 80 : width <= 80 ? 160 : 320);
	const src = $derived(code ? `https://flagcdn.com/w${cdnWidth}/${code.toLowerCase()}.png` : '');
</script>

{#if src}
	<img {src} {alt} class="object-contain shrink-0 rounded-sm {extra}"
		style="width: {width}px; height: {size}px;" />
{:else}
	<span class="shrink-0 bg-raised rounded-sm {extra}"
		style="width: {width}px; height: {size}px;"></span>
{/if}
