# On Track

> Créé par Aurélien Moote - Moo - 2026. Logiciel libre (licence MIT) :
> réutilisable à condition de conserver la mention de l'auteur.

PWA pour tenir des objectifs à échéance — finir un livre, une série, un cours, des révisions… — en les découpant **semaine par semaine** puis **en séances**.
Sœur de [Pacing App](https://github.com/auremoo/pacing-app) et [Personal Roadmap](https://github.com/auremoo/personal-roadmap) : même principe, mêmes accès, pensée pour le téléphone comme pour l'ordinateur.
Fonctionne sans serveur : toutes les données sont stockées dans ce dépôt GitHub via l'API.

---

## Principe

1. **Créer un objectif** : type (livre, série, cours, révisions, livre audio, écriture, autre), total (pages, épisodes, modules, minutes, mots…), point de départ éventuel, échéance et, si tu veux, un nombre de séances par semaine.
2. **L'app calcule le plan** : la cible de chaque semaine et, avec un nombre de séances, la cible de chaque séance. Pas de jours précis : seulement des séances à caser dans la semaine.
3. **Après chaque séance**, tu notes ce que tu as fait : la quantité (« 23 pages ») ou la position atteinte (« page 142 », « épisode 13 »). L'app recalcule ce qu'il reste sur la semaine et le répartit sur les séances restantes.
4. **Si les séances prévues sont faites sans atteindre la cible**, une **séance de rattrapage** est proposée tant que la semaine n'est pas finie.
5. **Le lundi suivant**, le retard (ou l'avance) est **lissé** sur toutes les semaines restantes jusqu'à l'échéance : chaque semaine vaut « ce qui reste ÷ semaines restantes ».

### Exemple

Livre de 300 pages, 6 semaines, 3 séances par semaine :

| Moment | Ce que l'app affiche |
|---|---|
| Plan | 50 p./semaine → 17 / 17 / 16 p. par séance |
| Séance 1 : 20 p. | Reste 30 p. en 2 séances → 15 / 15 |
| Séances 2 et 3 : 10 + 10 | Séances prévues faites · rattrapage : 10 p. |
| Semaine finie à 40 p. | Les 10 p. manquantes sont lissées : 52 p./semaine ensuite |
| 80 p. lues la 1re semaine | Avance lissée : 44 p./semaine ensuite |

### Règles

- Les semaines vont **du lundi au dimanche**. La semaine de l'échéance compte en entier.
- **Démarrer en cours de semaine** : soit « cette semaine » (comme si tu avais commencé le lundi, la semaine compte en entier), soit « lundi prochain ».
- **Semaine off** (vacances…) : depuis le plan d'un objectif, « Off » retire la semaine ; le reste est redistribué.
- **En avance / dans les temps / en retard** : comparaison avec le rythme régulier prévu au départ. La **fin estimée** se base sur ton rythme réel des semaines passées.
- **Échéance dépassée** avec un reste : l'objectif passe « Échéance dépassée » et propose de repousser l'échéance.
- Les quantités sont entières (pas d'épisode à moitié vu).

## Écrans

| Écran | Contenu |
|---|---|
| Cette semaine | La semaine en cours de chaque objectif actif : reste à faire, séances (faites / prévues / rattrapage), prochaine séance, bouton « + Séance » |
| Planning | Graphique de charge par semaine (séances faites, manquées, à faire), puis tous les objectifs mélangés : **Semaines** (une carte par semaine avec chaque objectif) ou **Frise** (objectifs en lignes, semaines en colonnes, total de séances par semaine) |
| Objectifs | En cours, en pause, terminés / archivés |
| Objectif | Avancement, indicateurs, semaine en cours, plan semaine par semaine (avec « Off »), courbe prévu / réel / plan recalculé, historique des séances (modifiables), notes des séances visibles dans le plan, bilan une fois terminé. Bouton **Dupliquer** (saison suivante, tome 2…) : réglages repris, sans les séances |
| Réglages | Export JSON, documentation, déconnexion |

**Ordinateur (≥ 900 px)** : sidebar permanente, saisie d'une séance en tiroir à droite.
**Téléphone** : menu en bas, saisie en feuille du bas.

## Sécurité & authentification

| Élément | Détail |
|---|---|
| Mot de passe | `171225` — déchiffre le PAT GitHub |
| Chiffrement | AES-GCM 256 bits, dérivation PBKDF2 SHA-256 (même sel que Pacing App et Personal Roadmap) |
| Stockage du PAT | Chiffré dans `config.json` |
| Session | PAT déchiffré en `sessionStorage` uniquement (effacé à la fermeture de l'onglet) |

Le `config.json` reprend le token chiffré de Personal Roadmap. Il fonctionne ici si ce token a aussi accès au dépôt `on-track` (Contents : lecture et écriture). Sinon : générer un token dédié et un nouveau `config.json` avec [setup.html](./setup.html).

## Données dans le dépôt

```
goals.json    objectifs (type, total, départ, échéance, séances/semaine, semaines off, statut)
state.json    séances : { goalId: [{ id, week (lundi), amount, at, note }] }
```

Aucun fichier n'est requis au démarrage. Les écritures portent `[skip ci]` pour ne pas redéployer le site à chaque séance.

## Déploiement

Chaque push sur `main` déclenche GitHub Actions → GitHub Pages. Premier déploiement : Settings → Pages → Source : **GitHub Actions**.
Sur iPhone : Safari → l'URL → Partager → « Sur l'écran d'accueil ».

## Tests

```bash
npm test
```

Teste le moteur de calcul (`js/utils/plan.js`) avec `node --test`, sans dépendance.

---

## Auteur & licence

**Aurélien Moote - Moo - 2026**  
Copyright (c) 2026 Aurélien Moote ("Moo")  
Distribué sous [licence MIT](./LICENSE) — réutilisable à condition de conserver la mention de l'auteur.
