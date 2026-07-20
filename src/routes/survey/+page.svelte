<script lang="ts">
	// End-of-tournament survey: 10 yes/no questions in 3 sections + one optional
	// comment. All-binary per the survey research (short = answered); neutral
	// styling on Oui/Non so neither answer reads as "the right one".
	import { enhance } from '$app/forms';
	import { t } from '$lib/i18n.svelte';
	import { SURVEY_SECTIONS, SURVEY_QUESTIONS } from '$lib/survey';
	import { reveal, pop } from '$lib/motion';

	let { data } = $props();

	let answers = $state<Record<string, 'yes' | 'no' | undefined>>({});
	let comment = $state('');
	let submitted = $state(false);
	let saving = $state(false);
	let showMissing = $state(false);
	let serverError = $state<string | null>(null);

	const allAnswered = $derived(SURVEY_QUESTIONS.every((q) => answers[q] !== undefined));
	const done = $derived(data.done || submitted);

	function pick(q: string, v: 'yes' | 'no') {
		answers[q] = v;
		showMissing = false;
	}
</script>

<div class="max-w-xl mx-auto space-y-8 pt-4 sm:pt-8 pb-8">
	{#if done}
		<!-- Thank-you state (also shown if the account already answered) -->
		<section class="text-center pt-12" in:pop>
			<p class="text-5xl mb-6" aria-hidden="true">🙏</p>
			<h1 class="text-4xl font-bold" style="font-family: var(--font-display); letter-spacing: -0.03em">
				{t('survey_thanks_title')}
			</h1>
			<p class="text-muted mt-4 max-w-[42ch] mx-auto leading-relaxed">{t('survey_thanks_body')}</p>
			<a href="/" class="inline-flex items-center gap-2 rounded-full border border-wire-hi hover:bg-panel px-6 py-3 text-sm font-medium text-fg transition-colors mt-8">
				← {t('nav_home')}
			</a>
		</section>
	{:else}
		<header in:reveal={{ y: 10 }}>
			<h1 class="text-3xl sm:text-4xl font-bold" style="font-family: var(--font-display); letter-spacing: -0.03em">
				{t('survey_title')}
			</h1>
			<p class="text-muted mt-3 leading-relaxed">{t('survey_intro')}</p>
		</header>

		<form method="POST" action="?/submit"
			use:enhance={({ formData, cancel }) => {
				if (!allAnswered) { showMissing = true; cancel(); return; }
				for (const q of SURVEY_QUESTIONS) formData.set(q, answers[q]!);
				formData.set('comment', comment);
				saving = true;
				return async ({ result }) => {
					saving = false;
					if (result.type === 'success') submitted = true;
					else if (result.type === 'failure') {
						if ((result.data as any)?.error === 'missing') showMissing = true;
						else serverError = String((result.data as any)?.error ?? 'Erreur');
					}
				};
			}}
			class="space-y-8">

			{#each SURVEY_SECTIONS as section, si}
				<section in:reveal={{ delay: 80 + si * 70, y: 10 }}>
					<p class="text-[11px] uppercase tracking-[0.1em] text-faint mb-2 px-1" style="font-family: var(--font-mono)">
						{t(section.i18n)}
					</p>
					<div class="-mx-4 sm:mx-0 divide-y divide-wire/60 border-y border-wire sm:border sm:rounded-xl sm:bg-panel/40 overflow-hidden">
						{#each section.questions as q}
							<div class="flex items-center gap-3 px-4 py-3.5">
								<span class="flex-1 text-sm text-fg leading-snug">{t(q)}</span>
								<div class="flex gap-1 rounded-lg bg-raised border border-wire p-1 shrink-0" role="radiogroup" aria-label={t(q)}>
									<button type="button" role="radio" aria-checked={answers[q] === 'yes'}
										onclick={() => pick(q, 'yes')}
										class="rounded px-3.5 py-1.5 text-sm font-semibold transition-colors cursor-pointer
											{answers[q] === 'yes' ? 'bg-accent text-canvas' : 'text-muted hover:text-fg'}">
										{t('survey_yes')}
									</button>
									<button type="button" role="radio" aria-checked={answers[q] === 'no'}
										onclick={() => pick(q, 'no')}
										class="rounded px-3.5 py-1.5 text-sm font-semibold transition-colors cursor-pointer
											{answers[q] === 'no' ? 'bg-fg text-canvas' : 'text-muted hover:text-fg'}">
										{t('survey_no')}
									</button>
								</div>
							</div>
						{/each}
					</div>
				</section>
			{/each}

			<!-- Optional free comment -->
			<section in:reveal={{ delay: 300, y: 10 }}>
				<label for="survey-comment" class="block text-sm font-semibold text-fg mb-2 px-1">
					{t('survey_comment_label')}
				</label>
				<textarea id="survey-comment" bind:value={comment} rows="4" maxlength="2000"
					placeholder={t('survey_comment_placeholder')}
					class="w-full rounded-xl bg-panel border border-wire focus:border-wire-hi focus:outline-none px-4 py-3 text-sm text-fg placeholder:text-faint resize-y"></textarea>
			</section>

			<section class="space-y-3">
				{#if showMissing}
					<p class="text-sm text-err text-center">{t('survey_missing')}</p>
				{:else if serverError}
					<p class="text-sm text-err text-center">{serverError}</p>
				{/if}
				<button type="submit" disabled={saving}
					class="w-full rounded-full bg-accent hover:bg-accent-hi disabled:opacity-50 px-6 py-3.5 text-sm font-bold text-canvas transition-colors cursor-pointer">
					{saving ? '…' : t('survey_submit')}
				</button>
			</section>
		</form>
	{/if}
</div>
