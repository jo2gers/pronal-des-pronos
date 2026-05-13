<script lang="ts">
	// Hexagonal flag thumbnail. Clip-path crops a square flag image into a
	// flat-top hexagon, so it should be used for team identification, not where
	// the full flag matters.
	//
	// Usage:
	//   <HexFlag code="FR" size={24} alt="France" />

	type Props = {
		code: string | null | undefined;
		size?: number; // square edge in px
		alt?: string;
		class?: string;
	};

	let { code, size = 20, alt = '', class: extra = '' }: Props = $props();

	// flagcdn ships sizes w20, w40, w80, w160 — pick the next-larger for crisp DPR
	const cdnWidth = $derived(size <= 20 ? 40 : size <= 40 ? 80 : 160);
	const src = $derived(code ? `https://flagcdn.com/w${cdnWidth}/${code.toLowerCase()}.png` : '');

	// Shallow-corner hexagon — 15%/85% cuts (vs. the regular 25%/75%) shrink
	// the corner triangles ~64% so more of the flag stays visible.
	const clip = 'polygon(15% 0%, 85% 0%, 100% 50%, 85% 100%, 15% 100%, 0% 50%)';
</script>

{#if src}
	<img {src} {alt} class="object-cover shrink-0 {extra}"
		style="width: {size}px; height: {size}px; clip-path: {clip}; -webkit-clip-path: {clip};" />
{:else}
	<span class="shrink-0 bg-raised {extra}"
		style="width: {size}px; height: {size}px; clip-path: {clip}; -webkit-clip-path: {clip};"></span>
{/if}
