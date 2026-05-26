<script lang="ts">
	import { enhance } from '$app/forms';
	import { WC2026_TEAMS, teamLabel } from '$lib/wc2026';
	import { t } from '$lib/i18n.svelte';

	let { data, form } = $props();
	let loading = $state(false);
	let username = $state(form?.username ?? data.profile?.username ?? data.suggestedUsername ?? '');
	let selectedTeam = $state(form?.favorite_team ?? data.profile?.favorite_team ?? '');
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
		</div>

		<button
			type="submit" disabled={loading}
			class="w-full rounded-lg bg-accent hover:bg-accent-hi disabled:opacity-50 px-4 py-2.5 font-bold text-canvas transition-colors"
		>
			{loading ? t('auth_creating') : t('auth_complete_cta')}
		</button>
	</form>
</div>
