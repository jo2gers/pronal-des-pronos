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
			<h1 class="text-2xl font-bold text-fg">{data.group.name}</h1>
			{#if data.group.description}
				<p class="text-muted text-sm mt-1">{data.group.description}</p>
			{/if}
		</div>
		<form method="POST" action="?/leave" use:enhance>
			<button type="submit" class="text-sm text-err hover:opacity-80 transition-opacity cursor-pointer">
				Quitter
			</button>
		</form>
	</div>

	<!-- Invite link -->
	<div class="rounded-xl bg-panel border border-wire p-4">
		<p class="text-sm text-muted mb-2">Lien d'invitation</p>
		<div class="flex gap-2">
			<code class="flex-1 rounded bg-raised px-3 py-2 text-sm text-muted font-mono truncate">
				{inviteUrl}
			</code>
			<button onclick={copyInvite}
				class="rounded bg-raised hover:bg-wire px-3 py-2 text-sm text-fg transition-colors cursor-pointer whitespace-nowrap">
				{copied ? '✓ Copié' : 'Copier'}
			</button>
		</div>
	</div>

	<!-- Scoreboard -->
	<div class="rounded-xl bg-panel border border-wire overflow-hidden">
		<div class="px-4 py-3 border-b border-wire">
			<h2 class="font-semibold text-fg">Classement du groupe</h2>
		</div>
		<table class="w-full">
			<thead>
				<tr class="text-xs text-faint uppercase tracking-wider border-b border-wire">
					<th class="px-4 py-2 text-left w-10">#</th>
					<th class="px-4 py-2 text-left">Joueur</th>
					<th class="px-4 py-2 text-right">Points</th>
				</tr>
			</thead>
			<tbody>
				{#each data.scoreboard as entry, i}
					{@const isMe = (entry.profile as any)?.id === data.user.id}
					<tr class="border-b border-wire/50 {isMe ? 'bg-accent-lo/60' : 'hover:bg-raised/30'} transition-colors">
						<td class="px-4 py-3 text-sm text-faint">{i + 1}</td>
						<td class="px-4 py-3">
							<div class="flex items-center gap-2">
								<span class="{isMe ? 'text-accent font-semibold' : 'text-fg'} text-sm">
									{(entry.profile as any)?.display_name ?? (entry.profile as any)?.username ?? '?'}
								</span>
								{#if entry.role === 'admin'}
									<span class="text-xs text-accent">★</span>
								{/if}
							</div>
						</td>
						<td class="px-4 py-3 text-right font-bold text-accent">{entry.points.toFixed(2)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
