<script lang="ts">
	// V2 rules — the 2026-27 scoring explained. Inline FR/EN like the other V2
	// pages (the old WC rules page lives in git history; its i18n keys remain
	// for the archive surfaces that still reference them).
	import { getLang } from '$lib/i18n.svelte';
	import { reveal } from '$lib/motion';

	const fr = $derived(getLang() === 'fr');
</script>

<div class="max-w-xl mx-auto space-y-10 pb-8">
	<header in:reveal={{ y: 10 }}>
		<p class="text-[10.5px] uppercase tracking-[0.14em] text-faint" style="font-family: var(--font-mono)">
			{fr ? 'Saison 2026-27' : '2026-27 season'}
		</p>
		<h1 class="text-3xl sm:text-4xl font-bold mt-1" style="font-family: var(--font-display); letter-spacing: -0.03em">
			{fr ? 'Les règles' : 'The rules'}
		</h1>
	</header>

	<!-- ── Le prono ─────────────────────────────────────────────────────────── -->
	<section class="space-y-3 border-t border-wire pt-8" in:reveal={{ delay: 60, y: 10 }}>
		<h2 class="text-base font-bold text-fg">{fr ? 'Le prono' : 'The pick'}</h2>
		<p class="text-sm text-muted leading-relaxed">
			{fr
				? 'Tu prédis le score exact de chaque match — au stepper ou en touchant une case de la grille des scores sur la page du match. Modifiable jusqu\'à 5 minutes avant le coup d\'envoi ; ensuite les pronos de tout le monde deviennent visibles.'
				: 'You predict each match\'s exact score — with the stepper or by tapping a cell in the scoreline grid on the match page. Editable until 5 minutes before kickoff; then everyone\'s picks become visible.'}
		</p>
	</section>

	<!-- ── Les points ───────────────────────────────────────────────────────── -->
	<section class="space-y-3 border-t border-wire pt-8" in:reveal={{ delay: 100, y: 10 }}>
		<h2 class="text-base font-bold text-fg">{fr ? 'Les points' : 'The points'}</h2>
		<div class="rounded-xl border border-wire overflow-hidden">
			<div class="grid grid-cols-[1fr_auto] text-sm">
				<div class="px-4 py-3 border-b border-wire/60 text-muted">{fr ? 'Bon vainqueur (ou nul)' : 'Correct winner (or draw)'}</div>
				<div class="px-4 py-3 border-b border-wire/60 text-right font-bold text-fg tabular-nums">1 × {fr ? 'cote' : 'odds'}</div>
				<div class="px-4 py-3 text-muted">{fr ? 'Score exact' : 'Exact score'}</div>
				<div class="px-4 py-3 text-right font-bold text-accent tabular-nums">1 × {fr ? 'cote' : 'odds'} + ×2 {fr ? 'à' : 'to'} ×8</div>
			</div>
		</div>
		<p class="text-sm text-muted leading-relaxed">
			{fr
				? 'La cote est celle du résultat que tu as prédit (victoire, nul, défaite), figée 5 minutes avant le match — la même pour tout le monde.'
				: 'The odds are those of the outcome you predicted (win, draw, loss), frozen 5 minutes before kickoff — the same for everyone.'}
		</p>
		<p class="text-sm text-muted leading-relaxed">
			{fr
				? 'Le bonus de score exact dépend de la probabilité du score : un 1-1 attendu paie ×2, un 4-4 improbable paie ×7. Chaque case de la grille affiche son multiplicateur pendant que tu choisis — ce que tu vois au verrouillage est exactement ce qui paiera.'
				: 'The exact-score bonus depends on the scoreline\'s probability: an expected 1-1 pays ×2, an unlikely 4-4 pays ×7. Every grid cell shows its multiplier while you pick — what you see at lock is exactly what pays.'}
		</p>
	</section>

	<!-- ── Le bonus club ────────────────────────────────────────────────────── -->
	<section class="space-y-3 border-t border-wire pt-8" in:reveal={{ delay: 140, y: 10 }}>
		<h2 class="text-base font-bold text-fg">{fr ? 'Le bonus club' : 'The club bonus'}</h2>
		<p class="text-sm text-muted leading-relaxed">
			{fr
				? 'Choisis un club par compétition (page « Mon club ») avant le début de la saison — ensuite c\'est verrouillé. Chaque victoire de ton club te rapporte automatiquement son multiplicateur en points, même sans prono.'
				: 'Pick one club per competition (the “My club” page) before the season starts — then it locks. Every win by your club automatically pays its multiplier in points, no pick needed.'}
		</p>
		<p class="text-sm text-muted leading-relaxed">
			{fr
				? 'Le multiplicateur vient de la cote du club au titre, figée au coup d\'envoi de la saison : le favori paie ×1 par victoire, un outsider ×5 ou plus. En Ligue des Champions, les tours à élimination paient davantage (8e ×4 … finale ×21).'
				: 'The multiplier comes from the club\'s title odds, frozen at the season kickoff: the favourite pays ×1 per win, an underdog ×5 or more. In the Champions League, knockout rounds pay more (R16 ×4 … final ×21).'}
		</p>
	</section>

	<!-- ── Divers ───────────────────────────────────────────────────────────── -->
	<section class="space-y-3 border-t border-wire pt-8" in:reveal={{ delay: 180, y: 10 }}>
		<h2 class="text-base font-bold text-fg">{fr ? 'Bon à savoir' : 'Good to know'}</h2>
		<ul class="text-sm text-muted leading-relaxed space-y-2 list-disc pl-5">
			<li>{fr ? 'En phase à élimination (UCL), les pronos sont notés sur le score à 90 minutes — prolongation et tirs au but ne comptent pas pour les points, mais décident bien qui se qualifie.' : 'In knockout rounds (UCL), picks are graded on the 90-minute score — extra time and penalties don\'t count for points, but they do decide who advances.'}</li>
			<li>{fr ? 'Chaque compétition a son propre classement ; le bonus club compte dans le classement de sa compétition uniquement.' : 'Each competition has its own leaderboard; the club bonus counts only in its competition\'s standings.'}</li>
			<li>{fr ? 'Les cotes et multiplicateurs viennent de Polymarket, un marché de prédictions réel.' : 'Odds and multipliers come from Polymarket, a real prediction market.'}</li>
		</ul>
	</section>
</div>
