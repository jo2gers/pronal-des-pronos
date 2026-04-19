<script lang="ts">
	import { enhance } from '$app/forms';
	import { WC2026_TEAMS, COUNTRIES } from '$lib/wc2026';
	import { isoToFlag } from '$lib/utils';

	let { data, form } = $props();
	let loadingProfile = $state(false);
	let loadingAvatar = $state(false);
</script>

<div class="max-w-lg mx-auto space-y-6">
	<h1 class="text-2xl font-bold text-white">Mon profil</h1>

	{#if form?.error}
		<div class="rounded bg-red-900/50 border border-red-700 px-4 py-3 text-sm text-red-300">
			{form.error}
		</div>
	{/if}
	{#if form?.success}
		<div class="rounded bg-green-900/50 border border-green-700 px-4 py-3 text-sm text-green-300">
			Profil mis à jour !
		</div>
	{/if}

	<!-- Avatar -->
	<div class="rounded-xl bg-gray-900 border border-gray-800 p-6">
		<h2 class="text-lg font-semibold text-white mb-4">Photo de profil</h2>
		<div class="flex items-center gap-4 mb-4">
			{#if data.profile?.avatar_url}
				<img src={data.profile.avatar_url} alt="Avatar" class="w-16 h-16 rounded-full object-cover" />
			{:else}
				<div class="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center text-2xl">
					👤
				</div>
			{/if}
			<p class="text-sm text-gray-400">Format JPG ou PNG, max 2MB</p>
		</div>
		<form method="POST" action="?/avatar" enctype="multipart/form-data" use:enhance={() => {
			loadingAvatar = true;
			return async ({ update }) => { loadingAvatar = false; await update(); };
		}}>
			<div class="flex gap-2">
				<input
					name="avatar" type="file" accept="image/*"
					class="flex-1 text-sm text-gray-300 file:mr-3 file:rounded file:bg-gray-700 file:border-0 file:text-white file:px-3 file:py-1.5 file:cursor-pointer"
				/>
				<button type="submit" disabled={loadingAvatar}
					class="rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-50 px-4 py-1.5 text-sm text-white transition-colors">
					{loadingAvatar ? '...' : 'Uploader'}
				</button>
			</div>
		</form>
	</div>

	<!-- Profile info -->
	<div class="rounded-xl bg-gray-900 border border-gray-800 p-6">
		<h2 class="text-lg font-semibold text-white mb-4">Informations</h2>
		<form method="POST" action="?/update" use:enhance={() => {
			loadingProfile = true;
			return async ({ update }) => { loadingProfile = false; await update(); };
		}} class="space-y-4">
			<div>
				<label for="display_name" class="block text-sm text-gray-300 mb-1">Nom affiché</label>
				<input
					id="display_name" name="display_name" type="text" maxlength="50"
					class="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white placeholder-gray-500 focus:border-green-500 focus:outline-none"
					value={data.profile?.display_name ?? ''}
					placeholder="Ton prénom ou surnom"
				/>
			</div>
			<div>
				<label for="favorite_team" class="block text-sm text-gray-300 mb-1">Équipe favorite</label>
				<select id="favorite_team" name="favorite_team"
					class="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white focus:border-green-500 focus:outline-none">
					<option value="">Aucune préférence</option>
					{#each WC2026_TEAMS as team}
						<option value={team.name} selected={data.profile?.favorite_team === team.name}>
							{isoToFlag(team.flag)} {team.name}
						</option>
					{/each}
				</select>
			</div>
			<div>
				<label for="country" class="block text-sm text-gray-300 mb-1">Pays</label>
				<select id="country" name="country"
					class="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white focus:border-green-500 focus:outline-none">
					<option value="">Non renseigné</option>
					{#each COUNTRIES as c}
						<option value={c} selected={data.profile?.country === c}>{c}</option>
					{/each}
				</select>
			</div>
			<div class="pt-2">
				<p class="text-xs text-gray-500 mb-2">Nom d'utilisateur : <span class="text-gray-300">@{data.profile?.username}</span></p>
				<button type="submit" disabled={loadingProfile}
					class="w-full rounded-lg bg-green-700 hover:bg-green-600 disabled:opacity-50 px-4 py-2.5 font-semibold text-white transition-colors">
					{loadingProfile ? 'Enregistrement...' : 'Enregistrer'}
				</button>
			</div>
		</form>
	</div>
</div>
