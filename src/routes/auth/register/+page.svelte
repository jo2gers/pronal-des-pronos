<script lang="ts">
	import { enhance } from '$app/forms';
	import { t } from '$lib/i18n.svelte';
	import GoogleSignInButton from '$lib/components/GoogleSignInButton.svelte';

	let { data, form } = $props();
	let loading = $state(false);
	let password = $state('');

	const pwScore = $derived.by(() => {
		const v = password;
		if (!v) return 0;
		let s = 0;
		if (v.length >= 6) s++;
		if (v.length >= 10) s++;
		if (/[A-Z]/.test(v) && /[a-z]/.test(v)) s++;
		if (/\d/.test(v) && /[^A-Za-z0-9]/.test(v)) s++;
		return s; // 0..4
	});
	const pwLabelKey = $derived(
		pwScore <= 1 ? 'pw_weak' : pwScore === 2 ? 'pw_ok' : pwScore === 3 ? 'pw_good' : 'pw_strong'
	);

</script>

<div class="mx-auto max-w-md mt-16">
	<div class="rounded-xl bg-panel border border-wire p-8">
		<h1 class="text-2xl font-bold text-fg mb-2" style="font-family: var(--font-display); letter-spacing: 0.02em">{t('auth_create_account')}</h1>
		<p class="text-muted text-sm mb-6">{t('auth_join_competition')}</p>

		{#if form?.error}
			<div class="mb-4 rounded bg-err/10 border border-err/30 px-4 py-3 text-sm text-err">
				{form.error}
			</div>
		{/if}

		<GoogleSignInButton next={form?.next ?? data.next ?? '/'} />

		<div class="my-5 flex items-center gap-3 text-[11px] uppercase tracking-widest text-faint">
			<span class="flex-1 h-px bg-wire"></span>
			<span>{t('auth_or')}</span>
			<span class="flex-1 h-px bg-wire"></span>
		</div>

		<form method="POST" use:enhance={() => {
			loading = true;
			return async ({ update }) => { loading = false; await update(); };
		}} class="space-y-4">
			<input type="hidden" name="next" value={form?.next ?? data.next ?? '/'} />

			<div>
				<label for="username" class="block text-sm text-muted mb-1">{t('auth_username_label')}</label>
				<input
					id="username" name="username" type="text" required minlength="3" maxlength="30"
					class="w-full rounded-lg bg-raised border border-wire px-3 py-2 text-fg placeholder:text-faint focus:border-accent focus:outline-none"
					placeholder={t('auth_username_placeholder')}
					value={form?.username ?? ''}
				/>
			</div>
			<div>
				<label for="email" class="block text-sm text-muted mb-1">{t('auth_email_label')}</label>
				<input
					id="email" name="email" type="email" required
					class="w-full rounded-lg bg-raised border border-wire px-3 py-2 text-fg placeholder:text-faint focus:border-accent focus:outline-none"
					placeholder={t('auth_email_placeholder')}
					value={form?.email ?? ''}
				/>
			</div>
			<div>
				<label for="password" class="block text-sm text-muted mb-1">{t('auth_password_label')}</label>
				<input
					id="password" name="password" type="password" required minlength="6"
					bind:value={password}
					class="w-full rounded-lg bg-raised border border-wire px-3 py-2 text-fg placeholder:text-faint focus:border-accent focus:outline-none"
					placeholder="••••••••"
				/>
				{#if password.length > 0}
					<div class="mt-2 flex items-center gap-2">
						<div class="flex-1 grid grid-cols-4 gap-1">
							{#each Array(4) as _, i}
								<span class="h-1 rounded-full transition-colors
									{i < pwScore
										? (pwScore <= 1 ? 'bg-err' : pwScore === 2 ? 'bg-warn' : 'bg-success')
										: 'bg-wire'}"
									style={i < pwScore && pwScore >= 3 ? 'background: var(--color-success)' : ''}></span>
							{/each}
						</div>
						<span class="text-[11px] tabular-nums shrink-0
							{pwScore <= 1 ? 'text-err' : pwScore === 2 ? 'text-warn' : 'text-success'}"
							style={pwScore >= 3 ? 'color: var(--color-success)' : ''}>
							{t(pwLabelKey)}
						</span>
					</div>
				{/if}
			</div>
			<!-- V2: no forced favourite team at sign-up — the club is picked PER
			     COMPETITION on the « Mon club » page (survey-driven rework). -->

			<button
				type="submit" disabled={loading}
				class="w-full rounded-lg bg-accent hover:bg-accent-hi disabled:opacity-50 px-4 py-2.5 font-bold text-canvas transition-colors"
			>
				{loading ? t('auth_creating') : t('auth_create_my_account')}
			</button>
		</form>

		<p class="mt-6 text-center text-sm text-muted">
			{t('auth_already_account')}
			<a href="/auth/login{(form?.next ?? data.next ?? '/') !== '/' ? `?next=${encodeURIComponent(form?.next ?? data.next ?? '/')}` : ''}"
				class="text-accent hover:text-accent-hi">{t('auth_login_link')}</a>
		</p>
	</div>
</div>
