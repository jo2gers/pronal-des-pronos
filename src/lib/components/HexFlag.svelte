<script lang="ts">
	// Flag thumbnail. Shows the country flag at its natural aspect ratio
	// (no cropping, no distortion) inside a square slot, with subtle rounded
	// corners. Wide flags (3:2, 10:19) sit centred with transparent letterboxing.
	//
	// Usage:
	//   <HexFlag code="FR" size={24} alt="France" />

	type Props = {
		code: string | null | undefined;
		size?: number; // square slot edge in px
		alt?: string;
		class?: string;
	};

	let { code, size = 20, alt = '', class: extra = '' }: Props = $props();

	// flagcdn ships sizes w20, w40, w80, w160 — pick the next-larger for crisp DPR
	const cdnWidth = $derived(size <= 20 ? 40 : size <= 40 ? 80 : 160);
	const src = $derived(code ? `https://flagcdn.com/w${cdnWidth}/${code.toLowerCase()}.png` : '');
</script>

{#if src}
	<img {src} {alt} class="object-contain shrink-0 rounded-sm {extra}"
		style="width: {size}px; height: {size}px;" />
{:else}
	<span class="shrink-0 bg-raised rounded-sm {extra}"
		style="width: {size}px; height: {size}px;"></span>
{/if}
