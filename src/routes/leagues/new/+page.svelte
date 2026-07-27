<script lang="ts">
	import { enhance } from '$app/forms';
	import { t, getLang } from '$lib/i18n.svelte';
	let { data, form } = $props();
	let loading = $state(false);
	let name = $state('');
	const nameValid = $derived(name.trim().length >= 2);
	const fr = $derived(getLang() === 'fr');
</script>

<div class="max-w-lg mx-auto">
	<h1 class="text-2xl font-bold text-fg mb-6" style="font-family: var(--font-display); letter-spacing: 0.02em">{t('group_create_title')}</h1>

	{#if form?.error}
		<div class="mb-4 rounded bg-err/10 border border-err/30 px-4 py-3 text-sm text-err">
			{form.error}
		</div>
	{/if}

	<div class="rounded-xl bg-panel border border-wire p-6">
		<form method="POST" use:enhance={() => {
			loading = true;
			return async ({ update }) => { loading = false; await update(); };
		}} class="space-y-4">
			<div>
				<p class="block text-sm text-muted mb-2">{fr ? 'Compétition' : 'Competition'}</p>
				<div class="flex gap-3">
					{#each data.competitions as comp, i}
						<label class="flex-1 cursor-pointer">
							<input type="radio" name="competition_id" value={comp.id} class="sr-only peer" checked={data.currentSlug ? comp.slug === data.currentSlug : i === 0} required />
							<div class="rounded-lg border border-wire peer-checked:border-accent peer-checked:bg-accent-lo px-4 py-3 text-center transition-colors">
								<p class="text-sm font-semibold text-fg">{fr ? comp.name_fr : comp.name_en}</p>
							</div>
						</label>
					{/each}
				</div>
			</div>
			<div>
				<label for="name" class="block text-sm text-muted mb-1">{t('group_name_label')}</label>
				<input id="name" name="name" type="text" required minlength="2" maxlength="50"
					bind:value={name}
					class="w-full rounded-lg bg-raised border border-wire px-3 py-2 text-fg placeholder:text-faint focus:border-accent focus:outline-none"
					placeholder={t('group_name_placeholder')} />
			</div>
			<div>
				<label for="description" class="block text-sm text-muted mb-1">{t('group_description_label')}</label>
				<textarea id="description" name="description" rows="3" maxlength="200"
					class="w-full rounded-lg bg-raised border border-wire px-3 py-2 text-fg placeholder:text-faint focus:border-accent focus:outline-none resize-none"
					placeholder={t('group_description_placeholder')}></textarea>
			</div>
			<div>
				<p class="block text-sm text-muted mb-2">{t('group_visibility_label')}</p>
				<div class="flex gap-3">
					<label class="flex-1 cursor-pointer">
						<input type="radio" name="is_public" value="true" class="sr-only peer" checked />
						<div class="rounded-lg border border-wire peer-checked:border-accent peer-checked:bg-accent-lo px-4 py-3 text-center transition-colors">
							<p class="text-sm font-semibold text-fg">{t('group_public')}</p>
							<p class="text-xs text-faint mt-1">{t('group_public_hint')}</p>
						</div>
					</label>
					<label class="flex-1 cursor-pointer">
						<input type="radio" name="is_public" value="false" class="sr-only peer" />
						<div class="rounded-lg border border-wire peer-checked:border-accent peer-checked:bg-accent-lo px-4 py-3 text-center transition-colors">
							<p class="text-sm font-semibold text-fg">{t('group_private')}</p>
							<p class="text-xs text-faint mt-1">{t('group_private_hint')}</p>
						</div>
					</label>
				</div>
			</div>
			<div class="flex gap-3 pt-2">
				<a href="/leagues" class="flex-1 rounded-lg border border-wire px-4 py-2.5 text-center text-sm text-muted hover:border-wire-hi transition-colors">
					{t('cancel')}
				</a>
				<button type="submit" disabled={loading || !nameValid}
					class="flex-1 rounded-lg bg-accent hover:bg-accent-hi disabled:opacity-50 px-4 py-2.5 font-bold text-canvas transition-colors">
					{loading ? t('group_creating') : t('group_create_btn')}
				</button>
			</div>
		</form>
	</div>
</div>
