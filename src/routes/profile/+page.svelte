<script lang="ts">
	import { enhance } from '$app/forms';
	import { WC2026_TEAMS, COUNTRIES } from '$lib/wc2026';
	import { t } from '$lib/i18n.svelte';

	import { WC2026_TEAMS as _T } from '$lib/wc2026';

	let { data, form } = $props();
	let loadingProfile = $state(false);
	let loadingAvatar  = $state(false);
	let displayName    = $state(data.profile?.display_name ?? '');
	let countryValue   = $state(data.profile?.country ?? '');
	let selectedTeam   = $state(data.profile?.favorite_team ?? '');
	let selectedScorer = $state(data.profile?.top_scorer ?? '');
	let scorerSearch   = $state('');
	let editingTeam    = $state(false);
	let editingScorer  = $state(false);

	const filteredScorers = $derived(
		(data.scorers ?? []).filter((s) =>
			s.player_name.toLowerCase().includes(scorerSearch.toLowerCase())
		)
	);
	const selectedScorerData = $derived((data.scorers ?? []).find((s) => s.player_name === selectedScorer));

	function teamFlag(name: string): string {
		const t = _T.find((x) => x.name === name);
		return t ? `https://flagcdn.com/w40/${t.flag.toLowerCase()}.png` : '';
	}
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
					bind:value={displayName}
					placeholder={t('profile_display_name_placeholder')}
				/>
			</div>

			<!-- Favourite team -->
			<div>
				<div class="flex items-center justify-between mb-2">
					<label class="block text-sm text-muted">{t('fav_team')}</label>
					{#if data.teamLocked}
						<span class="text-xs text-err font-medium border border-err/30 rounded px-1.5 py-0.5">{t('team_locked')}</span>
					{:else}
						<span class="text-xs text-faint">{t('edit_until_kickoff')}</span>
					{/if}
				</div>

				<input type="hidden" name="favorite_team" value={selectedTeam} />

				{#if data.teamLocked}
					<div class="rounded-lg bg-raised border border-wire/50 px-3 py-2 text-muted text-sm opacity-70">
						{selectedTeam || t('no_team_selected')}
						{#if selectedTeam && data.oddsMap[selectedTeam]}
							<span class="ml-2 text-xs text-faint">×{data.oddsMap[selectedTeam]}</span>
						{/if}
					</div>
				{:else if !editingTeam}
					<!-- Selected view -->
					<button type="button" onclick={() => editingTeam = true}
						class="w-full flex items-center gap-3 rounded-lg bg-raised border border-wire hover:border-accent px-3 py-2.5 text-left transition-colors cursor-pointer">
						{#if selectedTeam}
							{@const url = teamFlag(selectedTeam)}
							{#if url}
								<img src={url} alt="" class="w-8 h-6 object-cover rounded shrink-0" />
							{/if}
							<div class="flex-1 min-w-0">
								<p class="text-sm font-semibold text-fg truncate">{selectedTeam}</p>
								{#if data.oddsMap[selectedTeam]}
									<p class="text-[11px] text-accent font-semibold tabular-nums">×{data.oddsMap[selectedTeam]} {t('bonus_mult')}</p>
								{/if}
							</div>
						{:else}
							<div class="flex-1 text-sm text-muted">{t('no_pref')}</div>
						{/if}
						<svg class="w-4 h-4 text-faint shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
								d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
						</svg>
					</button>
				{:else}
					<p class="text-[11px] text-faint mb-2">{t('bonus_mult')} ×</p>

					<!-- No preference -->
					<button type="button" onclick={() => { selectedTeam = ''; editingTeam = false; }}
						class="w-full text-left rounded-lg px-3 py-2 mb-2 text-sm border transition-colors cursor-pointer
							{selectedTeam === '' ? 'bg-accent-lo border-accent/40 text-fg' : 'bg-raised border-wire text-muted hover:border-wire-hi'}">
						{t('no_pref')}
					</button>

					<!-- Team grid -->
					<div class="grid grid-cols-2 gap-1 max-h-64 overflow-y-auto pr-0.5">
						{#each WC2026_TEAMS as team}
							{@const isSelected = selectedTeam === team.name}
							{@const mult = data.oddsMap[team.name]}
							<button type="button" onclick={() => { selectedTeam = team.name; editingTeam = false; }}
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

			<!-- Top scorer picker -->
			{#if data.scorers && data.scorers.length > 0}
				<div>
					<div class="flex items-center justify-between mb-2">
						<label class="block text-sm text-muted">{t('top_scorer_label')}</label>
						{#if data.scorerLocked}
							<span class="text-xs text-err font-medium border border-err/30 rounded px-1.5 py-0.5">{t('team_locked')}</span>
						{:else if selectedScorerData}
							<span class="text-xs text-accent font-semibold tabular-nums">
								×{selectedScorerData.multiplier.toFixed(1)} {t('per_goal')}
							</span>
						{/if}
					</div>
					<input type="hidden" name="top_scorer" value={selectedScorer} />

					{#if data.scorerLocked}
						<div class="rounded-lg bg-raised border border-wire/50 px-3 py-2 text-muted text-sm opacity-70">
							{selectedScorer || t('no_scorer')}
							{#if selectedScorerData}
								<span class="ml-2 text-xs text-faint">×{selectedScorerData.multiplier.toFixed(1)}</span>
							{/if}
						</div>
					{:else if !editingScorer}
						<button type="button" onclick={() => editingScorer = true}
							class="w-full flex items-center gap-3 rounded-lg bg-raised border border-wire hover:border-accent px-3 py-2.5 text-left transition-colors cursor-pointer">
							{#if selectedScorer}
								<div class="w-8 h-6 rounded bg-canvas border border-wire flex items-center justify-center shrink-0">
									<svg class="w-4 h-4 text-accent" fill="currentColor" viewBox="0 0 24 24">
										<path d="M12 2 8.5 5.5l1 4.5h5l1-4.5L12 2z"/>
									</svg>
								</div>
								<div class="flex-1 min-w-0">
									<p class="text-sm font-semibold text-fg truncate">{selectedScorer}</p>
									{#if selectedScorerData}
										<p class="text-[11px] text-accent font-semibold tabular-nums">×{selectedScorerData.multiplier.toFixed(1)} {t('per_goal')}</p>
									{/if}
								</div>
							{:else}
								<div class="flex-1 text-sm text-muted">{t('no_scorer')}</div>
							{/if}
							<svg class="w-4 h-4 text-faint shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
									d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
							</svg>
						</button>
					{:else}
						<input
							type="text" bind:value={scorerSearch}
							placeholder={t('search_player')}
							class="w-full mb-2 rounded-lg bg-raised border border-wire px-3 py-1.5 text-sm text-fg placeholder:text-faint focus:border-accent focus:outline-none"
						/>

						<button type="button" onclick={() => { selectedScorer = ''; editingScorer = false; }}
							class="w-full text-left rounded-lg px-3 py-2 mb-2 text-sm border transition-colors cursor-pointer
								{selectedScorer === '' ? 'bg-accent-lo border-accent/40 text-fg' : 'bg-raised border-wire text-muted hover:border-wire-hi'}">
							{t('no_scorer')}
						</button>

						<div class="grid grid-cols-2 gap-1 max-h-56 overflow-y-auto pr-0.5">
							{#each filteredScorers as s}
								{@const isSelected = selectedScorer === s.player_name}
								<button type="button" onclick={() => { selectedScorer = s.player_name; editingScorer = false; }}
									class="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-left border transition-colors cursor-pointer
										{isSelected
											? 'bg-accent-lo border-accent/50 text-fg'
											: 'bg-raised border-wire hover:border-wire-hi text-fg'}">
									<span class="text-xs font-medium truncate">{s.player_name}</span>
									<span class="text-[10px] font-semibold shrink-0 tabular-nums
										{isSelected ? 'text-accent' : 'text-faint'}">
										×{s.multiplier.toFixed(1)}
									</span>
								</button>
							{/each}
						</div>
					{/if}
				</div>
			{/if}

			<!-- Country -->
			<div>
				<label for="country" class="block text-sm text-muted mb-1">{t('profile_country_label')}</label>
				<select id="country" name="country" bind:value={countryValue}
					class="w-full rounded-lg bg-raised border border-wire px-3 py-2 text-fg focus:border-accent focus:outline-none">
					<option value="">–</option>
					{#each COUNTRIES as c}
						<option value={c}>{c}</option>
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
