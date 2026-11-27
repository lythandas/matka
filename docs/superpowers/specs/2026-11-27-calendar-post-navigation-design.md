# Calendar Post-Navigation Design

Date: 2026-11-27
Status: pending approval (placement to confirm — see Decisions)
Mockup: `docs/mockups/calendar-post-navigation.html` (option C recommandée, démo interactive du clic)

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

- Calendrier mensuel borné à l'étendue réelle du voyage, navigation ◀ ▶ entre mois (chevrons
  désactivés aux bornes).
- Dates avec posts marquées d'un **point** sous le numéro ; compte exact en info-bulle
  (`title`/`aria-label` « 20 avril 2025 — 4 posts »).
- Mois par défaut à l'ouverture : celui du premier post affiché en haut du wall (le plus récent au
  tri par défaut).
- Clic sur une date : fermeture du popover, bascule en **vue liste** si nécessaire (même branche que
  `handlePostClick` mobile), puis scroll doux jusqu'au premier post de la journée via le mécanisme
  **existant** `postIdToScrollTo` (effet de `Index.tsx` : `scrollIntoView` + compensation TopBar
  64 px), plus une **surbrillance temporaire** (anneau `ring-primary` + halo, ~1,6 s) sur la carte
  ciblée.
- Un seul code path desktop/mobile ; libellés i18n ; noms de mois/jours via la locale date-fns.

## Non-goals

- `PublicJourneyPage` : la même mécanique y sera réutilisable, mais ce n'est pas dans ce périmètre.
- Les brouillons (posts publiés seulement).
- Filtre « afficher uniquement ce jour », vue planning/agenda.
- Conserver le popover ouvert après le clic (il se referme : la navigation est un acte ponctuel).
- Indicateur permanent « où je suis pendant le scroll » (évolution possible, cf. option B).

## Approaches considered

Côte à côte dans le mockup, sur le voyage de démo « Norvège — Lofoten & Senja » (28 mars → 3 mai
2025, 17 posts sur 10 journées, dont une à 4 posts) :

- **A. Bandeau horizontal sticky** sous le TopBar (avec variante « ruban » ≈ 56 px). Toujours
  visible, mais consomme 180–260 px de hauteur en permanence sur un contenu qui *est* un scroll,
  s'empile sur la TabsList + rangée de réglages, et n'affiche qu'un mois à la fois. *Non retenu.*
- **B. Panneau latéral sticky** (la classe `.sticky-calendar` existe déjà, orpheline, dans
  `globals.css`). Le plus confortable, mais le wall passe de `max-w-3xl` à `max-w-7xl` selon
  `columnCount` : à 3 colonnes il n'y a plus de place, le panneau disparaît sous xl, deux layouts à
  maintenir, pas de version mobile naturelle. *Non retenu* — bon candidat pour un futur « mode
  lecture » à colonne unique.
- **C. Popover depuis un bouton de la rangée de réglages** (à côté de `SortToggle` /
  `ColumnToggle`). Coût nul au repos quel que soit `columnCount`, un seul code path, réutilise le
  `Calendar` shadcn et le popover déjà en place dans `PostDatePicker`, et le mécanisme de scroll
  existe déjà. **Recommandé.**

## Decisions

- **Placement : C recommandé** — *décision humaine requise* (A et B restent réalisables ; le mockup
  montre les trois). Argument : la navigation par date est un acte ponctuel, pas un compagnon
  permanent ; C n'impose rien au layout existant et couvre mobile sans composant dédié.
- **Marquage : point unique** sous le numéro (variantes pastille-de-compte et fond-rempli montrées
  dans le mockup, écartées : charge visuelle / lisibilité en cellule 38 px). Compte exact en
  info-bulle.
- **Ancre : premier post de la journée dans l'ordre affiché**, `sortOrder` respecté.
- **Surbrillance : anneau + halo ~1,6 s** sur la carte (`ring-2 ring-primary` via le prop
  `className` existant de `ListPostCard`), retirée par timeout.
- **Mobile : même popover**, pleine largeur moins marges, cellules compactes ; pas de Drawer dédié
  (second pattern à maintenir pour un calendrier qui tient déjà).
- **Étendue navigable : les mois du voyage uniquement** (chevrons bornés, jours hors étendue
  atténués) — on ne peut pas se perdre en 2019.

## Left to the builder

- Style exact du point et de l'état survolé avec les tokens react-day-picker
  (`modifiersClassNames`), à caler sur le rendu du mockup.
- Placement exact du déclencheur dans la rangée de réglages (groupe de gauche avec
  `SortToggle`/`ColumnToggle`, vs groupe de droite) — reprendre le mockup : groupe de gauche.
- Durée fine de la surbrillance (1,6 s au mockup) et gestion du timeout au démontage.
