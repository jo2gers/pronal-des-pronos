# Tifo V2 — Premier League + Champions League (saison 2026-27)

> Branche `v2-next-season` — **rien ici n'est en ligne**. La prod reste l'archive
> de la Coupe du Monde 2026. On itère sur cette branche, on merge le jour du
> lancement. Ce document est la feuille de route ; chaque section se termine par
> les décisions à prendre avec Jo.

---

## 1. Multi-compétitions : une appli, deux jeux

### Le principe

Aujourd'hui tout le schéma suppose UN tournoi (la table `matches` n'a pas de
notion de compétition). La V2 ajoute une table `competitions` et une colonne
`competition_id` partout où ça compte. Le visiteur choisit sa compétition en
haut du site (sélecteur dans la nav) ; tout le reste — matchs, pronos,
classement, ligues — est filtré par la compétition choisie.

```
competitions (nouvelle table)
  id          uuid pk
  slug        text unique      -- 'pl-2026-27', 'ucl-2026-27'
  name_fr / name_en            -- 'Premier League', 'Ligue des Champions'
  format      text             -- 'league' (PL) | 'league_then_knockout' (UCL)
  espn_league text             -- 'eng.1' | 'uefa.champions' (slug API ESPN)
  active      boolean

matches      + competition_id  (fk, indexée)
pronostics   — rien à changer (suit le match)
leagues      + competition_id  (une ligue vit dans une compétition)
wc_winner_odds → competition_winner_odds (+ competition_id) — bonus équipe par compétition
survey/site_settings — inchangés
```

- **Classement par compétition** : la vue `user_pronostic_stats` gagne un
  `competition_id` (join sur matches) ; le leaderboard affiche la compétition
  active. Un classement « combiné » est possible plus tard, c'est juste une
  somme.
- **Équipe favorite par compétition** : le bonus équipe devient une ligne
  `favorite_teams(user_id, competition_id, team)` — on peut avoir Arsenal en
  PL et le Real en UCL. (`profiles.favorite_team` reste pour l'archive CDM.)
- **URL** : la compétition vit dans l'URL (`/pl/matches`, `/ucl/matches`) via un
  segment de route SvelteKit `[comp]` — partageable, pas de state caché. Le
  sélecteur nav bascule d'un préfixe à l'autre, dernier choix mémorisé.

### Ce que le format change (vs la CDM)

| | Premier League | Champions League |
|---|---|---|
| Format | 38 journées, calendrier plat | Phase de ligue (8 matchs) puis KO aller-retour |
| Page « Groupes » | Classement du championnat (1 table) | Classement phase de ligue (1 table à 36) |
| Arbre | — (pas d'arbre) | Arbre à partir des barrages, **aller-retour** (agrégat !) |
| Rythme | ~10 matchs/journée, week-ends | mardis/mercredis par vagues |
| « Vainqueur avance » | — | slot_winner sur le SCORE CUMULÉ des deux manches |

Le pipeline existant (ESPN scoreboard/summary + slugs Polymarket + crons) est
réutilisable tel quel en préfixant l'URL ESPN par `espn_league` — ESPN expose
exactement les mêmes structures pour `eng.1` et `uefa.champions`. Polymarket a
des séries EPL/UCL ; le matching par paire d'équipes existe déjà.

**Gros morceau nouveau** : le knockout UCL aller-retour (agrégat + extérieur ?)
— à concevoir à part quand on y sera (la phase de ligue suffit pour lancer).

### Décisions à prendre (section 1)

- [ ] Les deux compétitions dès le lancement, ou PL d'abord puis UCL ?
- [ ] Un seul « pot » d'utilisateurs (mêmes comptes, deux jeux) — je pars
      là-dessus, c'est le plus simple et le plus social.
- [ ] Les ligues d'amis : par compétition (proposé) ou globales ?

---

## 2. Barème V2 : le score exact payé à sa vraie difficulté

### Le problème (ton exemple)

Aujourd'hui : vainqueur = 1 × cote du résultat, score exact = 3 × cote du
résultat. Donc prédire **0-0** (score le plus probable d'un match fermé,
~8-10 %) paie autant que prédire **4-4** (~0,15 %, cote réelle chez les
bookmakers : 150-250). C'est injuste et ça n'encourage pas l'audace.

### La solution : probabilité de chaque score via Poisson + Dixon-Coles

C'est LA méthode standard du secteur (bookmakers, modèles quantitatifs) :

1. On part des cotes 1X2 qu'on a **déjà** (Polymarket, figées au verrou).
2. On enlève la marge → probabilités victoire/nul/défaite.
3. On résout les buts attendus λ_home, λ_away tels que la matrice de Poisson
   reproduise ces probabilités (2 inconnues, ajustement numérique).
4. Correction **Dixon-Coles** (ρ ≈ −0,13) sur 0-0, 1-0, 0-1, 1-1 — les petits
   scores sont corrélés, Poisson pur les sous/sur-estime.
5. On obtient **P(h, a) pour chaque score exact**. Implémenté dans
   `src/lib/scorelines.ts` (cette branche — maths pures, utilisable côté
   client pour afficher le multiplicateur en direct dans le stepper).

### Le nouveau barème proposé

- **Bon vainqueur** (inchangé) : `1 × cote du résultat`.
- **Score exact** : le bonus **s'ajoute** au gain vainqueur :
  `points = 1 × cote + ln(1/P(score))` (borné `[2, 8]`). Pourquoi additif ?
  P(score) contient déjà la probabilité du résultat — re-multiplier par la
  cote compterait deux fois la même chose ; et l'additif garantit qu'un score
  exact rapporte TOUJOURS plus que le simple bon vainqueur du même match.
  Même philosophie logarithmique que le bonus équipe (`round(ln(cote), 1)`).

Exemple concret (match équilibré, cotes 2.60 / 3.20 / 2.90) :

Chiffres calculés par le moteur (`scorelines.ts`, exécuté sur ces cotes) :

| Score prédit | P(score) | Multiplicateur V2 | Aujourd'hui |
|---|---|---|---|
| 1-1 | 14.4 % | ×2 (plancher) | ×3 |
| 0-0 | 9.5 % | ×2.4 | ×3 |
| 2-1 | 8.3 % | ×2.5 | ×3 |
| 3-1 | 3.6 % | ×3.3 | ×3 |
| 3-3 | 0.9 % | ×4.7 | ×3 |
| 5-0 | 0.25 % | ×6 | ×3 |
| 4-4 | 0.09 % | ×7 | ×3 |

Le score exact « facile » paie un peu moins qu'avant, l'exploit paie le double.
Le multiplicateur de chaque score est **figé au verrou** (comme les cotes
aujourd'hui) et **affiché dans le stepper** pendant qu'on choisit son score —
on voit en direct combien paierait 2-1 vs 3-2. Excellent pour le jeu.

### Décisions à prendre (section 2)

- [ ] Bornes du multiplicateur : [2, 8] proposé (0-0 ≥ ×2, jamais plus de ×8).
- [ ] Le « bon vainqueur » garde `1 × cote` (proposé : oui, ne pas tout changer).
- [x] Afficher la matrice des multiplicateurs sur la page match — fait : la
      grille EST le sélecteur de score.

---

## 2b. Bonus équipe favorite V2 (implémenté — à valider)

Le questionnaire a parlé : seul point faible de la CDM (4/7), avec le
commentaire « trop de points, ça rend le bon prono moins critique ». On garde
la mécanique (les gens aiment avoir un club) mais **par compétition et bien
plus léger** :

- **Un club par compétition** (Arsenal en PL, le Real en UCL) — page « Mon
  club » : grille des 20 blasons avec le multiplicateur affiché
  (`round(ln(cote titre), 1)`, marché champion Polymarket, figé au coup
  d'envoi de la saison). Choix modifiable jusqu'au début de la saison.
- **Barème plat en championnat : 1 × multiplicateur par victoire.** Pas
  d'escalade sur 38 journées (l'escalade CDM sur 7 matchs devenait énorme sur
  une saison). Arsenal ×1.0/victoire ≈ 25-28 pts/saison ; Sunderland ×6.4 en
  paie autant en 4 victoires — l'outsider reste un vrai pari.
- **UCL knockout : l'échelle existante** (8e ×4 … finale ×21), barrages ×2.
- Le bonus s'accumule sur `favorite_teams.bonus_points` (par compétition) et
  entre dans le classement de SA compétition uniquement.

Décision restante :
- [ ] Valider le « 1 × mult par victoire » en championnat (alternative : 0.5 ×
      si encore trop de points — un chiffre à changer).

---

## 2c. Le jour du lancement (checklist de merge)

Le site de la branche EST le site du lancement : accueil saison (cartes PL/UCL
+ compte à rebours), nav par compétitions, inscriptions rouvertes, archive CDM
derrière un lien. Merger la PR = lancer. À faire ce jour-là :

- [ ] `update site_settings set banner_key = null` (retirer la bannière
      « merci d'avoir joué » de l'archive).
- [ ] Vérifier que les slugs UCL sont posés (série + marché champion) si le
      tirage a eu lieu — sinon la carte UCL affiche « tirage fin août », OK.
- [ ] Merger la PR → Vercel déploie. C'est tout (migrations 040-044 déjà
      appliquées, PL ingérée, cotes/multiplicateurs en place).
- [ ] Annonce aux joueurs (la base compte ~47 comptes CDM, tous conservés).

Rouvertures à traiter APRÈS le lancement (pages encore fermées car formées
pour la CDM) : ligues d'amis + amis (re-scoper par compétition), règles
(réécrire pour le barème V2), pages équipe.

---

## 3. Comment on travaille (réponse à « comment venir modifier après ? »)

1. Cette branche `v2-next-season` a une **PR brouillon** sur GitHub — la prod
   (branche `main`) n'est jamais touchée tant qu'on ne merge pas.
2. Vercel crée une **préversion** automatique de la branche à chaque push — on
   peut regarder la V2 dans un navigateur sans toucher au site en ligne.
3. À chaque session : « on continue la V2 » → je pousse sur cette branche, la
   PR se met à jour toute seule.
4. Les migrations V2 (`supabase/migrations/040+`) restent **non appliquées** à
   la base tant qu'on ne lance pas. Le jour J : on applique les migrations, on
   merge la PR, Vercel déploie.
5. Les réponses du questionnaire arriveront entre-temps → le bilan nourrira
   les décisions ci-dessus avant d'implémenter.

> **Statut migrations (mis à jour 2026-07)** : les migrations `040`→`048` sont
> désormais **appliquées** à la base de prod (additives, l'archive CDM est
> intacte : `favorite_teams` vide, `competition_id` rétro-rempli, RLS/policies
> durcies). Le « jour J » ne fait donc plus qu'appliquer d'éventuelles nouvelles
> migrations UCL + merger la PR. Les tables/colonnes V2 sont déjà en place.

---

## 4. Le knockout UCL aller-retour — design (à implémenter avant février 2027)

> Le « gros morceau » annoncé en §1. **Bonne nouvelle de timing** : le tirage de
> fin août ne concerne QUE la **phase de ligue** (8 matchs simples par équipe,
> déjà 100 % supportée par le pipeline actuel). Les confrontations à
> élimination directe ne commencent qu'aux **barrages (~février 2027)**. Donc on
> peut **lancer l'UCL** avec juste la phase de ligue, et implémenter
> l'aller-retour tranquillement pendant l'automne. Rien ici n'est bloquant pour
> le lancement.

### 4.1 Le format 2026-27 (ce qui est aller-retour)

- **Phase de ligue** : 36 équipes, 8 matchs chacune, un seul classement à 36.
  → matchs **simples**, `stage='league'`, journées 1-8 (assignées à l'ingestion,
  comme la PL). Rien de neuf.
- **Barrages** : les équipes classées 9-24 s'affrontent en **aller-retour** pour
  8 places ; 1-8 sont directement en 8e ; 25-36 éliminées.
- **8e, ¼, ½** : **aller-retour**.
- **Finale** : match **simple** sur terrain neutre.
- Confrontations à deux manches : `playoff`, `round_of_16`, `quarters`, `semis`.
  Manche unique : `final` (et toute la phase de ligue).
- **Plus de règle du but à l'extérieur** (l'UEFA l'a abolie en 2021) : à égalité
  de cumul après les 90' du retour → **prolongation puis tirs au but sur le
  match retour**.

### 4.2 Modèle de données proposé

**Principe directeur : chaque manche est un `matches` normal.** Une manche =
une ligne `matches` pickable + notée comme n'importe quel match (pronos, cotes,
multiplicateur de score exact, live, règle des 90'). On ne crée **aucun** type
de match spécial — on réutilise toute la machinerie existante.

Ce qui manque, c'est de **relier les deux manches d'une même confrontation** et
de calculer l'agrégat. Colonnes additives (migration UCL, à faire au moment de
concevoir la seed du bracket) :

```
matches.tie_id   uuid   -- groupe les 2 manches d'une confrontation (null = manche unique : finale, phase de ligue, PL)
matches.leg      int2   -- 1 = aller, 2 = retour (null = manche unique)
```

- Le bracket : un **slot = une confrontation = 2 lignes matches** (leg 1 : A
  reçoit B ; leg 2 : B reçoit A, orientation inversée). `home_source` /
  `away_source` (qui alimente le slot) restent au niveau de la confrontation ;
  `resolve_bracket` remplit les DEUX manches quand les deux qualifiés sont
  connus.
- Alternative écartée : une seule ligne avec des colonnes « retour » en plus →
  casse le fait qu'une manche est un match à part entière (pronos/cotes/live par
  manche). On garde 2 lignes.

> ⚠️ **Ne pas figer ce schéma à l'aveugle.** Le flux ESPN `uefa.champions`
> impose peut-être une structure plus naturelle (gameId par manche, liaison de
> tie). Décider `tie_id`/`leg` **en voyant les vraies données** au moment de
> l'ingestion du bracket (leçon audit : vérifier contre le réel avant de coder
> le schéma).

### 4.3 L'algorithme d'avancement (agrégat)

Nouveau : `slot_winner` doit raisonner sur les **deux manches**, pas une seule.

```
agg_A = leg1.home_score(A)  + leg2.away_score(A)     -- A reçoit à l'aller
agg_B = leg1.away_score(B)  + leg2.home_score(B)     -- B reçoit au retour
si agg_A > agg_B  → A avance
si agg_B > agg_A  → B avance
si agg_A = agg_B  (après les 90' du retour) → le retour est allé en prolongation :
    décider avec le RÉSULTAT EFFECTIF du leg 2 : coalesce(pen, ft_après_prolong, 90')
    (l'agrégat inclut la prolongation ; les t.a.b. tranchent en dernier)
```

- Réutilise la logique « résultat effectif » existante (`coalesce(pen, ft, 90)`)
  mais **au niveau de la confrontation** (cumul), avec prolongation/t.a.b.
  uniquement sur le leg 2.
- **Même garde que le simple** : une confrontation ne peut pas finir à égalité →
  `slot_winner` renvoie NULL tant que les données sont incomplètes (retry au tick
  suivant), pour ne pas avancer le mauvais club sur un cumul provisoire (c'est
  exactement le bug de course CDM qu'on a corrigé — migration 038).

### 4.4 Impact sur le scoring des pronos : AUCUN

Chaque manche est notée sur son **score à 90 minutes**, comme tout match KO
(`KNOCKOUT_STAGES` couvre déjà `playoff/round_of_16/quarters/semis`). Le joueur
pronostique chaque manche séparément. L'agrégat ne change **que** :
  (a) qui remplit le slot suivant du bracket (avancement) ;
  (b) le **bonus club** « mon équipe est passée ».
La notation prono par manche est donc **inchangée** — seul l'avancement est
neuf. C'est ce qui rend le morceau raisonnable.

### 4.5 Bonus club sur l'aller-retour — DÉCISION À PRENDRE

`STAGE_BONUS` paie le bonus club **par victoire de match** (8e ×4 × mult, etc.).
En aller-retour, deux options :
- **(A) une fois par confrontation** (sur l'avancement) — « mon club atteint le
  tour suivant » rapporte `STAGE_BONUS[stage] × mult` une seule fois. *Recommandé* :
  cohérent avec « franchir un tour », ne double pas selon le nombre de manches
  gagnées.
- **(B) par manche gagnée** — un club qui gagne les deux manches touche 2× le
  bonus du tour. Plus « riche » mais gonfle (le survey se plaignait déjà de
  l'inflation ; on vient de passer le bonus ligue à 0.5×).

→ Reco : **(A) une fois par confrontation**, gaté sur la résolution de la
confrontation (pas par manche). Implémentation : le bloc bonus de `scoreMatch`
ne s'exécute pour un match à deux manches que sur le **leg 2 résolu** (le leg 1
passe `skipBonus`), et lit l'agrégat pour savoir qui est passé.

### 4.6 Plan d'ingestion (quand on y sera)

1. **Fin août — phase de ligue seulement** : `competitions.polymarket_series_id`
   + `polymarket_winner_slug` UCL 2026-27 (une update SQL) ; `syncCompetitionFixtures`
   sur `uefa.champions` (ingère 36 équipes + crests + les 8 journées, déjà géré).
   → l'UCL devient jouable comme la PL (chooser featured PL, UCL secondaire).
2. **Automne** : implémenter §4.2-4.5 (colonnes `tie_id`/`leg`, `slot_winner`
   agrégat, bonus gaté sur la confrontation, arbre aller-retour dans l'UI).
3. **Barrages (~février 2027)** : seed du bracket KO (les vraies confrontations
   sortent du classement de phase de ligue) → resolve_bracket remplit les 2
   manches par slot.

### 4.7 Décisions à prendre (section 4)

- [ ] Bonus club aller-retour : **une fois par confrontation** (A, reco) ou par
      manche (B) ?
- [ ] Modèle `tie_id` + `leg` (proposé) — à confirmer en voyant le flux
      `uefa.champions` réel.
- [ ] Arbre UI aller-retour : afficher les 2 scores de manches + le cumul (« 2-1
      cumul, X qualifié ») — réutiliser `KnockoutResultLine` en l'étendant.
