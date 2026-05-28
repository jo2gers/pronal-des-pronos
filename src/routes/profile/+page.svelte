<script lang="ts">
	import { enhance } from '$app/forms';
	import { beforeNavigate } from '$app/navigation';
	import { WC2026_TEAMS, COUNTRIES, teamLabel } from '$lib/wc2026';
	import { t, getLang } from '$lib/i18n.svelte';

	import { WC2026_TEAMS as _T } from '$lib/wc2026';

	let { data, form } = $props();
	let loadingProfile = $state(false);
	let loadingAvatar  = $state(false);
	// Pre-fill display_name with username fallback so the field is never empty
	// for a user who has already chosen a handle.
	let displayName    = $state(data.profile?.display_name ?? data.profile?.username ?? '');
	let countryValue   = $state(data.profile?.country ?? '');

	// Localised + alphabetically-sorted country options for the dropdown.
	// Value stays as the canonical French name (matches existing DB rows).
	const countryOptions = $derived(
		COUNTRIES
			.map((c) => ({ value: c.value, label: getLang() === 'fr' ? c.fr : c.en }))
			.sort((a, b) => a.label.localeCompare(b.label, getLang()))
	);
	let selectedTeam   = $state(data.profile?.favorite_team ?? '');
	let editingTeam    = $state(false);
	let justSaved      = $state(false);

	const initial = {
		display_name: data.profile?.display_name ?? '',
		country: data.profile?.country ?? '',
		favorite_team: data.profile?.favorite_team ?? ''
	};

	const dirty = $derived(
		!justSaved && (
			displayName !== initial.display_name ||
			countryValue !== initial.country ||
			selectedTeam !== initial.favorite_team
		)
	);

	beforeNavigate(({ cancel, type }) => {
		if (!dirty || type === 'leave') return;
		if (!confirm(t('profile_unsaved_confirm'))) cancel();
	});

	$effect(() => {
		const handler = (e: BeforeUnloadEvent) => {
			if (dirty) { e.preventDefault(); e.returnValue = ''; }
		};
		window.addEventListener('beforeunload', handler);
		return () => window.removeEventListener('beforeunload', handler);
	});

	$effect(() => {
		if (form?.success) {
			justSaved = true;
			// Reset baseline after a successful save
			initial.display_name = displayName;
			initial.country = countryValue;
			initial.favorite_team = selectedTeam;
			setTimeout(() => (justSaved = false), 100);
		}
	});

	function teamFlag(name: string): string {
		const t = _T.find((x) => x.name === name);
		return t ? `https://flagcdn.com/w40/${t.flag.toLowerCase()}.png` : '';
	}

	function onPickerKey(e: KeyboardEvent) {
		if (e.key !== 'Escape') return;
		if (editingTeam) { editingTeam = false; e.preventDefault(); }
	}
</script>

<svelte:window onkeydown={onPickerKey} />

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

	<!-- Bonus summary — accumulated favorite-team bonus on the user's profile -->
	{#if (data.profile?.team_bonus_points ?? 0) > 0 || data.profile?.favorite_team}
		{@const teamBonus = data.profile?.team_bonus_points ?? 0}
		<section class="space-y-3">
			<h2 class="text-base font-bold text-fg uppercase tracking-widest text-xs">{t('profile_bonuses_title')}</h2>
			<dl class="border-y border-wire">
				<div class="p-3">
					<dt class="text-[11px] text-faint uppercase tracking-widest mb-1">{t('profile_bonus_team')}</dt>
					<dd class="font-bold tabular-nums text-xl" style="color: var(--color-bonus); font-family: var(--font-display)">
						+{teamBonus.toFixed(2)}
					</dd>
					{#if data.profile?.favorite_team}
						<p class="text-[11px] text-faint mt-0.5 truncate">{teamLabel(data.profile.favorite_team)}</p>
					{/if}
				</div>
			</dl>
			<p class="text-[11px] text-faint">{t('profile_bonus_hint')}</p>
		</section>
	{/if}

	<!-- Avatar -->
	<div class="rounded-xl bg-panel border border-wire p-6">
		<h2 class="text-base font-semibold text-fg mb-4" style="font-family: var(--font-display)">{t('profile_avatar_section')}</h2>
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
		<h2 class="text-base font-semibold text-fg mb-4" style="font-family: var(--font-display)">{t('profile_info_section')}</h2>
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
					<label class="flex items-baseline gap-1.5 text-sm text-muted">
						{t('fav_team')}
						<span class="cursor-help text-faint hover:text-fg transition-colors text-[11px]"
							title={t('multiplier_help')} aria-label={t('multiplier_help')}>(?)</span>
					</label>
					{#if data.teamLocked}
						<span class="text-xs text-err font-medium border border-err/30 rounded px-1.5 py-0.5">{t('team_locked')}</span>
					{:else}
						<span class="text-xs text-faint">{t('edit_until_kickoff')}</span>
					{/if}
				</div>

				<input type="hidden" name="favorite_team" value={selectedTeam} />

				{#if data.teamLocked}
					<div class="rounded-lg bg-raised border border-wire/50 px-3 py-2 text-muted text-sm opacity-70">
						{teamLabel(selectedTeam) || t('no_team_selected')}
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
								<p class="text-sm font-semibold text-fg truncate">{teamLabel(selectedTeam)}</p>
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
								<span class="text-sm font-medium truncate">{teamLabel(team.name)}</span>
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
				<select id="country" name="country" bind:value={countryValue}
					class="w-full rounded-lg bg-raised border border-wire px-3 py-2 text-fg focus:border-accent focus:outline-none">
					<option value="">–</option>
					{#each countryOptions as c}
						<option value={c.value}>{c.label}</option>
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
