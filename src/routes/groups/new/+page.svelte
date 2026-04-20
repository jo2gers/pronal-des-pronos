<script lang="ts">
	import { enhance } from '$app/forms';
	let { form } = $props();
	let loading = $state(false);
</script>

<div class="max-w-lg mx-auto">
	<h1 class="text-2xl font-bold text-fg mb-6">Créer un groupe</h1>

	{#if form?.error}
		<div class="mb-4 rounded bg-err/10 border border-err/30 px-4 py-3 text-sm text-err">
			{form.error}
		</div>
	{/if}

	<div class="rounded-xl bg-panel border border-wire p-6">
		<form method="POST" use:enhance={() => {
			loading = true;
			return async ({ update }) => { loading = false; await update(); };
		}} class="space-y-4">
			<div>
				<label for="name" class="block text-sm text-muted mb-1">Nom du groupe *</label>
				<input id="name" name="name" type="text" required maxlength="50"
					class="w-full rounded-lg bg-raised border border-wire px-3 py-2 text-fg placeholder:text-faint focus:border-accent focus:outline-none"
					placeholder="Les champions du bureau" />
			</div>
			<div>
				<label for="description" class="block text-sm text-muted mb-1">Description</label>
				<textarea id="description" name="description" rows="3" maxlength="200"
					class="w-full rounded-lg bg-raised border border-wire px-3 py-2 text-fg placeholder:text-faint focus:border-accent focus:outline-none resize-none"
					placeholder="Une description optionnelle..."></textarea>
			</div>
			<div class="flex gap-3 pt-2">
				<a href="/groups" class="flex-1 rounded-lg border border-wire px-4 py-2.5 text-center text-sm text-muted hover:border-wire-hi transition-colors">
					Annuler
				</a>
				<button type="submit" disabled={loading}
					class="flex-1 rounded-lg bg-accent hover:bg-accent-hi disabled:opacity-50 px-4 py-2.5 font-bold text-canvas transition-colors">
					{loading ? 'Création...' : 'Créer le groupe'}
				</button>
			</div>
		</form>
	</div>
</div>
