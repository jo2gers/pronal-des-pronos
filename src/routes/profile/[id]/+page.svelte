<script lang="ts">
	import { isoToFlag } from '$lib/utils';
	import { WC2026_TEAMS, STAGE_LABELS } from '$lib/wc2026';

	let { data } = $props();

	function teamFlag(teamName: string | undefined) {
		if (!teamName) return '';
		const t = WC2026_TEAMS.find((t) => t.name === teamName);
		return t ? isoToFlag(t.flag) : '';
	}

	function formatDate(dt: string) {
		return new Date(dt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
	}

	function pointsColor(pts: number | null) {
		if (pts === null) return 'text-faint';
		if (pts >= 3) return 'text-accent font-bold';
		if (pts > 0) return 'text-fg';
		return 'text-muted';
	}
</script>

<div class="max-w-2xl mx-auto space-y-6">
	<!-- Profile header -->
	<div class="rounded-xl bg-panel border border-wire p-6">
		<div class="flex items-center gap-4">
			{#if data.profile.avatar_url}
				<img src={data.profile.avatar_url} alt="" class="w-16 h-16 rounded-full object-cover shrink-0" />
			{:else}
				<div class="w-16 h-16 rounded-full bg-raised flex items-center justify-center text-2xl font-bold text-muted shrink-0">
					{(data.profile.display_name ?? data.profile.username ?? '?')[0]?.toUpperCase()}
				</div>
			{/if}
			<div class="flex-1 min-w-0">
				<h1 class="text-xl font-bold text-fg truncate">
					{data.profile.display_name ?? data.profile.username}
				</h1>
				<p class="text-sm text-muted">@{data.profile.username}</p>
				{#if data.profile.favorite_team}
					<p class="text-sm text-faint mt-1">
						Équipe : {teamFlag(data.profile.favorite_team)} {data.profile.favorite_team}
					</p>
				{/if}
			</div>
			{#if data.isOwnProfile}
				<a href="/profile" class="text-xs text-accent hover:text-accent-hi shrink-0">
					Modifier →
				</a>
			{/if}
		</div>

		<!-- Stats bar -->
		<div class="flex divide-x divide-wire mt-5 pt-5 border-t border-wire">
			<div class="flex-1 text-center">
				<p class="text-2xl font-bold text-accent tabular-nums">{data.totalPoints.toFixed(1)}</p>
				<p class="text-xs text-muted mt-1 uppercase tracking-wide">Points</p>
			</div>
			<div class="flex-1 text-center">
				<p class="text-2xl font-bold text-fg tabular-nums">{data.pronostics.length}</p>
				<p class="text-xs text-muted mt-1 uppercase tracking-wide">Pronos</p>
			</div>
			<div class="flex-1 text-center">
				<p class="text-2xl font-bold text-fg tabular-nums">{data.exactScores}</p>
				<p class="text-xs text-muted mt-1 uppercase tracking-wide">Scores exacts</p>
			</div>
		</div>
	</div>

	<!-- Pronostics history -->
	<div>
		<h2 class="text-lg font-bold text-fg mb-3">Pronostics</h2>

		{#if data.pronostics.length === 0}
			<div class="rounded-xl bg-panel border border-wire px-6 py-10 text-center">
				<p class="text-muted">Aucun pronostic calculé pour l'instant.</p>
				<p class="text-faint text-sm mt-1">Les pronos apparaissent après la fin des matchs.</p>
			</div>
		{:else}
			<div class="rounded-xl bg-panel border border-wire overflow-hidden">
				<table class="w-full">
					<thead>
						<tr class="border-b border-wire">
							<th class="px-4 py-3 text-left text-xs text-faint uppercase tracking-wider font-semibold">Match</th>
							<th class="px-4 py-3 text-center text-xs text-faint uppercase tracking-wider font-semibold hidden sm:table-cell">Résultat</th>
							<th class="px-4 py-3 text-center text-xs text-faint uppercase tracking-wider font-semibold">Prono</th>
							<th class="px-4 py-3 text-right text-xs text-faint uppercase tracking-wider font-semibold">Pts</th>
						</tr>
					</thead>
					<tbody>
						{#each data.pronostics as p}
							{@const match = p.match as any}
							<tr class="border-b border-wire/40 last:border-0 hover:bg-raised/30 transition-colors">
								<td class="px-4 py-3">
									<div class="flex items-center gap-1.5 text-sm">
										<span>{isoToFlag(match?.home_flag)}</span>
										<span class="font-medium text-fg hidden sm:inline">{match?.home_team}</span>
										<span class="text-faint mx-0.5">–</span>
										<span class="font-medium text-fg hidden sm:inline">{match?.away_team}</span>
										<span>{isoToFlag(match?.away_flag)}</span>
									</div>
									<p class="text-xs text-faint mt-0.5">{formatDate(match?.match_datetime)}</p>
								</td>
								<td class="px-4 py-3 text-center text-sm tabular-nums text-muted hidden sm:table-cell">
									{match?.home_score ?? '?'}–{match?.away_score ?? '?'}
								</td>
								<td class="px-4 py-3 text-center text-sm tabular-nums font-medium text-fg">
									{p.predicted_home}–{p.predicted_away}
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
	</div>
</div>
