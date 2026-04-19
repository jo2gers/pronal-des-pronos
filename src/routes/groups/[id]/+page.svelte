<script lang="ts">
	import { enhance } from '$app/forms';

	let { data } = $props();
	let copied = $state(false);

	const inviteUrl = $derived(`${typeof window !== 'undefined' ? window.location.origin : ''}/groups/join/${data.group.invite_code}`);

	function copyInvite() {
		navigator.clipboard.writeText(inviteUrl);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}
</script>

<div class="space-y-6">
	<div class="flex items-start justify-between">
		<div>
			<h1 class="text-2xl font-bold text-white">{data.group.name}</h1>
			{#if data.group.description}
				<p class="text-gray-400 text-sm mt-1">{data.group.description}</p>
			{/if}
		</div>
		<form method="POST" action="?/leave" use:enhance>
			<button type="submit" class="text-sm text-red-400 hover:text-red-300 transition-colors cursor-pointer">
				Quitter
			</button>
		</form>
	</div>

	<!-- Invite link -->
	<div class="rounded-xl bg-gray-900 border border-gray-800 p-4">
		<p class="text-sm text-gray-400 mb-2">Lien d'invitation</p>
		<div class="flex gap-2">
			<code class="flex-1 rounded bg-gray-800 px-3 py-2 text-sm text-gray-300 font-mono truncate">
				{inviteUrl}
			</code>
			<button onclick={copyInvite}
				class="rounded bg-gray-700 hover:bg-gray-600 px-3 py-2 text-sm text-white transition-colors cursor-pointer whitespace-nowrap">
				{copied ? '✓ Copié' : 'Copier'}
			</button>
		</div>
	</div>

	<!-- Scoreboard -->
	<div class="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
		<div class="px-4 py-3 border-b border-gray-800">
			<h2 class="font-semibold text-white">Classement du groupe</h2>
		</div>
		<table class="w-full">
			<thead>
				<tr class="text-xs text-gray-400 uppercase tracking-wider border-b border-gray-800">
					<th class="px-4 py-2 text-left w-10">#</th>
					<th class="px-4 py-2 text-left">Joueur</th>
					<th class="px-4 py-2 text-right">Points</th>
				</tr>
			</thead>
			<tbody>
				{#each data.scoreboard as entry, i}
					{@const isMe = (entry.profile as any)?.id === data.user.id}
					<tr class="border-b border-gray-800/50 {isMe ? 'bg-green-950/30' : 'hover:bg-gray-800/30'} transition-colors">
						<td class="px-4 py-3 text-sm text-gray-500">{i + 1}</td>
						<td class="px-4 py-3">
							<div class="flex items-center gap-2">
								<span class="{isMe ? 'text-green-400 font-semibold' : 'text-white'} text-sm">
									{(entry.profile as any)?.display_name ?? (entry.profile as any)?.username ?? '?'}
								</span>
								{#if entry.role === 'admin'}
									<span class="text-xs text-yellow-400">★</span>
								{/if}
							</div>
						</td>
						<td class="px-4 py-3 text-right font-bold text-yellow-400">{entry.points.toFixed(2)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
