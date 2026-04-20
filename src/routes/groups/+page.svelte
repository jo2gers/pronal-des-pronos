<script lang="ts">
	let { data } = $props();
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold text-fg">Mes groupes</h1>
		<a href="/groups/new"
			class="rounded-lg bg-accent hover:bg-accent-hi px-4 py-2 text-sm font-bold text-canvas transition-colors">
			+ Créer un groupe
		</a>
	</div>

	{#if data.groups.length === 0}
		<div class="rounded-xl bg-panel border border-wire p-8 text-center">
			<p class="text-muted mb-4">Tu n'appartiens à aucun groupe pour l'instant.</p>
			<p class="text-sm text-faint">Crée un groupe ou rejoins-en un avec un code d'invitation.</p>
		</div>
	{:else}
		<div class="grid gap-4 sm:grid-cols-2">
			{#each data.groups as group}
				<a href="/groups/{group.id}"
					class="rounded-xl bg-panel border border-wire hover:border-accent p-5 transition-colors block">
					<div class="flex items-start justify-between mb-2">
						<h3 class="font-semibold text-fg text-lg">{group.name}</h3>
						{#if group.role === 'admin'}
							<span class="text-xs bg-accent-lo text-accent rounded px-2 py-0.5">Admin</span>
						{/if}
					</div>
					{#if group.description}
						<p class="text-sm text-muted mb-3 line-clamp-2">{group.description}</p>
					{/if}
					<p class="text-xs text-faint">Code : <span class="font-mono text-muted">{group.invite_code}</span></p>
				</a>
			{/each}
		</div>
	{/if}
</div>
