# Calendar Post-Navigation Design

Date: 2026-11-27
Status: approved — placement and marking decided by the user (2026-11-27)
Mockup: `docs/mockups/calendar-post-navigation.html` (calendrier collé au bord gauche du fil,
démo interactive du clic, testé headless par `scripts/check-calendar-mockup.mjs`)

## Intent

Un calendrier mensuel couvrant l'étendue temporelle du voyage permet de sauter directement aux posts
d'une journée : les dates qui ont des posts sont marquées, un clic scrolle le wall jusqu'à l'article
correspondant.

## Why

Un voyage, c'est des semaines de posts. Aujourd'hui la seule navigation dans le wall est le scroll
manuel plus le tri asc/desc (`SortToggle`) : retrouver « ce qu'on a fait le 20 avril » impose de
défiler toute la page. Le journal est centré sur des journées (la date est choisie par l'auteur à la
création) — un calendrier est la table des matières naturelle du voyage.

## Data (vérifié dans le code)

- `Post` n'a qu'une date : `created_at` (ISO string) — pas de champ « date de voyage » distinct.
  Mais `created_at` est **choisi par l'auteur** à la création (`PostDatePicker` →
  `CreatePostFormContent` envoie `created_at` au POST) et reste éditable (`postRoutes` UPDATE en
  `COALESCE`). C'est donc de facto la date du jour de voyage.
  → **pas de nouveau champ, pas de migration, pas de changement backend.**
- Regroupement par **date locale** (`format(new Date(p.created_at), 'yyyy-MM-dd')`), cohérent avec
  ce que `ListPostCard` affiche (`format(new Date(post.created_at), 'PPP p')`).
- Plusieurs posts le même jour → l'ancre est le **premier post de la journée dans l'ordre affiché**
  (le `sortOrder` courant est respecté) ; les autres posts du jour restent groupés juste dessous.
- L'étendue du voyage = `min(created_at)` → `max(created_at)` des posts **publiés** (les brouillons
  ne comptent pas), arrondie aux mois. Les jours hors étendue sont atténués et non cliquables.
- `react-day-picker` v8 + `date-fns` sont déjà installés ; le composant shadcn
  `src/components/ui/calendar.tsx` existe et la locale date-fns est déjà branchée
  (`getDateFnsLocale`, cf. `PostDatePicker`). Marquage des jours = `modifiers` +
  `modifiersClassNames`, zéro dépendance nouvelle.

## Goals

- **Petit calendrier d'un mois entier, statique, collé au bord gauche de la colonne du wall**
  (`max-w-3xl` centrée) : adjacent direct du fil de posts, pas de grande zone vide ; toujours visible
  pendant le scroll ; **suit la colonne au resize** et se rabat au bord gauche de la fenêtre s'il n'y
  a pas la place (cf. mockup : `left: max(1.5rem, calc(50% - 672px))`, 672 = 384 demi-wall + 264
  calendrier + 24 gap). Le wall reste centré, non décalé.
- Dates avec posts marquées d'un **point discret** dans la couleur du thème (`primary`) ; compte
  exact en info-bulle (`title`/`aria-label` « 20 avril 2025 — 4 posts »).
- **Jour courant = anneau dans la couleur du thème** (c'est le marqueur « où je suis ») : au
  chargement, jour du post le plus haut visible ; pendant le scroll du wall, l'anneau suit le jour
  du post le plus haut visible (première carte dont le bas passe sous la ligne de lecture, ~96 px
  sous le TopBar) ; après un clic sur une date, l'anneau est posé sur ce jour immédiatement.
- Navigation ◀ ▶ entre mois, **bornée aux mois du voyage** (chevrons désactivés aux bornes) ; jours
  hors étendue atténués et non cliquables ; jour dans l'étendue sans post : inerte mais non grisé.
  Le mois affiché ne bascule **pas** automatiquement vers le mois du jour courant (l'anneau
  n'apparaît que si son mois est affiché).
- Mois par défaut à l'ouverture : celui du premier post affiché en haut du wall (le plus récent au
  tri par défaut).
- Clic sur une date : bascule en **vue liste** si nécessaire (même branche que `handlePostClick`
  mobile), puis scroll doux jusqu'au premier post de la journée via le mécanisme **existant**
  `postIdToScrollTo` (effet de `Index.tsx` : `scrollIntoView` + compensation TopBar 64 px), plus une
  **surbrillance temporaire** (anneau `ring-primary` + halo, ~1,6 s) sur la carte ciblée.
- Libellés i18n ; noms de mois/jours via la locale date-fns.

## Non-goals

- **Mobile / petits écrans : explicitement hors périmètre** pour l'instant (pas de version
  responsive du panneau ; caché sous un breakpoint à définir à l'implémentation).
- La reco « popover depuis la rangée de réglages » (ancienne option C) est **retirée** : remplacée
  par le panneau fixe.
- `PublicJourneyPage` : la même mécanique y sera réutilisable, mais ce n'est pas dans ce périmètre.
- Les brouillons (posts publiés seulement).
- Filtre « afficher uniquement ce jour », vue planning/agenda.
- Indicateur permanent « où je suis pendant le scroll » (le calendrier fixe le remplace de facto).

## Approaches considered

Côte à côte dans le premier mockup, sur le voyage de démo « Norvège — Lofoten & Senja » (28 mars →
3 mai 2025, 17 posts sur 10 journées, dont une à 4 posts) :

- **A. Bandeau horizontal sticky** sous le TopBar. Toujours visible, mais consomme 180–260 px de
  hauteur en permanence sur un contenu qui *est* un scroll. *Non retenu.*
- **B. Panneau latéral sticky.** Le plus confortable, mais en conflit avec le `max-w-3xl` →
  `max-w-7xl` du wall à 3 colonnes. *Non retenu en l'état* — c'est lui qui a été revisité.
- **C. Popover depuis un bouton de la rangée de réglages.** Coût nul au repos, mais le calendrier
  n'est pas visible d'emblée et ne dit pas « où je suis » pendant le scroll. *D'abord recommandé,
  puis écarté par la décision utilisateur du 2026-11-27.*
- **D. Petit calendrier fixe, collé au fil des posts (retenu).** Un mois compact (≈ 264 px) en
  `position: fixed`, bord gauche aligné sur le bord gauche de la colonne du wall, toujours visible
  pendant le scroll sans consommer de hauteur de scroll. Simple, un seul code path desktop. C'est
  ce que montre le mockup. *(v2 : flottant loin à gauche avec le wall décalé — écarté au retour
  utilisateur du 2026-11-27 : le calendrier doit être adjacent direct du thread.)*

## Decisions

- **Placement : panneau fixe collé au bord gauche du fil** (retour utilisateur 2026-11-27, après la
  v2 flottante) — `left: max(1.5rem, calc(50% - 672px))` : suit la colonne `max-w-3xl` centrée au
  resize, se rabat au bord de la fenêtre s'il n'y a pas la place. Le padding symétrique du
  conteneur d'Index annule l'effet du `p-8` : le bord gauche du wall reste à `50% - 384px`, le même
  calcul tient donc pour l'app. Remplace la reco popover.
- **Marquage : jours à posts = point discret** (5 px, `primary`) ; **jour courant = anneau dans la
  couleur du thème** (+ fond `accent`, numéro en gras). Retour utilisateur 2026-11-27 : l'anneau
  devient le marqueur « où je suis », il n'est plus le marqueur « il y a des posts ». Compte exact
  en info-bulle/`aria-label`.
- **Jour courant : suit le scroll** — jour du post le plus haut visible (première carte dans l'ordre
  d'affichage dont le bas passe sous la ligne de lecture, ~96 px sous le TopBar sticky) ; au
  chargement c'est le post du haut ; un clic sur une date le pose immédiatement (le scroll de
  confirmation arrive ensuite). Dans le mockup : listener `scroll` direct (17 cartes, coût nul) ;
  dans l'app, throttler (rAF) ou `IntersectionObserver`.
- **Le mois affiché ne bascule pas automatiquement** vers le mois du jour courant — l'anneau
  n'apparaît que si son mois est affiché. Volontairement simple pour la v1.
- **Ancre : premier post de la journée dans l'ordre affiché**, `sortOrder` respecté.
- **Surbrillance de la carte ciblée : anneau + halo ~1,6 s** sur la carte (`ring-2 ring-primary`
  via le prop `className` existant de `ListPostCard`), retirée par timeout.
- **Mobile : hors périmètre** — pas de popover plein écran, pas de Drawer ; le panneau sera
  simplement masqué sous un breakpoint à définir.
- **Étendue navigable : les mois du voyage uniquement** (chevrons bornés, jours hors étendue
  atténués) — on ne peut pas se perdre en 2019.

## Left to the builder

- Style exact des marqueurs avec les tokens react-day-picker (`modifiersClassNames`) : point
  discret pour `hasPosts`, anneau + fond pour `current`, à caler sur le rendu du mockup
  (`.day.has::after` 5 px, `.day.current` `border: 2px solid hsl(var(--primary))`).
- Suivi du jour courant dans l'app : listener `scroll` throttlé rAF ou `IntersectionObserver` sur
  les cartes du wall — la ligne de lecture (~96 px sous le TopBar) est à caler sur la vraie hauteur
  du TopBar.
- Comportement « jour courant dans un autre mois que celui affiché » : v1 = rien (anneau invisible
  tant que le mois n'est pas affiché) ; envisageable ensuite : auto-switch de mois discret ou
  indicateur « vous êtes en avril ».
- Breakpoint sous lequel le panneau est masqué (contrainte : hors périmètre mobile, donc simplement
  caché, pas d'alternative) ; en fenêtre étroite le panneau se rabat au bord gauche de la fenêtre et
  peut chevaucher le bord du wall (cf. mockup) — à arbitrer à l'implémentation.
- Durée fine de la surbrillance (1,6 s au mockup) et gestion du timeout au démontage.

## Mockup history

- v1 (commit 4420320) : trois placements côte à côte + popover reco. **Cassée en navigateur** : le
  script référençait des identifiants globaux (`wall_a`, `pop_cal`, …) que le named-access du
  navigateur ne résout pas (ids en tirets `wall-a` dans le markup) → `ReferenceError` dès
  `renderWall(wall_a, …)`, tout le contenu peint par le JS restait vide. Reprouvé headless par
  `scripts/check-calendar-mockup.mjs /path/to/v1.html`.
- v2 (commit 86672ce) : panneau fixe haut-gauche flottant, wall décalé de 316 px, jours à posts
  entourés. Thème = vraie page rendue (tokens `globals.css` vanilla consommés comme
  `tailwind.config.ts`), démo interactive, vérifiée headless.
- v3 (retour utilisateur 2026-11-27) : calendrier **collé au bord gauche du fil** (suit la colonne
  au resize, se rabat au bord de la fenêtre), jours à posts = **point discret**, **jour courant =
  anneau couleur du thème suivant le scroll** (chargement, scroll simulé, re-render du mois, clic —
  tout vérifié headless par `scripts/check-calendar-mockup.mjs`).
