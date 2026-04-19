<script lang="ts">
	import { enhance } from '$app/forms';

	let { form } = $props();
	let loading = $state(false);
</script>

<div class="mx-auto max-w-md mt-16">
	<div class="rounded-xl bg-gray-900 border border-gray-800 p-8">
		<h1 class="text-2xl font-bold text-yellow-400 mb-2">Créer un compte</h1>
		<p class="text-gray-400 text-sm mb-6">Rejoins la compétition !</p>

		{#if form?.error}
			<div class="mb-4 rounded bg-red-900/50 border border-red-700 px-4 py-3 text-sm text-red-300">
				{form.error}
			</div>
		{/if}

		<form method="POST" use:enhance={() => {
			loading = true;
			return async ({ update }) => { loading = false; await update(); };
		}} class="space-y-4">
			<div>
				<label for="username" class="block text-sm text-gray-300 mb-1">Nom d'utilisateur</label>
				<input
					id="username" name="username" type="text" required minlength="3" maxlength="30"
					class="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white placeholder-gray-500 focus:border-green-500 focus:outline-none"
					placeholder="mon_pseudo"
					value={form?.username ?? ''}
				/>
			</div>
			<div>
				<label for="email" class="block text-sm text-gray-300 mb-1">Email</label>
				<input
					id="email" name="email" type="email" required
					class="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white placeholder-gray-500 focus:border-green-500 focus:outline-none"
					placeholder="toi@exemple.com"
					value={form?.email ?? ''}
				/>
			</div>
			<div>
				<label for="password" class="block text-sm text-gray-300 mb-1">Mot de passe</label>
				<input
					id="password" name="password" type="password" required minlength="6"
					class="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white placeholder-gray-500 focus:border-green-500 focus:outline-none"
					placeholder="••••••••"
				/>
			</div>
			<button
				type="submit" disabled={loading}
				class="w-full rounded-lg bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 px-4 py-2.5 font-bold text-black transition-colors"
			>
				{loading ? 'Création...' : 'Créer mon compte'}
			</button>
		</form>

		<p class="mt-6 text-center text-sm text-gray-400">
			Déjà un compte ?
			<a href="/auth/login" class="text-green-400 hover:text-green-300">Se connecter</a>
		</p>
	</div>
</div>
