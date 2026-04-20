<script lang="ts">
	import { enhance } from '$app/forms';
	import { WC2026_TEAMS, COUNTRIES } from '$lib/wc2026';
	import { isoToFlag } from '$lib/utils';

	let { data, form } = $props();
	let loadingProfile = $state(false);
	let loadingAvatar = $state(false);
</script>

<div class="max-w-lg mx-auto space-y-6">
	<h1 class="text-2xl font-bold text-fg" style="font-family: var(--font-display); letter-spacing: 0.02em">Mon profil</h1>

	{#if form?.error}
		<div class="rounded bg-err/10 border border-err/30 px-4 py-3 text-sm text-err">
			{form.error}
		</div>
	{/if}
	{#if form?.success}
		<div class="rounded bg-accent-lo border border-accent/30 px-4 py-3 text-sm text-accent">
			Profil mis à jour !
		</div>
	{/if}

	<!-- Avatar -->
	<div class="rounded-xl bg-panel border border-wire p-6">
		<h2 class="text-lg font-semibold text-fg mb-4">Photo de profil</h2>
		<div class="flex items-center gap-4 mb-4">
			{#if data.profile?.avatar_url}
				<img src={data.profile.avatar_url} alt="Avatar" class="w-16 h-16 rounded-full object-cover" />
			{:else}
				<div class="w-16 h-16 rounded-full bg-raised flex items-center justify-center text-muted text-xl font-bold">
					{data.profile?.username?.[0]?.toUpperCase() ?? '?'}
				</div>
			{/if}
			<p class="text-sm text-muted">Format JPG ou PNG, max 2MB</p>
		</div>
		<form method="POST" action="?/avatar" enctype="multipart/form-data" use:enhance={() => {
			loadingAvatar = true;
			return async ({ update }) => { loadingAvatar = false; await update(); };
		}}>
			<div class="flex gap-2">
				<input
					name="avatar" type="file" accept="image/*"
					class="flex-1 text-sm text-muted file:mr-3 file:rounded file:bg-raised file:border-0 file:text-fg file:px-3 file:py-1.5 file:cursor-pointer"
				/>
				<button type="submit" disabled={loadingAvatar}
					class="rounded bg-raised hover:bg-wire disabled:opacity-50 px-4 py-1.5 text-sm text-fg transition-colors">
					{loadingAvatar ? '...' : 'Uploader'}
				</button>
			</div>
		</form>
	</div>

	<!-- Profile info -->
	<div class="rounded-xl bg-panel border border-wire p-6">
		<h2 class="text-lg font-semibold text-fg mb-4">Informations</h2>
		<form method="POST" action="?/update" use:enhance={() => {
			loadingProfile = true;
			return async ({ update }) => { loadingProfile = false; await update(); };
		}} class="space-y-4">
			<div>
				<label for="display_name" class="block text-sm text-muted mb-1">Nom affiché</label>
				<input
					id="display_name" name="display_name" type="text" maxlength="50"
					class="w-full rounded-lg bg-raised border border-wire px-3 py-2 text-fg placeholder:text-faint focus:border-accent focus:outline-none"
					value={data.profile?.display_name ?? ''}
					placeholder="Ton prénom ou surnom"
				/>
			</div>
			<div>
				<div class="flex items-center justify-between mb-1">
					<label for="favorite_team" class="block text-sm text-muted">Équipe favorite</label>
					{#if data.teamLocked}
						<span class="text-xs text-err font-medium">🔒 Verrouillé</span>
					{:else}
						<span class="text-xs text-faint">Modifiable jusqu'à 2h avant le 1er match</span>
					{/if}
				</div>
				{#if data.teamLocked}
					<div class="w-full rounded-lg bg-raised border border-wire/50 px-3 py-2 text-muted text-sm opacity-70">
						{#if data.profile?.favorite_team}
							{isoToFlag(WC2026_TEAMS.find(t => t.name === data.profile?.favorite_team)?.flag ?? '')} {data.profile.favorite_team}
						{:else}
							Aucune équipe sélectionnée
						{/if}
					</div>
					<input type="hidden" name="favorite_team" value={data.profile?.favorite_team ?? ''} />
				{:else}
					<select id="favorite_team" name="favorite_team"
						class="w-full rounded-lg bg-raised border border-wire px-3 py-2 text-fg focus:border-accent focus:outline-none">
						<option value="">Aucune préférence</option>
						{#each WC2026_TEAMS as team}
							<option value={team.name} selected={data.profile?.favorite_team === team.name}>
								{isoToFlag(team.flag)} {team.name}
							</option>
						{/each}
					</select>
				{/if}
			</div>
			<div>
				<label for="country" class="block text-sm text-muted mb-1">Pays</label>
				<select id="country" name="country"
					class="w-full rounded-lg bg-raised border border-wire px-3 py-2 text-fg focus:border-accent focus:outline-none">
					<option value="">Non renseigné</option>
					{#each COUNTRIES as c}
						<option value={c} selected={data.profile?.country === c}>{c}</option>
					{/each}
				</select>
			</div>
			<div class="pt-2">
				<p class="text-xs text-faint mb-2">Nom d'utilisateur : <span class="text-muted">@{data.profile?.username}</span></p>
				<button type="submit" disabled={loadingProfile}
					class="w-full rounded-lg bg-accent hover:bg-accent-hi disabled:opacity-50 px-4 py-2.5 font-semibold text-canvas transition-colors">
					{loadingProfile ? 'Enregistrement...' : 'Enregistrer'}
				</button>
			</div>
		</form>
	</div>
</div>
