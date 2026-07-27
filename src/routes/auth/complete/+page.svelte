<script lang="ts">
	import { enhance } from '$app/forms';
	import { t } from '$lib/i18n.svelte';

	let { data, form } = $props();
	let loading = $state(false);
	let username = $state(form?.username ?? data.profile?.username ?? data.suggestedUsername ?? '');
</script>

<div class="mx-auto max-w-md mt-12">
	<header class="mb-6">
		<h1 class="text-2xl font-bold text-fg mb-1" style="font-family: var(--font-display); letter-spacing: 0.02em">
			{t('auth_complete_title')}
		</h1>
		<p class="text-muted text-sm">{t('auth_complete_hint')}</p>
		<p class="text-faint text-xs mt-2">{data.email}</p>
	</header>

	{#if form?.error}
		<div class="mb-4 rounded bg-err/10 border border-err/30 px-4 py-3 text-sm text-err">
			{form.error}
		</div>
	{/if}

	<form method="POST" use:enhance={() => {
		loading = true;
		return async ({ update }) => { loading = false; await update(); };
	}} class="space-y-5">
		<input type="hidden" name="next" value={form?.next ?? data.next ?? '/'} />

		<div>
			<label for="username" class="block text-sm text-muted mb-1">{t('auth_username_label')}</label>
			<input
				id="username" name="username" type="text" required minlength="3" maxlength="30"
				bind:value={username}
				class="w-full rounded-lg bg-raised border border-wire px-3 py-2 text-fg placeholder:text-faint focus:border-accent focus:outline-none"
				placeholder={t('auth_username_placeholder')}
			/>
		</div>

		<!-- V2: no forced favourite team here — the club is picked per
		     competition on the « Mon club » page. -->

		<button
			type="submit" disabled={loading}
			class="w-full rounded-lg bg-accent hover:bg-accent-hi disabled:opacity-50 px-4 py-2.5 font-bold text-canvas transition-colors"
		>
			{loading ? t('auth_creating') : t('auth_complete_cta')}
		</button>
	</form>
</div>
