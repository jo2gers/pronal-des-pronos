<script lang="ts">
	import { t } from '$lib/i18n.svelte';
</script>

<div class="max-w-2xl mx-auto space-y-12">
	<header>
		<h1 class="text-2xl font-bold text-fg mb-1" style="font-family: var(--font-display); letter-spacing: 0.02em">
			{t('rules_title')}
		</h1>
		<p class="text-muted text-sm">{t('rules_subtitle')}</p>
	</header>

	<!-- Scoring -->
	<section class="space-y-5">
		<h2 class="text-base font-bold text-fg uppercase tracking-widest text-xs">{t('rules_points_title')}</h2>

		<p class="text-sm text-muted leading-relaxed">
			{t('rules_points_intro')}
		</p>

		<dl class="divide-y divide-wire/60 border-y border-wire">
			<div class="flex items-start gap-4 py-3.5">
				<dt class="shrink-0 w-24 text-right">
					<span class="text-xl font-bold text-accent tabular-nums" style="font-family: var(--font-display)">
						{t('rules_odds_word')} × 3
					</span>
				</dt>
				<dd>
					<p class="text-sm font-semibold text-fg">{t('rules_exact_score')}</p>
					<p class="text-xs text-faint mt-0.5">{t('rules_exact_hint')}</p>
				</dd>
			</div>
			<div class="flex items-start gap-4 py-3.5">
				<dt class="shrink-0 w-24 text-right">
					<span class="text-xl font-bold text-muted tabular-nums" style="font-family: var(--font-display)">
						{t('rules_odds_word')} × 1
					</span>
				</dt>
				<dd>
					<p class="text-sm font-semibold text-fg">{t('rules_correct')}</p>
					<p class="text-xs text-faint mt-0.5">{t('rules_correct_hint')}</p>
				</dd>
			</div>
			<div class="flex items-start gap-4 py-3.5">
				<dt class="shrink-0 w-24 text-right">
					<span class="text-xl font-bold text-faint tabular-nums" style="font-family: var(--font-display)">
						0
					</span>
				</dt>
				<dd>
					<p class="text-sm font-semibold text-fg">{t('rules_wrong')}</p>
					<p class="text-xs text-faint mt-0.5">{t('rules_wrong_hint')}</p>
				</dd>
			</div>
		</dl>

		<p class="text-xs text-faint">
			{t('rules_odds_explain_pre')} <strong class="text-muted">{t('rules_odds_word')}</strong> {t('rules_odds_explain_post')}
		</p>
	</section>

	<!-- Team bonus -->
	<section class="space-y-5 border-t border-wire pt-10">
		<h2 class="text-base font-bold text-fg uppercase tracking-widest text-xs">{t('rules_team_bonus_title')}</h2>

		<p class="text-sm text-muted leading-relaxed">
			{t('rules_team_bonus_intro_pre')} <strong class="text-fg">{t('rules_team_bonus_intro_strong')}</strong> {t('rules_team_bonus_intro_post')}
		</p>

		<table class="w-full text-sm border-y border-wire">
			<thead>
				<tr class="border-b border-wire">
					<th class="px-1 py-2.5 text-left text-[11px] text-faint font-semibold uppercase tracking-widest">{t('rules_phase')}</th>
					<th class="px-1 py-2.5 text-right text-[11px] text-faint font-semibold uppercase tracking-widest">{t('rules_bonus_per_win')}</th>
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
					<tr class="border-b border-wire/40 last:border-0">
						<td class="px-1 py-2.5 text-fg">{stage}</td>
						<td class="px-1 py-2.5 text-right font-bold tabular-nums" style="color: var(--color-bonus); font-family: var(--font-display)">
							{pts}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>

		<p class="text-xs text-faint">
			{t('rules_team_bonus_note')}
		</p>
	</section>

	<!-- Top scorer bonus -->
	<section class="space-y-5 border-t border-wire pt-10">
		<h2 class="text-base font-bold text-fg uppercase tracking-widest text-xs">{t('rules_scorer_title')}</h2>

		<p class="text-sm text-muted leading-relaxed">
			{t('rules_scorer_intro_pre')} <strong class="text-fg">{t('rules_scorer_intro_strong')}</strong> {t('rules_scorer_intro_post')}
		</p>

		<div class="rounded-lg border border-wire/60 px-4 py-3 bg-raised/30">
			<p class="text-xs tabular-nums text-fg font-semibold" style="font-family: var(--font-display); letter-spacing: 0.02em">
				{t('rules_scorer_formula')}
			</p>
			<p class="text-xs text-faint mt-1.5">{t('rules_scorer_formula_hint')}</p>
		</div>

		<div>
			<p class="text-[11px] text-faint uppercase tracking-widest mb-2">{t('rules_scorer_examples_title')}</p>
			<table class="w-full text-sm border-y border-wire">
				<thead>
					<tr class="border-b border-wire">
						<th class="px-1 py-2.5 text-left text-[11px] text-faint font-semibold uppercase tracking-widest">{t('rules_scorer_example_col_odds')}</th>
						<th class="px-1 py-2.5 text-right text-[11px] text-faint font-semibold uppercase tracking-widest">{t('rules_scorer_example_col_mult')}</th>
						<th class="px-1 py-2.5 text-right text-[11px] text-faint font-semibold uppercase tracking-widest">{t('rules_scorer_example_col_5goals')}</th>
					</tr>
				</thead>
				<tbody>
					{#each [
						{ odds: '3.0',  mult: 1.1, total: 5.5 },
						{ odds: '7.0',  mult: 1.9, total: 9.5 },
						{ odds: '15',   mult: 2.7, total: 13.5 },
						{ odds: '30',   mult: 3.4, total: 17.0 },
						{ odds: '60',   mult: 4.1, total: 20.5 }
					] as ex}
						<tr class="border-b border-wire/40 last:border-0">
							<td class="px-1 py-2.5 text-muted tabular-nums">{ex.odds}</td>
							<td class="px-1 py-2.5 text-right font-bold tabular-nums" style="color: var(--color-bonus); font-family: var(--font-display)">
								{ex.mult.toFixed(1)}
							</td>
							<td class="px-1 py-2.5 text-right tabular-nums text-fg" style="font-family: var(--font-display)">
								{ex.total.toFixed(1)} pts
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<p class="text-xs text-faint">{t('rules_scorer_note')}</p>
	</section>

	<!-- Deadlines -->
	<section class="space-y-4 border-t border-wire pt-10">
		<h2 class="text-base font-bold text-fg uppercase tracking-widest text-xs">{t('rules_deadlines_title')}</h2>
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

	<!-- Groups / Leagues -->
	<section class="space-y-4 border-t border-wire pt-10">
		<h2 class="text-base font-bold text-fg uppercase tracking-widest text-xs">{t('rules_groups_title')}</h2>
		<p class="text-sm text-muted leading-relaxed">
			{t('rules_groups_p1_pre')} <strong class="text-fg">{t('rules_groups_p1_strong1')}</strong>{t('rules_groups_p1_mid')} <strong class="text-fg">{t('rules_groups_p1_strong2')}</strong> {t('rules_groups_p1_post')}
		</p>
		<p class="text-sm text-muted">
			{t('rules_groups_p2')}
		</p>
	</section>
</div>
