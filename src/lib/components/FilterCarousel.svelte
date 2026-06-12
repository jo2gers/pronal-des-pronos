<script lang="ts">
	// Filter chips carousel.
	//
	// Standalone rounded chips (no boxed strip): the active one is solid
	// accent, inactive ones a quiet outline. When the row overflows, ghost
	// chevrons overlay each end on a canvas-fade — chips slide underneath,
	// signalling continuation instead of looking accidentally cut. Arrows
	// hide entirely at their end of travel. Scroll-snap keeps chips landing
	// cleanly after a page, and the active chip auto-centers on mount.
	type Item = { id: string; label: string };
	type Props = {
		items: Item[];
		active: string;
		onpick: (id: string) => void;
		compact?: boolean;
	};
	let { items, active, onpick, compact = false }: Props = $props();

	let scroller = $state<HTMLDivElement | null>(null);
	let atStart = $state(true);
	let atEnd = $state(true);
	let overflowing = $state(false);

	function updateArrows() {
		const el = scroller;
		if (!el) return;
		overflowing = el.scrollWidth > el.clientWidth + 4;
		atStart = el.scrollLeft <= 2;
		atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2;
	}

	$effect(() => {
		updateArrows();
		const el = scroller;
		if (!el) return;
		// Bring the active chip into view on first paint (e.g. deep link state)
		const activeChip = el.querySelector<HTMLElement>('[data-active="true"]');
		if (activeChip) el.scrollLeft = centerTarget(el, activeChip);
		updateArrows();
		const ro = new ResizeObserver(updateArrows);
		ro.observe(el);
		return () => ro.disconnect();
	});

	function centerTarget(el: HTMLElement, chip: HTMLElement) {
		const max = el.scrollWidth - el.clientWidth;
		return Math.max(0, Math.min(max, chip.offsetLeft - (el.clientWidth - chip.offsetWidth) / 2));
	}

	// Manual rAF animation: native behavior:'smooth' is ignored by several
	// engines (older iOS Safari among them) — ease-out cubic works everywhere.
	// Watchdog: rAF is suspended in hidden/backgrounded documents, so if no
	// frame lands quickly we jump straight to the target instead of stalling.
	let rafId = 0;
	let watchdog: ReturnType<typeof setTimeout> | null = null;
	function animateTo(el: HTMLElement, target: number, ms = 280) {
		cancelAnimationFrame(rafId);
		if (watchdog) clearTimeout(watchdog);
		const start = el.scrollLeft;
		const delta = target - start;
		if (delta === 0) return;
		if (typeof document !== 'undefined' && document.hidden) {
			el.scrollLeft = target;
			updateArrows();
			return;
		}
		const t0 = performance.now();
		let stepped = false;
		const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
		const step = (now: number) => {
			stepped = true;
			const p = Math.min(1, (now - t0) / ms);
			el.scrollLeft = start + delta * easeOut(p);
			updateArrows();
			if (p < 1) rafId = requestAnimationFrame(step);
		};
		rafId = requestAnimationFrame(step);
		watchdog = setTimeout(() => {
			if (!stepped) { cancelAnimationFrame(rafId); el.scrollLeft = target; updateArrows(); }
		}, 150);
	}

	function page(dir: 1 | -1) {
		const el = scroller;
		if (!el) return;
		const max = el.scrollWidth - el.clientWidth;
		const target = Math.max(0, Math.min(max, el.scrollLeft + dir * el.clientWidth * 0.65));
		animateTo(el, target);
	}

	function pick(id: string, e: MouseEvent) {
		onpick(id);
		const el = scroller;
		if (el) animateTo(el, centerTarget(el, e.currentTarget as HTMLElement));
	}

	const chipPad = $derived(compact ? 'px-3.5 py-1 text-xs' : 'px-4 py-1.5 text-sm');
</script>

<div class="relative min-w-0">
	<!-- No scroll-snap and no scroll-smooth here: combining either with
	     programmatic smooth scrolls makes Chromium snap back to position 0.
	     The JS calls pass behavior:'smooth' explicitly, which is enough. -->
	<div bind:this={scroller} onscroll={updateArrows}
		class="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
		<div class="flex gap-2 w-max py-0.5 {overflowing ? 'pr-8' : ''}">
			{#each items as it (it.id)}
				<button type="button" onclick={(e) => pick(it.id, e)}
					data-active={active === it.id}
					class="rounded-full {chipPad} font-semibold whitespace-nowrap max-w-[12rem] truncate transition-colors cursor-pointer {active === it.id ? 'bg-accent text-canvas' : 'border border-wire text-muted hover:text-fg hover:border-wire-hi'}">
					{it.label}
				</button>
			{/each}
		</div>
	</div>

	<!-- Ghost chevrons on canvas fades — only while there's travel left -->
	{#if overflowing && !atStart}
		<button type="button" onclick={() => page(-1)} aria-label="◀"
			class="absolute inset-y-0 left-0 w-12 flex items-center justify-start cursor-pointer
				bg-gradient-to-r from-canvas via-canvas/80 to-transparent
				text-muted hover:text-fg transition-colors">
			<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" aria-hidden="true">
				<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
			</svg>
		</button>
	{/if}
	{#if overflowing && !atEnd}
		<button type="button" onclick={() => page(1)} aria-label="▶"
			class="absolute inset-y-0 right-0 w-12 flex items-center justify-end cursor-pointer
				bg-gradient-to-l from-canvas via-canvas/80 to-transparent
				text-muted hover:text-fg transition-colors">
			<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" aria-hidden="true">
				<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
			</svg>
		</button>
	{/if}
</div>
