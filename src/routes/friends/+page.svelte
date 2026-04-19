<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();
	let searching = $state(false);
</script>

<div class="space-y-6">
	<h1 class="text-2xl font-bold text-white">Amis</h1>

	<!-- Search -->
	<div class="rounded-xl bg-gray-900 border border-gray-800 p-4">
		<h2 class="text-sm font-semibold text-gray-300 mb-3">Trouver un joueur</h2>
		<form method="POST" action="?/search" use:enhance={() => {
			searching = true;
			return async ({ update }) => { searching = false; await update(); };
		}} class="flex gap-2">
			<input name="query" type="text" minlength="2" required
				class="flex-1 rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white placeholder-gray-500 focus:border-green-500 focus:outline-none text-sm"
				placeholder="Rechercher par pseudo..."
				value={form?.query ?? ''} />
			<button type="submit" disabled={searching}
				class="rounded-lg bg-green-700 hover:bg-green-600 disabled:opacity-50 px-4 py-2 text-sm text-white transition-colors">
				{searching ? '...' : 'Rechercher'}
			</button>
		</form>

		{#if form?.searchError}
			<p class="mt-2 text-sm text-red-400">{form.searchError}</p>
		{/if}

		{#if form?.searchResults}
			<div class="mt-3 space-y-2">
				{#each form.searchResults as profile}
					<div class="flex items-center gap-3 rounded-lg bg-gray-800 px-3 py-2">
						<span class="text-lg">👤</span>
						<span class="flex-1 text-sm text-white">@{profile.username}</span>
						<form method="POST" action="?/request" use:enhance>
							<input type="hidden" name="addressee_id" value={profile.id} />
							<button type="submit"
								class="rounded bg-green-700 hover:bg-green-600 px-3 py-1 text-xs text-white transition-colors cursor-pointer">
								Ajouter
							</button>
						</form>
					</div>
				{:else}
					<p class="text-sm text-gray-500 mt-2">Aucun résultat.</p>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Pending received -->
	{#if data.pendingReceived.length > 0}
		<div class="rounded-xl bg-gray-900 border border-gray-800 p-4">
			<h2 class="text-sm font-semibold text-gray-300 mb-3">
				Demandes reçues ({data.pendingReceived.length})
			</h2>
			<div class="space-y-2">
				{#each data.pendingReceived as req}
					<div class="flex items-center gap-3 rounded-lg bg-gray-800 px-3 py-2">
						<span class="flex-1 text-sm text-white">@{(req.from as any)?.username}</span>
						<form method="POST" action="?/respond" use:enhance class="flex gap-2">
							<input type="hidden" name="friendship_id" value={req.id} />
							<button name="action" value="accepted" type="submit"
								class="rounded bg-green-700 hover:bg-green-600 px-3 py-1 text-xs text-white transition-colors cursor-pointer">
								Accepter
							</button>
							<button name="action" value="declined" type="submit"
								class="rounded bg-gray-700 hover:bg-gray-600 px-3 py-1 text-xs text-gray-300 transition-colors cursor-pointer">
								Refuser
							</button>
						</form>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Friends list -->
	<div class="rounded-xl bg-gray-900 border border-gray-800 p-4">
		<h2 class="text-sm font-semibold text-gray-300 mb-3">
			Mes amis ({data.accepted.length})
		</h2>
		{#if data.accepted.length === 0}
			<p class="text-sm text-gray-500">Aucun ami pour l'instant. Recherche des joueurs ci-dessus !</p>
		{:else}
			<div class="space-y-2">
				{#each data.accepted as friend}
					<div class="flex items-center gap-3 rounded-lg bg-gray-800 px-3 py-2">
						{#if (friend as any)?.avatar_url}
							<img src={(friend as any).avatar_url} alt="" class="w-8 h-8 rounded-full object-cover" />
						{:else}
							<span class="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-sm">👤</span>
						{/if}
						<div class="flex-1">
							<p class="text-sm text-white">{(friend as any)?.display_name ?? (friend as any)?.username}</p>
							<p class="text-xs text-gray-500">@{(friend as any)?.username}</p>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
