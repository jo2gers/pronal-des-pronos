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
   `src/lib/server/scorelines.ts` (cette branche).

### Le nouveau barème proposé

- **Bon vainqueur** (inchangé) : `1 × cote du résultat`.
- **Score exact** : au lieu de `3 ×`, le multiplicateur devient
  **`ln(1 / P(score))`** — même philosophie logarithmique que le bonus équipe
  actuel (`round(ln(cote), 1)`), borné à `[2, 8]` pour éviter les absurdités.

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
- [ ] Afficher la matrice des multiplicateurs sur la page match (proposé : oui).

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
