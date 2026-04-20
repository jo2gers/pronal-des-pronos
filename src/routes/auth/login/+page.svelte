<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();
	let loading = $state(false);
</script>

<div class="mx-auto max-w-md mt-16">
	<div class="rounded-xl bg-panel border border-wire p-8">
		<h1 class="text-2xl font-bold text-accent mb-2">Connexion</h1>
		<p class="text-muted text-sm mb-6">Content de te revoir !</p>

		{#if form?.error}
			<div class="mb-4 rounded bg-err/10 border border-err/30 px-4 py-3 text-sm text-err">
				{form.error}
			</div>
		{/if}

		<form method="POST" use:enhance={() => {
			loading = true;
			return async ({ update }) => { loading = false; await update(); };
		}} class="space-y-4">
			<input type="hidden" name="next" value={form?.next ?? data.next ?? '/'} />
			<div>
				<label for="email" class="block text-sm text-muted mb-1">Email</label>
				<input
					id="email" name="email" type="email" required
					class="w-full rounded-lg bg-raised border border-wire px-3 py-2 text-fg placeholder:text-faint focus:border-accent focus:outline-none"
					placeholder="toi@exemple.com"
				/>
			</div>
			<div>
				<label for="password" class="block text-sm text-muted mb-1">Mot de passe</label>
				<input
					id="password" name="password" type="password" required
					class="w-full rounded-lg bg-raised border border-wire px-3 py-2 text-fg placeholder:text-faint focus:border-accent focus:outline-none"
					placeholder="••••••••"
				/>
			</div>
			<button
				type="submit" disabled={loading}
				class="w-full rounded-lg bg-accent hover:bg-accent-hi disabled:opacity-50 px-4 py-2.5 font-semibold text-canvas transition-colors"
			>
				{loading ? 'Connexion...' : 'Se connecter'}
			</button>
		</form>

		<p class="mt-6 text-center text-sm text-muted">
			Pas encore de compte ?
			<a href="/auth/register" class="text-accent hover:text-accent-hi">S'inscrire</a>
		</p>
	</div>
</div>
