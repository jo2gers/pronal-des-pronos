<script lang="ts">
	// Horizontal filter carousel: a strip of pill tabs (~3 visible on phones)
	// with chevron arrows on both sides. Arrows page the strip and hide when
	// everything already fits (desktop). Swipe still works between arrows.
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
		const ro = new ResizeObserver(updateArrows);
		ro.observe(el);
		return () => ro.disconnect();
	});

	function page(dir: 1 | -1) {
		scroller?.scrollBy({ left: dir * scroller.clientWidth * 0.7, behavior: 'smooth' });
	}

	function pick(id: string, e: MouseEvent) {
		onpick(id);
		(e.currentTarget as HTMLElement).scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
	}

	const btnPad = $derived(compact ? 'px-3 py-1 text-xs' : 'px-4 py-1.5 text-sm');
</script>

<div class="flex items-center gap-1.5 min-w-0">
	{#if overflowing}
		<button type="button" onclick={() => page(-1)} disabled={atStart}
			aria-label="◀"
			class="shrink-0 w-7 h-7 rounded-lg bg-raised border border-wire flex items-center justify-center
				text-muted hover:text-fg disabled:opacity-25 transition-all cursor-pointer">
			<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" aria-hidden="true">
				<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
			</svg>
		</button>
	{/if}

	<div bind:this={scroller} onscroll={updateArrows}
		class="overflow-x-auto min-w-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
		<div class="flex gap-1 rounded-lg bg-raised border border-wire p-1 w-max">
			{#each items as it (it.id)}
				<button type="button" onclick={(e) => pick(it.id, e)}
					class="rounded {btnPad} font-semibold transition-colors cursor-pointer whitespace-nowrap max-w-[11rem] truncate
						{active === it.id ? 'bg-panel text-fg shadow-sm' : 'text-faint hover:text-muted'}">
					{it.label}
				</button>
			{/each}
		</div>
	</div>

	{#if overflowing}
		<button type="button" onclick={() => page(1)} disabled={atEnd}
			aria-label="▶"
			class="shrink-0 w-7 h-7 rounded-lg bg-raised border border-wire flex items-center justify-center
				text-muted hover:text-fg disabled:opacity-25 transition-all cursor-pointer">
			<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" aria-hidden="true">
				<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
			</svg>
		</button>
	{/if}
</div>
