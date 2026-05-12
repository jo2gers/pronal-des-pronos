<script lang="ts">
	import { enhance } from '$app/forms';
	import { WC2026_TEAMS } from '$lib/wc2026';
	import { t } from '$lib/i18n.svelte';

	let { data, form } = $props();
	let loading = $state(false);
	let selectedTeam = $state(form?.favorite_team ?? '');
	let selectedScorer = $state(form?.top_scorer ?? '');
	let scorerSearch = $state('');
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

	const filteredScorers = $derived(
		(data.scorers ?? []).filter((s) =>
			s.player_name.toLowerCase().includes(scorerSearch.toLowerCase())
		)
	);
	const selectedScorerData = $derived((data.scorers ?? []).find((s) => s.player_name === selectedScorer));
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
							<span class="text-sm font-medium truncate">{team.name}</span>
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

			<!-- Top scorer picker -->
			{#if data.scorers && data.scorers.length > 0}
				<div>
					<div class="flex items-center justify-between mb-2">
						<label class="flex items-baseline gap-1.5 text-sm text-muted">
							<span>{t('top_scorer_label')} <span class="text-faint">{t('auth_optional')}</span></span>
							<span class="cursor-help text-faint hover:text-fg transition-colors text-[11px]"
								title={t('multiplier_help')} aria-label={t('multiplier_help')}>(?)</span>
						</label>
						{#if selectedScorerData}
							<span class="text-xs text-accent font-semibold tabular-nums">
								×{selectedScorerData.multiplier.toFixed(1)} {t('per_goal')}
							</span>
						{/if}
					</div>
					<input type="hidden" name="top_scorer" value={selectedScorer} />
					<p class="text-[11px] text-faint mb-2">{t('auth_scorer_bonus_hint_a')} {selectedScorerData ? `${selectedScorerData.multiplier.toFixed(1)} ${t('auth_scorer_bonus_hint_pts')}` : t('auth_scorer_bonus_hint_some')} {t('auth_scorer_bonus_hint_b')}</p>

					<input
						type="text" bind:value={scorerSearch}
						placeholder={t('search_player')}
						class="w-full mb-2 rounded-lg bg-raised border border-wire px-3 py-1.5 text-sm text-fg placeholder:text-faint focus:border-accent focus:outline-none"
					/>

					<div class="grid grid-cols-2 gap-1 max-h-48 overflow-y-auto pr-0.5">
						{#each filteredScorers as s}
							{@const isSelected = selectedScorer === s.player_name}
							<button type="button" onclick={() => selectedScorer = isSelected ? '' : s.player_name}
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
				</div>
			{/if}

			<button
				type="submit" disabled={loading}
				class="w-full rounded-lg bg-accent hover:bg-accent-hi disabled:opacity-50 px-4 py-2.5 font-bold text-canvas transition-colors"
			>
				{loading ? t('auth_creating') : t('auth_create_my_account')}
			</button>
		</form>

		<p class="mt-6 text-center text-sm text-muted">
			{t('auth_already_account')}
			<a href="/auth/login" class="text-accent hover:text-accent-hi">{t('auth_login_link')}</a>
		</p>
	</div>
</div>
