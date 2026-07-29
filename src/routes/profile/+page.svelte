<script lang="ts">
	import { enhance } from '$app/forms';
	import { beforeNavigate } from '$app/navigation';
	import { COUNTRIES } from '$lib/wc2026';
	import { t, getLang } from '$lib/i18n.svelte';

	let { data, form } = $props();
	let loadingProfile = $state(false);
	let loadingAvatar  = $state(false);
	// Pre-fill display_name with username fallback so the field is never empty
	// for a user who has already chosen a handle.
	let displayName    = $state(data.profile?.display_name ?? data.profile?.username ?? '');
	let countryValue   = $state(data.profile?.country ?? '');
	let justSaved      = $state(false);

	// Localised + alphabetically-sorted country options for the dropdown.
	const countryOptions = $derived(
		COUNTRIES
			.map((c) => ({ value: c.value, label: getLang() === 'fr' ? c.fr : c.en }))
			.sort((a, b) => a.label.localeCompare(b.label, getLang()))
	);

	const initial = {
		display_name: data.profile?.display_name ?? '',
		country: data.profile?.country ?? ''
	};

	const dirty = $derived(
		!justSaved && (displayName !== initial.display_name || countryValue !== initial.country)
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
			setTimeout(() => (justSaved = false), 100);
		}
	});
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
			<div class="flex flex-col gap-2">
				<input
					name="avatar" type="file" accept="image/*"
					class="w-full text-sm text-muted file:mr-3 file:rounded file:bg-raised file:border-0 file:text-fg file:px-3 file:py-1.5 file:cursor-pointer"
				/>
				<button type="submit" disabled={loadingAvatar}
					class="w-full rounded bg-raised hover:bg-wire disabled:opacity-50 px-4 py-2 text-sm text-fg transition-colors cursor-pointer">
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
