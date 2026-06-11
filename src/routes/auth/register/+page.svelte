<script lang="ts">
	import { enhance } from '$app/forms';
	import { WC2026_TEAMS, teamLabel } from '$lib/wc2026';
	import { t } from '$lib/i18n.svelte';
	import GoogleSignInButton from '$lib/components/GoogleSignInButton.svelte';

	let { data, form } = $props();
	let loading = $state(false);
	let selectedTeam = $state(form?.favorite_team ?? '');
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
			<div>
				<div class="flex items-center justify-between mb-2">
					<label class="flex items-baseline gap-1.5 text-sm text-muted">
						<span>{t('fav_team')} <span class="text-accent">*</span></span>
						<span class="cursor-help text-faint hover:text-fg transition-colors text-[11px]"
							title={t('multiplier_help')} aria-label={t('multiplier_help')}>(?)</span>
					</label>
					{#if selectedTeam && data.oddsMap[selectedTeam]}
						<span class="text-xs text-accent font-semibold tabular-nums">
							×{data.oddsMap[selectedTeam].toFixed(2)} {t('auth_wc_bonus')}
						</span>
					{/if}
				</div>
				<input type="hidden" name="favorite_team" value={selectedTeam} required />
				<p class="text-[11px] text-faint mb-2">{t('auth_odds_hint')}</p>

				<div class="grid grid-cols-2 gap-1 max-h-56 overflow-y-auto pr-0.5">
					{#each WC2026_TEAMS as team}
						{@const isSelected = selectedTeam === team.name}
						{@const odds = data.oddsMap[team.name]}
						<button type="button" onclick={() => selectedTeam = team.name}
							class="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-left border transition-colors cursor-pointer
								{isSelected
									? 'bg-accent-lo border-accent/50 text-fg'
									: 'bg-raised border-wire hover:border-wire-hi text-fg'}">
							<span class="text-sm font-medium truncate">{teamLabel(team.name)}</span>
							{#if odds}
								<span class="text-[11px] font-semibold shrink-0 tabular-nums
									{isSelected ? 'text-accent' : 'text-faint'}">
									×{odds.toFixed(2)}
								</span>
							{/if}
						</button>
					{/each}
				</div>
				<p class="text-xs text-faint mt-1.5">{t('auth_required_team_hint')}</p>
			</div>

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
