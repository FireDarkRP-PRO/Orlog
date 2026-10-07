# Orlog

Adaptation web du jeu de dés **Orlog** d'*Assassin's Creed Valhalla*, jouable seul contre une IA ou à deux en ligne, hébergée sur GitHub Pages.

Projet de fan, non affilié à Ubisoft. Les règles sont celles du livret « Orlog, jeu de dés » complétées par des précisions propres au projet (voir [Règles](#règles-implémentées)).

## Contenu

```
.
├── index.html            Menu : Multijoueur, Solo, Tutoriel, Règles, fenêtre des 20 faveurs
├── Ressource/
│   ├── style.css         Styles communs (parchemin, teal, bronze)
│   └── orlog.js          Moteur de règles, sans affichage (dés, faveurs, résolution)
└── Orlog/
    ├── salon.html        Salon : créer ou rejoindre une partie avec un code
    ├── multi.html        Partie multijoueur
    ├── solo.html         Partie contre l'IA
    ├── tutoriel.html     Tutoriel guidé (une manche scénarisée)
    └── regles.html       Règles, avec la liste des 20 faveurs
```

## Modes de jeu

| Mode | Faveurs | Particularités |
|---|---|---|
| Débutant | Imposées : Frappe de Thor, Rajeunissement d'Idunn, Jugement d'Odin | 15 PV |
| Casual | Chaque joueur choisit 3 faveurs parmi les 20 | 15 PV |
| Expert | Un seul jeu de 20 : 1 bannissement chacun, puis repêchage jusqu'à 3 faveurs | 2 parties gagnantes sur 3, nouveau repêchage entre les parties |

## Règles implémentées

- Chaque joueur a 6 dés distincts (2 haches, 1 casque, 1 flèche, 1 bouclier, 1 main, dont 2 faces dorées).
- **Lancers :** 3 lancers simultanés, au moins 1 dé gardé à chaque fois, les dés gardés sont verrouillés.
- **Faveurs :** choix secret d'une faveur et d'un palier (une seule par manche), puis révélation.
- **Résolution :** jetons des faces dorées, vols de main, faveurs de priorité 1 à 5, combat séquentiel (le premier joueur attaque d'abord, il alterne à chaque manche), puis priorités 6 et 7.
- Le test de mort a lieu après chaque attaque et chaque groupe de priorité. Si les deux joueurs tombent à 0 en même temps : **mort subite** (les deux repartent à 1 PV, jetons conservés).
- Vol de Thrymr : ne touche que les faveurs adverses de priorité 3 à 7, et dure une manche.

Le détail complet, y compris les 20 faveurs, est dans `Orlog/regles.html` (générée depuis `orlog.js`).

## Architecture

- **`orlog.js`** est le seul endroit où vivent les règles. Il expose l'objet global `Orlog` :
  - `nouvellePartie()`, `lancer()`, `relancer(dés, indices)` ;
  - `peutChoisir(état, joueur, faveur, palier)` : jetons et conditions sur les dés ;
  - `resoudre(état, choix)` : résout une manche, renvoie `{ S, log, fin }` sans modifier l'état reçu ;
  - `FAV` (catalogue des faveurs), `texte()`, `cout()`.
  - L'état est un objet JSON, donc sérialisable et transmissible sur le réseau.
- **Multijoueur :** l'hôte (joueur 1) arbitre la partie avec `orlog.js` et envoie à chaque joueur une vue où les choix secrets sont masqués. Le joueur 2 n'est qu'un client. La connexion passe par [PeerJS](https://peerjs.com/) et son serveur public gratuit.
  - Délai de 60 s par décision, avec action automatique par défaut.
  - Un joueur 2 déconnecté plus de 30 s fait gagner l'hôte par abandon, et il se reconnecte automatiquement s'il le peut.
  - L'hôte garde l'état de la partie dans `sessionStorage` : recharger sa page reprend la partie.
- **Solo :** même arbitre que l'hôte, l'adversaire est une IA qui garde les dés selon une heuristique et choisit ses faveurs en simulant la manche avec le moteur.

## Lancer le site

Aucune étape de build. Il suffit de publier les fichiers tels quels :

1. Pousser le dossier sur un dépôt GitHub.
2. Dans *Settings > Pages*, choisir la branche et la racine du dépôt.
3. Ouvrir l'adresse fournie par GitHub Pages.

Pour tester en local, servir le dossier avec un petit serveur plutôt que d'ouvrir les fichiers directement, par exemple `python3 -m http.server`.

Le **multijoueur** demande un accès internet (serveur PeerJS public, polices Google). Pour le tester, ouvrir le site dans deux navigateurs ou sur deux appareils : l'un crée un salon, l'autre le rejoint avec le code.

Les noms de dossiers et de fichiers sont sensibles à la casse sur GitHub Pages (`Orlog/`, `Ressource/`).

## Limites connues

- Pas de sauvegarde en solo : recharger la page relance la partie.
- Si l'hôte ferme son onglet en multijoueur, la partie est perdue.
- Certaines connexions peuvent échouer sur des réseaux très restrictifs (pas de serveur TURN).
- Le tutoriel couvre la Frappe de Thor, les jetons dorés et les mains, pas toutes les faveurs.
- L'IA n'utilise pas les options de Tyr, Freyr et Frigg (valeurs par défaut) et n'a pas de niveaux de difficulté.
- Les tests réalisés sont des simulations de parties du moteur et de la logique du solo. L'affichage et le réseau n'ont pas été testés dans un navigateur.
