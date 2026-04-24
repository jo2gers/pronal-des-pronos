<script lang="ts">
	import { enhance } from '$app/forms';
	import { WC2026_TEAMS } from '$lib/wc2026';

	let { data, form } = $props();
	let loading = $state(false);
	let selectedTeam = $state(form?.favorite_team ?? '');
</script>

<div class="mx-auto max-w-md mt-16">
	<div class="rounded-xl bg-panel border border-wire p-8">
		<h1 class="text-2xl font-bold text-accent mb-2">Créer un compte</h1>
		<p class="text-muted text-sm mb-6">Rejoins la compétition !</p>

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
				<label for="username" class="block text-sm text-muted mb-1">Nom d'utilisateur</label>
				<input
					id="username" name="username" type="text" required minlength="3" maxlength="30"
					class="w-full rounded-lg bg-raised border border-wire px-3 py-2 text-fg placeholder:text-faint focus:border-accent focus:outline-none"
					placeholder="mon_pseudo"
					value={form?.username ?? ''}
				/>
			</div>
			<div>
				<label for="email" class="block text-sm text-muted mb-1">Email</label>
				<input
					id="email" name="email" type="email" required
					class="w-full rounded-lg bg-raised border border-wire px-3 py-2 text-fg placeholder:text-faint focus:border-accent focus:outline-none"
					placeholder="toi@exemple.com"
					value={form?.email ?? ''}
				/>
			</div>
			<div>
				<label for="password" class="block text-sm text-muted mb-1">Mot de passe</label>
				<input
					id="password" name="password" type="password" required minlength="6"
					class="w-full rounded-lg bg-raised border border-wire px-3 py-2 text-fg placeholder:text-faint focus:border-accent focus:outline-none"
					placeholder="••••••••"
				/>
			</div>
			<div>
				<div class="flex items-center justify-between mb-2">
					<label class="block text-sm text-muted">
						Équipe favorite <span class="text-accent">*</span>
					</label>
					{#if selectedTeam && data.oddsMap[selectedTeam]}
						<span class="text-xs text-accent font-semibold tabular-nums">
							×{data.oddsMap[selectedTeam].toFixed(2)} bonus CM
						</span>
					{/if}
				</div>
				<input type="hidden" name="favorite_team" value={selectedTeam} required />
				<p class="text-[11px] text-faint mb-2">Cotes vainqueur CM · plus c'est élevé, plus tu gagnes si ton équipe gagne</p>

				<div class="grid grid-cols-2 gap-1 max-h-56 overflow-y-auto pr-0.5">
					{#each WC2026_TEAMS as team}
						{@const isSelected = selectedTeam === team.name}
						{@const odds = data.oddsMap[team.name]}
						<button type="button" onclick={() => selectedTeam = team.name}
							class="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-left border transition-colors cursor-pointer
								{isSelected
									? 'bg-accent-lo border-accent/50 text-fg'
									: 'bg-raised border-wire hover:border-wire-hi text-fg'}">
							<span class="text-sm font-medium truncate">{team.name}</span>
							{#if odds}
								<span class="text-[11px] font-semibold shrink-0 tabular-nums
									{isSelected ? 'text-accent' : 'text-faint'}">
									×{odds.toFixed(2)}
								</span>
							{/if}
						</button>
					{/each}
				</div>
				<p class="text-xs text-faint mt-1.5">Obligatoire · modifiable jusqu'à 2h avant le premier match</p>
			</div>
			<button
				type="submit" disabled={loading}
				class="w-full rounded-lg bg-accent hover:bg-accent-hi disabled:opacity-50 px-4 py-2.5 font-bold text-canvas transition-colors"
			>
				{loading ? 'Création...' : 'Créer mon compte'}
			</button>
		</form>

		<p class="mt-6 text-center text-sm text-muted">
			Déjà un compte ?
			<a href="/auth/login" class="text-accent hover:text-accent-hi">Se connecter</a>
		</p>
	</div>
</div>
