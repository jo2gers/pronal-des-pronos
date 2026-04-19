<script lang="ts">
	let { data } = $props();
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold text-white">Mes groupes</h1>
		<a href="/groups/new"
			class="rounded-lg bg-yellow-500 hover:bg-yellow-400 px-4 py-2 text-sm font-bold text-black transition-colors">
			+ Créer un groupe
		</a>
	</div>

	{#if data.groups.length === 0}
		<div class="rounded-xl bg-gray-900 border border-gray-800 p-8 text-center">
			<p class="text-gray-400 mb-4">Tu n'appartiens à aucun groupe pour l'instant.</p>
			<p class="text-sm text-gray-500">Crée un groupe ou rejoins-en un avec un code d'invitation.</p>
		</div>
	{:else}
		<div class="grid gap-4 sm:grid-cols-2">
			{#each data.groups as group}
				<a href="/groups/{group.id}"
					class="rounded-xl bg-gray-900 border border-gray-800 hover:border-green-700 p-5 transition-colors block">
					<div class="flex items-start justify-between mb-2">
						<h3 class="font-semibold text-white text-lg">{group.name}</h3>
						{#if group.role === 'admin'}
							<span class="text-xs bg-yellow-500/20 text-yellow-400 rounded px-2 py-0.5">Admin</span>
						{/if}
					</div>
					{#if group.description}
						<p class="text-sm text-gray-400 mb-3 line-clamp-2">{group.description}</p>
					{/if}
					<p class="text-xs text-gray-500">Code : <span class="font-mono text-gray-300">{group.invite_code}</span></p>
				</a>
			{/each}
		</div>
	{/if}
</div>
