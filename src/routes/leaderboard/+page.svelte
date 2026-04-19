<script lang="ts">
	import { isoToFlag } from '$lib/utils';
	import { WC2026_TEAMS } from '$lib/wc2026';

	let { data } = $props();

	function teamFlag(teamName: string | undefined) {
		if (!teamName) return '';
		const t = WC2026_TEAMS.find((t) => t.name === teamName);
		return t ? isoToFlag(t.flag) : '';
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold text-white">🏆 Classement général</h1>
		{#if data.userRank}
			<span class="text-sm text-green-400">Ton rang : #{data.userRank}</span>
		{/if}
	</div>

	{#if data.leaderboard.length === 0}
		<div class="rounded-xl bg-gray-900 border border-gray-800 p-8 text-center text-gray-400">
			Aucun point marqué pour l'instant. Les scores apparaîtront après les premiers matchs !
		</div>
	{:else}
		<div class="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
			<table class="w-full">
				<thead>
					<tr class="border-b border-gray-800 text-xs text-gray-400 uppercase tracking-wider">
						<th class="px-4 py-3 text-left w-12">#</th>
						<th class="px-4 py-3 text-left">Joueur</th>
						<th class="px-4 py-3 text-right">Pronos</th>
						<th class="px-4 py-3 text-right">Points</th>
					</tr>
				</thead>
				<tbody>
					{#each data.leaderboard as row}
						{@const isMe = row.userId === data.currentUser?.id}
						<tr class="border-b border-gray-800/50 {isMe ? 'bg-green-950/40' : 'hover:bg-gray-800/50'} transition-colors">
							<td class="px-4 py-3 text-center">
								{#if row.rank === 1}
									<span class="text-yellow-400 font-bold">🥇</span>
								{:else if row.rank === 2}
									<span class="text-gray-300 font-bold">🥈</span>
								{:else if row.rank === 3}
									<span class="text-orange-400 font-bold">🥉</span>
								{:else}
									<span class="text-gray-500 text-sm">{row.rank}</span>
								{/if}
							</td>
							<td class="px-4 py-3">
								<div class="flex items-center gap-2">
									{#if (row.user as any)?.avatar_url}
										<img src={(row.user as any).avatar_url} alt="" class="w-7 h-7 rounded-full object-cover" />
									{:else}
										<span class="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-sm">👤</span>
									{/if}
									<span class="{isMe ? 'text-green-400 font-semibold' : 'text-white'}">
										{(row.user as any)?.display_name ?? (row.user as any)?.username ?? '?'}
									</span>
									{#if (row.user as any)?.favorite_team}
										<span class="text-sm">{teamFlag((row.user as any).favorite_team)}</span>
									{/if}
								</div>
							</td>
							<td class="px-4 py-3 text-right text-gray-400 text-sm">{row.count}</td>
							<td class="px-4 py-3 text-right font-bold text-yellow-400">{row.total.toFixed(2)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
