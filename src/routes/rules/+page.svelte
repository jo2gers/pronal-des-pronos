<script lang="ts">
	import { t } from '$lib/i18n.svelte';
</script>

<div class="max-w-2xl mx-auto space-y-8">
	<div>
		<h1 class="text-2xl font-bold text-fg mb-1" style="font-family: var(--font-display); letter-spacing: 0.02em">
			{t('rules_title')}
		</h1>
		<p class="text-muted text-sm">{t('rules_subtitle')}</p>
	</div>

	<!-- Scoring -->
	<section class="rounded-xl bg-panel border border-wire p-6 space-y-5">
		<h2 class="text-base font-bold text-fg">{t('rules_points_title')}</h2>

		<p class="text-sm text-muted leading-relaxed">
			{t('rules_points_intro')}
		</p>

		<div class="space-y-3">
			<div class="flex items-start gap-4 rounded-lg bg-raised px-4 py-3">
				<div class="shrink-0 w-24 text-right">
					<span class="text-xl font-bold text-accent tabular-nums" style="font-family: var(--font-display)">
						{t('rules_odds_word')} × 3
					</span>
				</div>
				<div>
					<p class="text-sm font-semibold text-fg">{t('rules_exact_score')}</p>
					<p class="text-xs text-faint mt-0.5">{t('rules_exact_hint')}</p>
				</div>
			</div>
			<div class="flex items-start gap-4 rounded-lg bg-raised px-4 py-3">
				<div class="shrink-0 w-24 text-right">
					<span class="text-xl font-bold text-muted tabular-nums" style="font-family: var(--font-display)">
						{t('rules_odds_word')} × 1
					</span>
				</div>
				<div>
					<p class="text-sm font-semibold text-fg">{t('rules_correct')}</p>
					<p class="text-xs text-faint mt-0.5">{t('rules_correct_hint')}</p>
				</div>
			</div>
			<div class="flex items-start gap-4 rounded-lg bg-raised px-4 py-3">
				<div class="shrink-0 w-24 text-right">
					<span class="text-xl font-bold text-faint tabular-nums" style="font-family: var(--font-display)">
						0
					</span>
				</div>
				<div>
					<p class="text-sm font-semibold text-fg">{t('rules_wrong')}</p>
					<p class="text-xs text-faint mt-0.5">{t('rules_wrong_hint')}</p>
				</div>
			</div>
		</div>

		<p class="text-xs text-faint">
			{t('rules_odds_explain_pre')} <strong class="text-muted">{t('rules_odds_word')}</strong> {t('rules_odds_explain_post')}
		</p>
	</section>

	<!-- Team bonus -->
	<section class="rounded-xl bg-panel border border-wire p-6 space-y-5">
		<h2 class="text-base font-bold text-fg">{t('rules_team_bonus_title')}</h2>

		<p class="text-sm text-muted leading-relaxed">
			{t('rules_team_bonus_intro_pre')} <strong class="text-fg">{t('rules_team_bonus_intro_strong')}</strong> {t('rules_team_bonus_intro_post')}
		</p>

		<div class="overflow-hidden rounded-lg border border-wire">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-wire bg-raised">
						<th class="px-4 py-2.5 text-left text-[11px] text-faint font-semibold">{t('rules_phase')}</th>
						<th class="px-4 py-2.5 text-right text-[11px] text-faint font-semibold">{t('rules_bonus_per_win')}</th>
					</tr>
				</thead>
				<tbody>
					{#each [
						[t('rules_phase_groups'), '1 pt'],
						[t('rules_phase_r32'), '2 pts'],
						[t('rules_phase_r16'), '4 pts'],
						[t('rules_phase_quarters'), '8 pts'],
						[t('rules_phase_semis'), '13 pts'],
						[t('rules_phase_third'), '5 pts'],
						[t('rules_phase_final'), '21 pts'],
					] as [stage, pts]}
						<tr class="border-b border-wire/50 last:border-0 hover:bg-raised/30 transition-colors">
							<td class="px-4 py-2.5 text-fg">{stage}</td>
							<td class="px-4 py-2.5 text-right font-bold tabular-nums" style="color: var(--color-bonus); font-family: var(--font-display)">
								{pts}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<p class="text-xs text-faint">
			{t('rules_team_bonus_note')}
		</p>
	</section>

	<!-- Deadlines -->
	<section class="rounded-xl bg-panel border border-wire p-6 space-y-4">
		<h2 class="text-base font-bold text-fg">{t('rules_deadlines_title')}</h2>
		<ul class="space-y-3 text-sm text-muted">
			<li class="flex gap-3">
				<span class="shrink-0 text-accent font-bold mt-0.5">·</span>
				<span>{t('rules_deadline_1_a')} <strong class="text-fg">{t('rules_deadline_1_strong')}</strong>{t('rules_deadline_1_b')}</span>
			</li>
			<li class="flex gap-3">
				<span class="shrink-0 text-accent font-bold mt-0.5">·</span>
				<span>{t('rules_deadline_2')}</span>
			</li>
			<li class="flex gap-3">
				<span class="shrink-0 text-accent font-bold mt-0.5">·</span>
				<span>{t('rules_deadline_3_a')} <strong class="text-fg">{t('rules_deadline_3_strong')}</strong> {t('rules_deadline_3_b')}</span>
			</li>
			<li class="flex gap-3">
				<span class="shrink-0 text-accent font-bold mt-0.5">·</span>
				<span>{t('rules_deadline_4')}</span>
			</li>
		</ul>
	</section>

	<!-- Groups -->
	<section class="rounded-xl bg-panel border border-wire p-6 space-y-4">
		<h2 class="text-base font-bold text-fg">{t('rules_groups_title')}</h2>
		<p class="text-sm text-muted leading-relaxed">
			{t('rules_groups_p1_pre')} <strong class="text-fg">{t('rules_groups_p1_strong1')}</strong>{t('rules_groups_p1_mid')} <strong class="text-fg">{t('rules_groups_p1_strong2')}</strong> {t('rules_groups_p1_post')}
		</p>
		<p class="text-sm text-muted">
			{t('rules_groups_p2')}
		</p>
	</section>
</div>
