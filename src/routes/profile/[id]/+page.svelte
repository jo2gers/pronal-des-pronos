<script lang="ts">
	import { WC2026_TEAMS } from '$lib/wc2026';
	import { t } from '$lib/i18n.svelte';

	let { data } = $props();

	// Returns a real flag image URL (works everywhere, no emoji rendering issues)
	function flagUrl(teamName: string | undefined, size = 40): string {
		if (!teamName) return '';
		const team = WC2026_TEAMS.find((t) => t.name === teamName);
		return team ? `https://flagcdn.com/w${size}/${team.flag.toLowerCase()}.png` : '';
	}

	function formatDate(dt: string) {
		return new Date(dt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
	}

	function pointsColor(pts: number | null) {
		if (pts === null) return 'text-faint';
		if (pts >= 3) return 'text-accent font-bold';
		if (pts > 0)  return 'text-fg font-medium';
		return 'text-muted';
	}

	function resultLabel(p: typeof data.pronostics[number]) {
		const m = p.match as any;
		if (!m || m.home_score == null) return '';
		if (p.predicted_home === m.home_score && p.predicted_away === m.away_score) return 'exact';
		const predResult = Math.sign(p.predicted_home - p.predicted_away);
		const realResult = Math.sign(m.home_score - m.away_score);
		return predResult === realResult ? 'correct' : 'wrong';
	}
</script>

<div class="max-w-2xl mx-auto space-y-6">

	<!-- Profile header card -->
	<div class="rounded-xl bg-panel border border-wire p-6">
		<div class="flex items-start gap-4">
			<!-- Avatar -->
			{#if data.profile.avatar_url}
				<img src={data.profile.avatar_url} alt=""
					class="w-16 h-16 rounded-full object-cover shrink-0" />
			{:else}
				<div class="w-16 h-16 rounded-full bg-raised border border-wire flex items-center justify-center text-2xl font-bold text-muted shrink-0">
					{(data.profile.display_name ?? data.profile.username ?? '?')[0]?.toUpperCase()}
				</div>
			{/if}

			<!-- Identity -->
			<div class="flex-1 min-w-0 pt-0.5">
				<h1 class="text-xl font-bold text-fg truncate leading-tight">
					{data.profile.display_name ?? data.profile.username}
				</h1>
				<p class="text-sm text-muted mt-0.5">@{data.profile.username}</p>
				{#if data.profile.country}
					<p class="text-sm text-faint mt-1">{data.profile.country}</p>
				{/if}
			</div>

			<!-- Edit button (own profile only) -->
			{#if data.isOwnProfile}
				<a href="/profile"
					class="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-wire hover:border-accent bg-raised hover:bg-accent-lo px-3 py-2 text-sm font-semibold text-muted hover:text-accent transition-colors">
					<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
							d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
					</svg>
					{t('profile_edit')}
				</a>
			{/if}
		</div>

		<!-- Favourite team — prominent display -->
		{#if data.profile.favorite_team}
			{@const url = flagUrl(data.profile.favorite_team, 80)}
			<div class="mt-5 pt-5 border-t border-wire flex items-center gap-4">
				{#if url}
					<img src={url} alt={data.profile.favorite_team}
						class="w-14 h-10 object-cover rounded-md shadow-sm shrink-0" />
				{/if}
				<div class="flex-1 min-w-0">
					<p class="text-[11px] text-faint uppercase tracking-widest mb-0.5">{t('fav_team')}</p>
					<p class="text-2xl font-bold text-fg leading-tight" style="font-family: var(--font-display)">
						{data.profile.favorite_team}
					</p>
				</div>
				{#if data.teamOdds != null}
					<div class="text-right shrink-0">
						<p class="text-2xl font-bold tabular-nums leading-none text-accent" style="font-family: var(--font-display)">
							{data.teamOdds.toFixed(2)}<span class="text-sm font-normal text-faint ml-0.5">×</span>
						</p>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Top scorer pick -->
		{#if data.profile.top_scorer}
			<div class="mt-3 pt-3 border-t border-wire flex items-center gap-4">
				<div class="w-14 h-10 rounded-md bg-raised border border-wire flex items-center justify-center shrink-0">
					<svg class="w-6 h-6 text-accent" fill="currentColor" viewBox="0 0 24 24">
						<path d="M12 2 8.5 5.5l1 4.5h5l1-4.5L12 2zm-7 7-2 1 1 4 4 .5L9 11 5 9zm14 0-4 2 1 4 4-.5 1-4-2-1.5zM7 14l-2 4 2 3 4-1 1-4-5-2zm10 0-5 2 1 4 4 1 2-3-2-4z"/>
					</svg>
				</div>
				<div class="flex-1 min-w-0">
					<p class="text-xs text-faint mb-0.5">{t('top_scorer_label')}</p>
					<p class="text-lg font-bold text-fg leading-tight" style="font-family: var(--font-display)">
						{data.profile.top_scorer}
					</p>
					{#if data.scorerInfo}
						<p class="text-xs text-faint mt-0.5">
							{data.scorerInfo.goals} {data.scorerInfo.goals > 1 ? t('goal_plural') : t('goal_singular')} · ×{data.scorerInfo.multiplier.toFixed(1)} {t('per_goal')}
						</p>
					{/if}
				</div>
				{#if (data.scorerBonus ?? 0) > 0}
					<div class="text-right shrink-0">
						<p class="text-xl font-bold tabular-nums leading-none" style="color: var(--color-bonus); font-family: var(--font-display)">
							+{data.scorerBonus.toFixed(2)}
						</p>
						<p class="text-[10px] text-faint mt-0.5">pts bonus</p>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Stats: hero total + inline secondary metrics -->
		<div class="mt-6 pt-5 border-t border-wire">
			<div class="flex items-end gap-5 flex-wrap">
				<!-- Hero: Total -->
				<div class="flex-none">
					<p class="text-5xl sm:text-6xl font-bold text-accent tabular-nums leading-none"
						style="font-family: var(--font-display)">
						{data.totalPoints.toFixed(1)}
					</p>
					<p class="text-xs text-faint mt-2">{t('lb_total')}</p>
				</div>

				<!-- Secondary: inline, smaller, comma-separated -->
				<dl class="flex flex-wrap items-baseline gap-x-4 gap-y-1 pb-1 text-sm flex-1 min-w-0">
					<div class="flex items-baseline gap-1.5">
						<dt class="text-faint">{t('points')}</dt>
						<dd class="font-semibold text-fg tabular-nums">{data.pronoPoints.toFixed(2)}</dd>
					</div>
					{#if data.teamBonus > 0}
						<div class="flex items-baseline gap-1.5">
							<dt class="text-faint">{t('team_bonus_short')}</dt>
							<dd class="font-semibold tabular-nums" style="color: var(--color-bonus)">+{data.teamBonus.toFixed(2)}</dd>
						</div>
					{/if}
					{#if (data.scorerBonus ?? 0) > 0}
						<div class="flex items-baseline gap-1.5">
							<dt class="text-faint">{t('profile_scorer_bonus')}</dt>
							<dd class="font-semibold tabular-nums" style="color: var(--color-bonus)">+{data.scorerBonus.toFixed(2)}</dd>
						</div>
					{/if}
					<div class="flex items-baseline gap-1.5">
						<dt class="text-faint">{t('profile_exact')}</dt>
						<dd class="font-semibold text-fg tabular-nums">{data.exactScores}</dd>
					</div>
					<div class="flex items-baseline gap-1.5">
						<dt class="text-faint">{t('profile_picks_played')}</dt>
						<dd class="font-semibold text-fg tabular-nums">{data.totalPronoCount}</dd>
					</div>
				</dl>
			</div>
		</div>
	</div>

	<!-- Pronostics history — flat section, full-bleed table on mobile -->
	<section class="pt-2">
		<header class="flex items-baseline justify-between border-t border-wire pt-5 mb-4">
			<h2 class="text-base font-semibold text-fg">{t('profile_history')}</h2>
			<span class="text-xs text-faint tabular-nums">{data.pronostics.length}</span>
		</header>

		{#if data.pronostics.length === 0}
			<div class="py-10 text-center">
				<p class="text-muted">{t('profile_empty')}</p>
				<p class="text-faint text-sm mt-1">{t('profile_empty_hint')}</p>
			</div>
		{:else}
			<div class="-mx-4 sm:mx-0 sm:rounded-xl sm:border sm:border-wire overflow-hidden">
				<table class="w-full">
					<thead>
						<tr class="border-b border-wire bg-raised/30">
							<th class="px-4 py-3 text-left text-[11px] text-faint font-semibold">{t('profile_col_match')}</th>
							<th class="px-4 py-3 text-center text-[11px] text-faint font-semibold hidden sm:table-cell">{t('profile_col_result')}</th>
							<th class="px-4 py-3 text-center text-[11px] text-faint font-semibold">{t('profile_col_pick')}</th>
							<th class="px-4 py-3 text-right text-[11px] text-faint font-semibold">Pts</th>
						</tr>
					</thead>
					<tbody>
						{#each data.pronostics as p}
							{@const match = p.match as any}
							{@const label = resultLabel(p)}
							<tr class="border-b border-wire/40 last:border-0 hover:bg-raised/30 transition-colors">
								<td class="px-4 py-3">
									<a href="/matches/{match?.id}" class="hover:text-accent transition-colors group">
										<div class="flex items-center gap-1.5 text-sm">
											<span class="hidden sm:inline font-medium text-fg group-hover:text-accent truncate max-w-[80px]">{match?.home_team}</span>
											<span class="text-faint mx-0.5">–</span>
											<span class="hidden sm:inline font-medium text-fg group-hover:text-accent truncate max-w-[80px]">{match?.away_team}</span>
											<span class="sm:hidden text-xs text-muted">{match?.home_team?.slice(0,3)} – {match?.away_team?.slice(0,3)}</span>
										</div>
										<p class="text-xs text-faint mt-0.5">{formatDate(match?.match_datetime)}</p>
									</a>
								</td>
								<td class="px-4 py-3 text-center text-sm tabular-nums text-muted hidden sm:table-cell">
									{match?.home_score ?? '?'}–{match?.away_score ?? '?'}
								</td>
								<td class="px-4 py-3 text-center">
									<span class="text-sm tabular-nums font-medium
										{label === 'exact' ? 'text-accent font-bold' : label === 'correct' ? 'text-fg' : 'text-muted'}">
										{p.predicted_home}–{p.predicted_away}
									</span>
									{#if label === 'exact'}
										<span class="block text-[10px] text-accent mt-0.5">{t('profile_result_exact')}</span>
									{:else if label === 'correct'}
										<span class="block text-[10px] text-muted mt-0.5">{t('profile_result_correct')}</span>
									{:else if label === 'wrong'}
										<span class="block text-[10px] text-faint mt-0.5">{t('profile_result_wrong')}</span>
									{/if}
								</td>
								<td class="px-4 py-3 text-right tabular-nums {pointsColor(p.points_earned)}">
									{p.points_earned?.toFixed(2) ?? '–'}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</section>
</div>
