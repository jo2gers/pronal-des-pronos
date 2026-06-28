<script lang="ts">
	import { invalidateAll, goto } from '$app/navigation';
	import { page } from '$app/state';
	import { groupByDay, daysUntilMatch } from '$lib/utils';
	import { STAGE_LABELS_FR, STAGE_LABELS_EN } from '$lib/wc2026';
	import { t, getLang } from '$lib/i18n.svelte';
	import MatchPickRow from '$lib/components/MatchPickRow.svelte';

	let { data } = $props();

	// Auto-refresh every 30s while a match is live
	$effect(() => {
		const hasLive = (data.matches ?? []).some(m => m.status === 'live');
		if (!hasLive) return;
		const interval = setInterval(() => invalidateAll(), 30_000);
		return () => clearInterval(interval);
	});

	// Tab lives in the URL (?tab=ended) so it survives navigation to a match
	// detail and back via history.back().
	const tab = $derived<'upcoming' | 'ended'>(
		page.url.searchParams.get('tab') === 'ended' ? 'ended' : 'upcoming'
	);

	function setTab(next: 'upcoming' | 'ended') {
		const url = new URL(page.url);
		if (next === 'upcoming') url.searchParams.delete('tab');
		else                     url.searchParams.set('tab', next);
		goto(url, { replaceState: true, keepFocus: true, noScroll: true });
	}

	// View mode: by date (default, day buckets) or by group (Groupe A → L
	// sections, all matches of each group on one scrollable page). URL-persisted
	// via ?view=groups.
	const view = $derived<'date' | 'groups'>(
		page.url.searchParams.get('view') === 'groups' ? 'groups' : 'date'
	);

	function setView(next: 'date' | 'groups') {
		const url = new URL(page.url);
		if (next === 'date') url.searchParams.delete('view');
		else                 url.searchParams.set('view', next);
		goto(url, { replaceState: true, keepFocus: true, noScroll: true });
	}

	// Date view: filter to the active tab, then bucket by calendar day.
	// Ended-tab buckets are reversed so the most recent day appears first.
	const dayBuckets = $derived.by(() => {
		const filtered = (data.matches ?? []).filter((m) =>
			tab === 'ended' ? m.status === 'finished' : m.status !== 'finished'
		);
		filtered.sort((a, b) => {
			const da = new Date(a.match_datetime).getTime();
			const db = new Date(b.match_datetime).getTime();
			return tab === 'ended' ? db - da : da - db;
		});
		return groupByDay(filtered, getLang());
	});

	// Group view: ALL matches (played or not — no tab filter), one section per
	// group A → L, knockout stages appended after under their stage labels.
	const groupBuckets = $derived.by(() => {
		const matches = [...(data.matches ?? [])].sort(
			(a, b) => new Date(a.match_datetime).getTime() - new Date(b.match_datetime).getTime()
		);
		const buckets: { key: string; label: string; items: typeof matches }[] = [];

		const labels = [...new Set(matches.map((m) => m.group_label).filter(Boolean))].sort() as string[];
		for (const g of labels) {
			buckets.push({
				key: `g-${g}`,
				label: `${t('card_group')} ${g}`,
				items: matches.filter((m) => m.group_label === g)
			});
		}

		const stageOrder = ['round_of_32', 'round_of_16', 'quarters', 'semis', 'third', 'final'];
		const stageLabels = getLang() === 'fr' ? STAGE_LABELS_FR : STAGE_LABELS_EN;
		for (const s of stageOrder) {
			const items = matches.filter((m) => m.stage === s);
			if (items.length > 0) {
				buckets.push({ key: `s-${s}`, label: stageLabels[s] ?? s, items });
			}
		}
		return buckets;
	});

	const buckets = $derived(view === 'groups' ? groupBuckets : dayBuckets);
</script>

<div class="space-y-8">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold text-fg" style="font-family: var(--font-display); letter-spacing: 0.02em">
			{t('nav_matches')}
		</h1>
		{#if !data.user}
			<a href="/auth/login" class="text-sm text-accent hover:text-accent-hi transition-colors">
				{t('login_to_pick')}
			</a>
		{/if}
	</div>

	<!-- View toggle + tabs + standings shortcut -->
	<div class="flex flex-wrap items-center gap-2">
		<!-- Date / Group view toggle -->
		<div class="flex gap-1 rounded-lg bg-raised border border-wire p-1 w-fit">
			<button
				onclick={() => setView('date')}
				class="rounded px-4 py-1.5 text-sm font-medium transition-colors cursor-pointer {view === 'date' ? 'bg-panel text-fg shadow-sm' : 'text-muted hover:text-fg'}">
				{t('matches_view_date')}
			</button>
			<button
				onclick={() => setView('groups')}
				class="rounded px-4 py-1.5 text-sm font-medium transition-colors cursor-pointer {view === 'groups' ? 'bg-panel text-fg shadow-sm' : 'text-muted hover:text-fg'}">
				{t('matches_view_groups')}
			</button>
		</div>

		<!-- Upcoming / Ended tabs — date view only; the group view always shows
		     every match of each group -->
		{#if view === 'date'}
			<div class="flex gap-1 rounded-lg bg-raised border border-wire p-1 w-fit">
				<button
					onclick={() => setTab('upcoming')}
					class="rounded px-4 py-1.5 text-sm font-medium transition-colors cursor-pointer {tab === 'upcoming' ? 'bg-panel text-fg shadow-sm' : 'text-muted hover:text-fg'}">
					{t('upcoming')}
				</button>
				<button
					onclick={() => setTab('ended')}
					class="rounded px-4 py-1.5 text-sm font-medium transition-colors cursor-pointer {tab === 'ended' ? 'bg-panel text-fg shadow-sm' : 'text-muted hover:text-fg'}">
					{t('ended')}
				</button>
			</div>
		{/if}

		<a href="/bracket"
			class="ml-auto inline-flex items-center gap-1 text-sm text-muted hover:text-accent transition-colors">
			{t('nav_bracket')}
			<span aria-hidden="true">→</span>
		</a>
		<a href="/schedule"
			class="inline-flex items-center gap-1 text-sm text-muted hover:text-accent transition-colors">
			{t('matches_standings_link')}
			<span aria-hidden="true">→</span>
		</a>
	</div>

	{#if buckets.length === 0}
		<div class="rounded-xl bg-panel border border-wire px-6 py-10 text-center">
			<p class="text-muted">{tab === 'ended' ? t('no_ended') : t('no_upcoming')}</p>
			<p class="text-sm text-faint mt-2">{tab === 'ended' ? t('no_ended_hint') : ''}</p>
		</div>
	{:else}
		<div class="space-y-6">
			{#each buckets as bucket (bucket.key)}
				{@const countdown = view === 'date' ? daysUntilMatch(bucket.items[0].match_datetime, getLang()) : null}
				<section>
					<div class="flex items-center gap-3 mb-2 px-1">
						<span class="flex-1 h-px bg-wire"></span>
						<span class="inline-flex items-center gap-2 text-[11px] uppercase tracking-widest">
							<span class="text-faint">{bucket.label}</span>
							{#if countdown}
								<span class="text-wire-hi">·</span>
								<span class="text-accent font-semibold tabular-nums">{countdown}</span>
							{/if}
						</span>
						<span class="flex-1 h-px bg-wire"></span>
					</div>
					<div class="-mx-4 sm:mx-0 divide-y divide-wire/60 border-y border-wire sm:border sm:rounded-xl sm:bg-panel/40 overflow-hidden">
						{#each bucket.items as match (match.id)}
							<MatchPickRow {match}
								existingProno={data.pronosticsMap[match.id] ?? null}
								loggedIn={!!data.user} />
						{/each}
					</div>
				</section>
			{/each}
		</div>
	{/if}
</div>
