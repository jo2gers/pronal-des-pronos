<script lang="ts">
	import { enhance } from '$app/forms';
	import { WC2026_TEAMS, COUNTRIES } from '$lib/wc2026';
	import { t } from '$lib/i18n.svelte';

	let { data, form } = $props();
	let loadingProfile = $state(false);
	let loadingAvatar  = $state(false);
	let selectedTeam   = $state(data.profile?.favorite_team ?? '');
</script>

<div class="max-w-lg mx-auto space-y-6">

	<!-- Header with back link -->
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold text-fg" style="font-family: var(--font-display); letter-spacing: 0.02em">
			{t('profile_title')}
		</h1>
		{#if data.profile?.id}
			<a href="/profile/{data.profile.id}"
				class="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg transition-colors">
				<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
				</svg>
				{t('profile_back')}
			</a>
		{/if}
	</div>

	{#if form?.error}
		<div class="rounded bg-err/10 border border-err/30 px-4 py-3 text-sm text-err">
			{form.error}
		</div>
	{/if}
	{#if form?.success}
		<div class="rounded bg-accent-lo border border-accent/30 px-4 py-3 text-sm text-accent">
			{t('profile_updated')}
		</div>
	{/if}

	<!-- Avatar -->
	<div class="rounded-xl bg-panel border border-wire p-6">
		<h2 class="text-lg font-semibold text-fg mb-4">{t('profile_avatar_section')}</h2>
		<div class="flex items-center gap-4 mb-4">
			{#if data.profile?.avatar_url}
				<img src={data.profile.avatar_url} alt="Avatar" class="w-16 h-16 rounded-full object-cover" />
			{:else}
				<div class="w-16 h-16 rounded-full bg-raised flex items-center justify-center text-muted text-xl font-bold">
					{data.profile?.username?.[0]?.toUpperCase() ?? '?'}
				</div>
			{/if}
			<p class="text-sm text-muted">{t('profile_avatar_hint')}</p>
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
					class="rounded bg-raised hover:bg-wire disabled:opacity-50 px-4 py-1.5 text-sm text-fg transition-colors cursor-pointer">
					{loadingAvatar ? '...' : t('profile_upload')}
				</button>
			</div>
		</form>
	</div>

	<!-- Profile info -->
	<div class="rounded-xl bg-panel border border-wire p-6">
		<h2 class="text-lg font-semibold text-fg mb-4">{t('profile_info_section')}</h2>
		<form method="POST" action="?/update" use:enhance={() => {
			loadingProfile = true;
			return async ({ update }) => { loadingProfile = false; await update(); };
		}} class="space-y-4">

			<!-- Display name -->
			<div>
				<label for="display_name" class="block text-sm text-muted mb-1">{t('profile_display_name_label')}</label>
				<input
					id="display_name" name="display_name" type="text" maxlength="50"
					class="w-full rounded-lg bg-raised border border-wire px-3 py-2 text-fg placeholder:text-faint focus:border-accent focus:outline-none"
					value={data.profile?.display_name ?? ''}
					placeholder={t('profile_display_name_placeholder')}
				/>
			</div>

			<!-- Favourite team -->
			<div>
				<div class="flex items-center justify-between mb-2">
					<label class="block text-sm text-muted">{t('fav_team')}</label>
					{#if data.teamLocked}
						<span class="text-xs text-err font-medium border border-err/30 rounded px-1.5 py-0.5">Verrouillé</span>
					{:else}
						<span class="text-xs text-faint">{t('profile_edit')} jusqu'à 2h avant le 1er match</span>
					{/if}
				</div>

				{#if data.teamLocked}
					<div class="rounded-lg bg-raised border border-wire/50 px-3 py-2 text-muted text-sm opacity-70">
						{selectedTeam || 'Aucune équipe sélectionnée'}
						{#if selectedTeam && data.oddsMap[selectedTeam]}
							<span class="ml-2 text-xs text-faint">×{data.oddsMap[selectedTeam]}</span>
						{/if}
					</div>
					<input type="hidden" name="favorite_team" value={selectedTeam} />
				{:else}
					<input type="hidden" name="favorite_team" value={selectedTeam} />

					<p class="text-[11px] text-faint mb-2">{t('bonus_mult')} ×</p>

					<!-- No preference -->
					<button type="button" onclick={() => selectedTeam = ''}
						class="w-full text-left rounded-lg px-3 py-2 mb-2 text-sm border transition-colors cursor-pointer
							{selectedTeam === '' ? 'bg-accent-lo border-accent/40 text-fg' : 'bg-raised border-wire text-muted hover:border-wire-hi'}">
						{t('no_pref')}
					</button>

					<!-- Team grid -->
					<div class="grid grid-cols-2 gap-1 max-h-64 overflow-y-auto pr-0.5">
						{#each WC2026_TEAMS as team}
							{@const isSelected = selectedTeam === team.name}
							{@const mult = data.oddsMap[team.name]}
							<button type="button" onclick={() => selectedTeam = team.name}
								class="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-left border transition-colors cursor-pointer
									{isSelected
										? 'bg-accent-lo border-accent/50 text-fg'
										: 'bg-raised border-wire hover:border-wire-hi text-fg'}">
								<span class="text-sm font-medium truncate">{team.name}</span>
								{#if mult}
									<span class="text-[11px] font-semibold shrink-0 tabular-nums
										{isSelected ? 'text-accent' : 'text-faint'}">
										×{mult}
									</span>
								{/if}
							</button>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Country -->
			<div>
				<label for="country" class="block text-sm text-muted mb-1">{t('profile_country_label')}</label>
				<select id="country" name="country"
					class="w-full rounded-lg bg-raised border border-wire px-3 py-2 text-fg focus:border-accent focus:outline-none">
					<option value="">–</option>
					{#each COUNTRIES as c}
						<option value={c} selected={data.profile?.country === c}>{c}</option>
					{/each}
				</select>
			</div>

			<!-- Username (read-only info) + submit -->
			<div class="pt-2">
				<p class="text-xs text-faint mb-3">
					{t('profile_username_label')} : <span class="text-muted font-mono">@{data.profile?.username}</span>
				</p>
				<button type="submit" disabled={loadingProfile}
					class="w-full rounded-lg bg-accent hover:bg-accent-hi disabled:opacity-50 px-4 py-2.5 font-semibold text-canvas transition-colors cursor-pointer">
					{loadingProfile ? t('profile_saving') : t('profile_save')}
				</button>
			</div>
		</form>
	</div>
</div>
