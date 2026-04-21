<div class="max-w-2xl mx-auto space-y-8">
	<div>
		<h1 class="text-2xl font-bold text-fg mb-1" style="font-family: var(--font-display); letter-spacing: 0.02em">
			Comment fonctionne Pronal ?
		</h1>
		<p class="text-muted text-sm">Tout ce que tu dois savoir pour maximiser tes points.</p>
	</div>

	<!-- Scoring -->
	<section class="rounded-xl bg-panel border border-wire p-6 space-y-5">
		<h2 class="text-base font-bold text-fg">Points par pronostic</h2>

		<p class="text-sm text-muted leading-relaxed">
			Pour chaque match, tu prédis le score exact. Deux niveaux de récompense :
		</p>

		<div class="space-y-3">
			<div class="flex items-start gap-4 rounded-lg bg-raised px-4 py-3">
				<div class="shrink-0 w-24 text-right">
					<span class="text-xl font-bold text-accent tabular-nums" style="font-family: var(--font-display)">
						cote × 3
					</span>
				</div>
				<div>
					<p class="text-sm font-semibold text-fg">Score exact</p>
					<p class="text-xs text-faint mt-0.5">Tu trouves le score précis (ex. 2–1).</p>
				</div>
			</div>
			<div class="flex items-start gap-4 rounded-lg bg-raised px-4 py-3">
				<div class="shrink-0 w-24 text-right">
					<span class="text-xl font-bold text-muted tabular-nums" style="font-family: var(--font-display)">
						cote × 1
					</span>
				</div>
				<div>
					<p class="text-sm font-semibold text-fg">Bon résultat</p>
					<p class="text-xs text-faint mt-0.5">Tu trouves le vainqueur ou le nul, mais pas le score exact.</p>
				</div>
			</div>
			<div class="flex items-start gap-4 rounded-lg bg-raised px-4 py-3">
				<div class="shrink-0 w-24 text-right">
					<span class="text-xl font-bold text-faint tabular-nums" style="font-family: var(--font-display)">
						0
					</span>
				</div>
				<div>
					<p class="text-sm font-semibold text-fg">Mauvais résultat</p>
					<p class="text-xs text-faint mt-0.5">Tu te trompes sur le vainqueur.</p>
				</div>
			</div>
		</div>

		<p class="text-xs text-faint">
			La <strong class="text-muted">cote</strong> reflète la difficulté du pronostic : une victoire surprise rapporte plus qu'un résultat attendu.
		</p>
	</section>

	<!-- Team bonus -->
	<section class="rounded-xl bg-panel border border-wire p-6 space-y-5">
		<h2 class="text-base font-bold text-fg">Bonus équipe favorite</h2>

		<p class="text-sm text-muted leading-relaxed">
			Tu choisis une <strong class="text-fg">équipe favorite</strong> à l'inscription. À chaque fois que ton équipe gagne un match,
			tu reçois automatiquement un bonus — même sans avoir fait de pronostic pour ce match.
			Plus ton équipe avance loin, plus les bonus sont importants.
		</p>

		<div class="overflow-hidden rounded-lg border border-wire">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-wire bg-raised">
						<th class="px-4 py-2.5 text-left text-xs text-faint uppercase tracking-wider font-semibold">Phase</th>
						<th class="px-4 py-2.5 text-right text-xs text-faint uppercase tracking-wider font-semibold">Bonus par victoire</th>
					</tr>
				</thead>
				<tbody>
					{#each [
						['Phase de groupes', '1 pt'],
						['32es de finale', '2 pts'],
						['16es de finale', '4 pts'],
						['Quarts de finale', '8 pts'],
						['Demi-finales', '13 pts'],
						['Match pour la 3e place', '5 pts'],
						['Finale', '21 pts'],
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
			Le bonus est calculé automatiquement après chaque match.
			Tu ne peux pas changer d'équipe favorite à moins de 2h du premier match.
		</p>
	</section>

	<!-- Deadlines -->
	<section class="rounded-xl bg-panel border border-wire p-6 space-y-4">
		<h2 class="text-base font-bold text-fg">Délais et règles</h2>
		<ul class="space-y-3 text-sm text-muted">
			<li class="flex gap-3">
				<span class="shrink-0 text-accent font-bold mt-0.5">·</span>
				<span>Les pronostics se ferment <strong class="text-fg">2h avant le coup d'envoi</strong>. Impossible de modifier après.</span>
			</li>
			<li class="flex gap-3">
				<span class="shrink-0 text-accent font-bold mt-0.5">·</span>
				<span>Tu peux modifier ton pronostic autant de fois que tu veux avant la fermeture.</span>
			</li>
			<li class="flex gap-3">
				<span class="shrink-0 text-accent font-bold mt-0.5">·</span>
				<span>Ton équipe favorite est <strong class="text-fg">verrouillée 2h avant le premier match</strong> de la compétition.</span>
			</li>
			<li class="flex gap-3">
				<span class="shrink-0 text-accent font-bold mt-0.5">·</span>
				<span>Les scores sont calculés automatiquement quelques minutes après la fin du match.</span>
			</li>
		</ul>
	</section>

	<!-- Groups -->
	<section class="rounded-xl bg-panel border border-wire p-6 space-y-4">
		<h2 class="text-base font-bold text-fg">Groupes</h2>
		<p class="text-sm text-muted leading-relaxed">
			Crée un groupe avec tes amis pour suivre votre classement interne.
			Dans un groupe <strong class="text-fg">public</strong>, tous les membres peuvent inviter d'autres joueurs.
			Dans un groupe <strong class="text-fg">privé</strong>, seul l'admin peut envoyer des invitations.
		</p>
		<p class="text-sm text-muted">
			Le classement d'un groupe utilise les mêmes points que le classement global — pronos + bonus équipe.
		</p>
	</section>
</div>
