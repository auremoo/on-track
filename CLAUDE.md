# On Track — CLAUDE.md

PWA de suivi d'objectifs à échéance (livre, série, cours…) découpés en semaines puis en séances. Mono-utilisateur, mot de passe `171225`, données dans ce dépôt via l'API GitHub. Sœur de `auremoo/pacing-app` et `auremoo/personal-roadmap` (même stack, même écran de connexion, même chiffrement du PAT).

## Stack

Vanilla JS (ES modules, pas de build), CSS pur (variables, style iOS), API GitHub (PAT fine-grained, Contents read+write), PWA, GitHub Pages sur `main` (workflow `.github/workflows/deploy.yml`). `package.json` ne sert qu'aux tests (`npm test` → `node --test`).

## Fichiers

```
index.html / setup.html / config.json / manifest.webmanifest / service-worker.js
logo.svg              source du logo (anneau + coche, barre de rythme en groupes de 3) ; PNG générés depuis ce fichier
css/tokens.css        variables (couleurs iOS, états --st-*, --sidebar-width, --page-max)
css/reset.css         reset + grille ordinateur (sidebar) à partir de 900 px
css/components.css    composants ; section « On Track » en fin de fichier (pastilles, planning, frise, courbe…)
js/app.js             routeur hash + boot + écouteur global [data-nav] + refreshSidebar()
js/store.js           état en mémoire + synchro GitHub (goals.json immédiat, state.json différé) ; summaryOf(id)
js/github-api.js      GET/PUT contents (commits « on-track: … »)
js/utils/plan.js      MOTEUR (pur, testé) : KINDS, distribute, planWeeks, computeGoal, positionLabel, episodeLabel
js/views/
  lock.js             écran mot de passe (repris des apps sœurs)
  chrome.js           topbar() + globalTabBar()
  sidebar.js          sidebar ordinateur
  home.js             onglet Semaine (page d'accueil unique) : la semaine de chaque objectif actif (carte → page de l'objectif), puis « À venir », puis « En pause et terminés » ; weekTotals()
  planning.js         section « À venir » de l'accueil : tous les objectifs mélangés, liste des 4 prochaines semaines (« Voir toutes les semaines ») ou frise (charge par semaine + grille objectifs × semaines)
  goal.js             page d'un objectif : KPI, semaine, plan (bouton Off), courbe, historique, bilan
  goal-form.js        création / modification / duplication (/goal/:id/duplicate), aperçu du plan en direct
  quick-log.js        gestes de saisie partagés : rond prévu touché = séance faite comme prévu (toast « Annuler »), rond vert = corriger, [data-log] = autre quantité
  log-sheet.js        « Autre quantité » / modification / suppression d'une séance : une question (quantité faite, ou position atteinte pour un livre), l'autre en lien ; afterLogMessage
  goal-ui.js          kindIcon, statusInfo, statusPill, slotsHtml (ronds de séances, touchables pour la semaine en cours), weekNotes, weekHeadline, weekCard
  chart.js            courbe cumulée SVG (prévu au départ / réel / plan recalculé) + loadChart (charge par semaine, en séances)
  settings.js         export JSON, déconnexion
js/utils/ui.js, dates.js, crypto.js, markdown.js (repris des apps sœurs)
tests/plan.test.mjs   tests du moteur
```

## Moteur (js/utils/plan.js)

- Semaines = lundis de `mondayOf(startWeek)` à `mondayOf(deadline)` inclus.
- Semaine passée ou en cours : `target = ceil(reste au lundi / semaines actives restantes)` (lissage du retard et de l'avance). Semaines off : cible 0.
- Semaines futures : le reste (en supposant la cible de la semaine en cours atteinte) réparti par `distribute()` (parts entières, les plus grosses en premier).
- Semaine en cours avec N séances/semaine : reste réparti sur les séances restantes ; séances toutes faites et cible non atteinte → `catchUp` (séance de rattrapage).
- Statut : comparaison avec le rythme idéal du départ (`ideal`) → `ahead` / `ontrack` / `late` ; `before`, `overdue`, `done`. Projection au rythme réel des semaines passées.

## Données

- `goals.json` : `{ goals: [{ id, kind, name, unit|null, seasons|null, total, from, startWeek, deadline, sessionsPerWeek|null, offWeeks, status: 'active'|'paused'|'archived', createdAt }] }`
- `state.json` : `{ version: 1, sessions: { goalId: [{ id, week, amount, at, note? }] }, lastUpdated }`

## Conventions

- Les vues exportent `mount(container, …)` et écrivent `innerHTML` ; échapper tout texte utilisateur avec `esc()`.
- Écouteurs sur des éléments recréés à chaque rendu, jamais sur `#app` (sinon ils s'accumulent). Navigation : attribut `data-nav`, géré par un seul écouteur dans app.js. Deux onglets : Semaine (`/`, qui contient aussi le planning) et Réglages ; la page d'un objectif garde le menu du bas. Saisie : `bindQuickLog(root, rerender)` (quick-log.js) gère `data-quick` (rond prévu), `data-edit-session` + `data-goal` (rond fait, ligne d'historique) et `data-log` (autre quantité).
- Après une modification, appeler `refreshSidebar()`.
- Synchro `state.json` regroupée (600 ms), vidée immédiatement quand l'app passe en arrière-plan ; SHA relu avant chaque PUT. Tous les commits de données portent `[skip ci]`.
- sessionStorage : `ontrack_auth`, `ontrack_pat` (distinctes des apps sœurs, même origine `auremoo.github.io`). localStorage : `ontrack_planning_mode` (préférence d'affichage seulement).
- Le sel PBKDF2 (`pacing-app-v1`) est volontairement identique aux apps sœurs : un token chiffré est réutilisable d'une app à l'autre.
- Mode sombre : variables de tokens.css + bloc « Mode sombre : contrastes » en fin de components.css.
- Toute modification du moteur s'accompagne d'un test dans `tests/plan.test.mjs`.
