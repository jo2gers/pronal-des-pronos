<script lang="ts">
	import { enhance } from '$app/forms';
	import { t } from '$lib/i18n.svelte';

	let { form } = $props();
	let loading = $state(false);
</script>

<div class="mx-auto max-w-md mt-16">
	<div class="rounded-xl bg-panel border border-wire p-8">
		<h1 class="text-2xl font-bold text-fg mb-2" style="font-family: var(--font-display); letter-spacing: 0.02em">{t('auth_forgot_title')}</h1>

		{#if form?.sent}
			<div class="mt-2 rounded bg-accent-lo border border-accent/30 px-4 py-3 text-sm text-fg">
				{t('auth_forgot_sent')}
			</div>
		{:else}
			<p class="text-muted text-sm mb-6">{t('auth_forgot_intro')}</p>

			{#if form?.error}
				<div class="mb-4 rounded bg-err/10 border border-err/30 px-4 py-3 text-sm text-err">
					{form.error}
				</div>
			{/if}

			<form method="POST" use:enhance={() => {
				loading = true;
				return async ({ update }) => { loading = false; await update(); };
			}} class="space-y-4">
				<div>
					<label for="email" class="block text-sm text-muted mb-1">{t('auth_email_label')}</label>
					<input
						id="email" name="email" type="email" required value={form?.email ?? ''}
						class="w-full rounded-lg bg-raised border border-wire px-3 py-2 text-fg placeholder:text-faint focus:border-accent focus:outline-none"
						placeholder={t('auth_email_placeholder')}
					/>
				</div>
				<button
					type="submit" disabled={loading}
					class="w-full rounded-lg bg-accent hover:bg-accent-hi disabled:opacity-50 px-4 py-2.5 font-semibold text-canvas transition-colors"
				>
					{loading ? t('auth_forgot_sending') : t('auth_forgot_submit')}
				</button>
			</form>
		{/if}

		<p class="mt-6 text-center text-sm">
			<a href="/auth/login" class="text-muted hover:text-fg transition-colors">{t('auth_forgot_back')}</a>
		</p>
	</div>
</div>
