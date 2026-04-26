<script lang="ts">
	import { enhance } from '$app/forms';
	import { t } from '$lib/i18n.svelte';

	let { data, form } = $props();
	let loading = $state(false);
</script>

<div class="mx-auto max-w-md mt-16">
	<div class="rounded-xl bg-panel border border-wire p-8">
		<h1 class="text-2xl font-bold text-accent mb-2">{t('auth_login_title')}</h1>
		<p class="text-muted text-sm mb-6">{t('auth_login_welcome')}</p>

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
				<label for="email" class="block text-sm text-muted mb-1">{t('auth_email_label')}</label>
				<input
					id="email" name="email" type="email" required
					class="w-full rounded-lg bg-raised border border-wire px-3 py-2 text-fg placeholder:text-faint focus:border-accent focus:outline-none"
					placeholder={t('auth_email_placeholder')}
				/>
			</div>
			<div>
				<label for="password" class="block text-sm text-muted mb-1">{t('auth_password_label')}</label>
				<input
					id="password" name="password" type="password" required
					class="w-full rounded-lg bg-raised border border-wire px-3 py-2 text-fg placeholder:text-faint focus:border-accent focus:outline-none"
					placeholder="••••••••"
				/>
			</div>
			<button
				type="submit" disabled={loading}
				class="w-full rounded-lg bg-accent hover:bg-accent-hi disabled:opacity-50 px-4 py-2.5 font-semibold text-canvas transition-colors"
			>
				{loading ? t('auth_logging_in') : t('auth_login_link')}
			</button>
		</form>

		<p class="mt-6 text-center text-sm text-muted">
			{t('auth_no_account')}
			<a href="/auth/register" class="text-accent hover:text-accent-hi">{t('auth_signup_link')}</a>
		</p>
	</div>
</div>
