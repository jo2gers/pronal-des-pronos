<script lang="ts">
	import { enhance } from '$app/forms';
	import { t } from '$lib/i18n.svelte';

	let { data, form } = $props();
	let loading = $state(false);

	// Map known error codes to localized copy; fall back to the raw message.
	function errMsg(code: string | undefined): string | null {
		if (!code) return null;
		if (code === 'too_short') return t('auth_reset_too_short');
		if (code === 'mismatch') return t('auth_reset_mismatch');
		if (code === 'invalid') return t('auth_reset_invalid');
		return code;
	}
</script>

<div class="mx-auto max-w-md mt-16">
	<div class="rounded-xl bg-panel border border-wire p-8">
		<h1 class="text-2xl font-bold text-fg mb-2" style="font-family: var(--font-display); letter-spacing: 0.02em">{t('auth_reset_title')}</h1>

		{#if data.authed}
			<p class="text-muted text-sm mb-6">{t('auth_reset_intro')}</p>

			{#if form?.error}
				<div class="mb-4 rounded bg-err/10 border border-err/30 px-4 py-3 text-sm text-err">
					{errMsg(form.error)}
				</div>
			{/if}

			<form method="POST" action="?/update" use:enhance={() => {
				loading = true;
				return async ({ update }) => { loading = false; await update(); };
			}} class="space-y-4">
				<div>
					<label for="password" class="block text-sm text-muted mb-1">{t('auth_reset_new')}</label>
					<input
						id="password" name="password" type="password" required minlength="6" autocomplete="new-password"
						class="w-full rounded-lg bg-raised border border-wire px-3 py-2 text-fg placeholder:text-faint focus:border-accent focus:outline-none"
						placeholder="••••••••"
					/>
				</div>
				<div>
					<label for="confirm" class="block text-sm text-muted mb-1">{t('auth_reset_confirm')}</label>
					<input
						id="confirm" name="confirm" type="password" required minlength="6" autocomplete="new-password"
						class="w-full rounded-lg bg-raised border border-wire px-3 py-2 text-fg placeholder:text-faint focus:border-accent focus:outline-none"
						placeholder="••••••••"
					/>
				</div>
				<button
					type="submit" disabled={loading}
					class="w-full rounded-lg bg-accent hover:bg-accent-hi disabled:opacity-50 px-4 py-2.5 font-semibold text-canvas transition-colors"
				>
					{loading ? t('auth_reset_saving') : t('auth_reset_submit')}
				</button>
			</form>
		{:else}
			<div class="mt-2 rounded bg-err/10 border border-err/30 px-4 py-3 text-sm text-err">
				{t('auth_reset_invalid')}
			</div>
			<a href="/auth/forgot"
				class="mt-5 block w-full rounded-lg bg-accent hover:bg-accent-hi px-4 py-2.5 text-center font-semibold text-canvas transition-colors">
				{t('auth_reset_request_new')}
			</a>
		{/if}
	</div>
</div>
