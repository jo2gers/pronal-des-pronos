<script lang="ts">
	// Tweens a number up to its target and smoothly re-tweens on change. Counts
	// from 0 on mount; jumps instantly under reduced motion. tabular-nums keeps
	// the width stable while the digits roll.
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { prefersReducedMotion } from '$lib/motion';

	let {
		value,
		decimals = 2,
		duration = 900,
		class: cls = ''
	}: { value: number; decimals?: number; duration?: number; class?: string } = $props();

	const reduced = prefersReducedMotion();
	// Start at the target on the server / under reduced motion (no count-up flash);
	// otherwise start at 0 and let the effect tween up on the client.
	const n = new Tween(reduced ? value : 0, { duration: reduced ? 0 : duration, easing: cubicOut });
	$effect(() => {
		n.set(value);
	});
</script>

<span class="tabular-nums {cls}">{n.current.toFixed(decimals)}</span>
