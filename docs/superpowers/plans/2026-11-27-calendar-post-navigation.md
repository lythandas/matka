# Calendar Post-Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un petit calendrier d'un mois, statique, fixé en haut à gauche de la page (desktop uniquement, mobile hors périmètre), borné aux mois du voyage ; les dates avec posts sont entourées d'un anneau dans la couleur du thème, un clic scrolle jusqu'au premier post de la journée et le surligne brièvement.

**Architecture:** Le regroupement post→date est une fonction pure (`src/utils/postDates.ts`) prouvée par un script de check node sans dépendance (même astuce esbuild que `check:layout`). Le calendrier est un composant d'enveloppe (`src/components/PostCalendarPanel.tsx`) autour du `Calendar` shadcn existant (react-day-picker v8), rendu en panneau fixe haut-gauche — pas de popover — les fichiers de `src/components/ui/` ne sont jamais édités (AI_RULES). Le panneau vit dans `Index.tsx`, qui réutilise le mécanisme existant `postIdToScrollTo` (effet de scroll + compensation TopBar 64 px).

**Tech Stack:** React 18 + TypeScript, Tailwind CSS, shadcn/ui `Calendar` (react-day-picker v8), date-fns v3 (déjà installés — aucune dépendance nouvelle).

**Spec:** `docs/superpowers/specs/2026-11-27-calendar-post-navigation-design.md`
**Mockup (panneau fixe haut-gauche + démo interactive du clic, testé headless) :** `docs/mockups/calendar-post-navigation.html` — vérifiable par `node scripts/check-calendar-mockup.mjs`

## Global Constraints

- Aucune dépendance nouvelle : `react-day-picker`, `date-fns`, `Calendar` sont déjà en place.
- Ne pas éditer `src/components/ui/*` : tout stylage du calendrier passe par une enveloppe et des classes Tailwind/`modifiersClassNames`.
- Données : `post.created_at` uniquement (choisie par l'auteur via `PostDatePicker`) — pas de nouveau champ, pas de backend. Regroupement en **date locale**, cohérent avec l'affichage des cartes.
- Posts **publiés** seulement (`posts`, jamais `drafts`) ; ancre = premier post de la journée **dans l'ordre affiché** (`sortOrder` respecté).
- `npx tsc --noEmit -p tsconfig.app.json` est propre aujourd'hui : il doit le rester.
- Commits Conventional Commits ; pas de `git push` sans go explicite.

## Review Focus

Comportement que la spec implique mais qu'aucun test ne épingle directement — à vérifier à l'œil dans l'app (Task 5) :

- **Voyage multi-mois :** les chevrons passent de mois en mois et se désactivent aux bornes ; les jours hors étendue du voyage sont atténués et non cliquables ; un jour dans l'étendue sans post reste actif visuellement mais inerte.
- **Plusieurs posts le même jour :** le scroll s'arrête sur le **premier** de la journée dans l'ordre affiché ; avec `sortOrder = 'asc'`, c'est le plus ancien du jour.
- **Clic depuis la vue grille ou carte :** bascule en liste d'abord, puis scroll (le post ciblé est bien à l'écran après la bascule, pas scrollé avant le rendu de la liste).
- **Surbrillance :** l'anneau apparaît après l'arrêt du scroll et disparaît en ~1,6 s ; pas d'anneau fantôme si on re-clique une autre date rapidement.
- **Panneau fixe :** il reste en haut à gauche pendant tout le scroll ; le wall n'est jamais recouvert ; à `columnCount` 2/3 le décalage tient toujours (cf. Left to the builder de la spec).
- **Locale :** noms de mois/jours suivent la langue de l'utilisateur (fr/en/de/es).
- **Journey sans post :** pas de panneau calendrier (rien à naviguer).

## File Structure

- Create `src/utils/postDates.ts` — pur : clé de date locale, regroupement, étendue mensuelle du voyage.
- Create `scripts/check-post-dates.mjs` — assertions sur l'util transpilé.
- Modify `package.json` — ajouter le script `check:dates`.
- Create `src/components/PostCalendarPanel.tsx` — panneau fixe haut-gauche + calendrier marqué, enveloppe de `ui/calendar`.
- Modify `src/pages/Index.tsx` — rendu du panneau, décalage du wall, handler de clic, état de surbrillance.
- Modify `public/locales/{fr,en,de,es}/translation.json` — clés i18n.
- Modify `agents.md` — conventions calendrier (une ligne).

---

### Task 1: Regroupement post→date + check harness

**Files:**
- Create: `src/utils/postDates.ts`
- Create: `scripts/check-post-dates.mjs`
- Modify: `package.json` (ajouter `scripts.check:dates`)

**Interfaces:**
- Consumes: rien.
- Produces:
  ```ts
  /** 'yyyy-MM-dd' en heure locale — cohérent avec ce que ListPostCard affiche. */
  export function dateKey(iso: string): string
  /** dateKey → ids des posts, dans l'ordre du tableau reçu (l'ordre affiché). */
  export function groupPostsByDate(posts: { id: string; created_at: string }[]): Map<string, string[]>
  /** Mois contenant le plus ancien post → mois contenant le plus récent ; null si vide. */
  export function journeyMonthRange(posts: { created_at: string }[]): { startMonth: Date; endMonth: Date } | null
  /** Premier id du jour dans l'ordre du groupe ; null si le jour n'existe pas. */
  export function firstPostIdForDate(group: Map<string, string[]>, dateKey: string): string | null
  ```

- [ ] **Step 1: Write the failing check script** `scripts/check-post-dates.mjs`. Il épingle `process.env.TZ = 'Europe/Paris'` **avant** d'importer l'util transpilé (`../node_modules/.cache/post-dates.mjs`), puis assert avec `node:assert` :
  - `dateKey('2025-04-20T23:30:00Z')` → `'2025-04-21'` (frontière UTC→local : 23:30Z = lendemain à Paris) et `dateKey('2025-04-20T10:00:00Z')` → `'2025-04-20'` ;
  - `groupPostsByDate` : 3 posts dont 2 le même jour → 2 clés, la clé du jour double contient les 2 ids **dans l'ordre du tableau** ; tableau vide → Map vide ;
  - `journeyMonthRange` sur `['2025-03-28T08:00:00Z', '2025-05-03T17:00:00Z']` → `{ startMonth: 1er mars 2025, endMonth: 1er mai 2025 }` (dates au premier du mois, mois local) ; tableau vide → `null` ;
  - `firstPostIdForDate` → premier id du jour ; jour absent → `null`.
  Finir par `console.log("postDates: ok")`.

- [ ] **Step 2: Add the npm script** to `package.json` :
  `"check:dates": "esbuild src/utils/postDates.ts --format=esm --outfile=node_modules/.cache/post-dates.mjs --log-level=error && node scripts/check-post-dates.mjs"`

- [ ] **Step 3: Run it to verify it fails** — `npm run check:dates`. Expected: esbuild error `Could not resolve "src/utils/postDates.ts"`.

- [ ] **Step 4: Implement `src/utils/postDates.ts`** avec les signatures exactes ci-dessus. `dateKey` = `format(new Date(iso), 'yyyy-MM-dd')` (date-fns, heure locale) ; garde `Invalid Date` → `''`. `journeyMonthRange` prend `startOfMonth(new Date(min))` / `endOfMonth`→`startOfMonth` du max. Pas de React, pas de DOM.

- [ ] **Step 5: Run it to verify it passes** — `npm run check:dates`. Expected: `postDates: ok`, exit 0.

- [ ] **Step 6: Commit** — `git add src/utils/postDates.ts scripts/check-post-dates.mjs package.json` puis commit `feat(posts): add post-to-date grouping and journey month range math`.

---

### Task 2: PostCalendarPanel (enveloppe du Calendar shadcn, panneau fixe)

**Files:**
- Create: `src/components/PostCalendarPanel.tsx`

**Interfaces:**
- Consumes: `groupPostsByDate`, `journeyMonthRange`, `dateKey` (Task 1) ; `Calendar` de `@/components/ui/calendar`, `getDateFnsLocale`, `useTranslation`, `cn`.
- Produces:
  ```ts
  interface PostCalendarPanelProps {
    posts: Post[];                      // posts publiés, dans l'ordre affiché
    onDateSelect: (dateKey: string, firstPostId: string) => void;
  }
  ```
  et `PostCalendarPanel` en export par défaut. Référence de rendu : le mockup
  `docs/mockups/calendar-post-navigation.html` (panneau fixe haut-gauche).

- [ ] **Step 1: Implement the component.**
  - `group = useMemo(() => groupPostsByDate(posts), [posts])` ; `range = useMemo(() => journeyMonthRange(posts), [posts])`.
  - Panneau : conteneur `fixed` haut-gauche (`top: 6rem; left: 1.5rem` au mockup, largeur ≈ 264 px, `Card` + bordure + ombre assorties au wall), `aria-label` i18n. Non rendu si `posts.length === 0`. **Desktop uniquement** : masqué sous le breakpoint choisi (mobile hors périmètre — cf. spec), p. ex. `hidden lg:block`.
  - `Calendar` `mode="single"` (aucune sélection persistante : `selected` non contrôlé, `onSelect` intercepté), `locale={getDateFnsLocale()}`, `fromMonth={range.startMonth}` / `toMonth={range.endMonth}`, `month` contrôlé (state interne, défaut = `startOfMonth` du **premier post du tableau** — l'ordre affiché) + `onMonthChange`, `fixedWeeks`, style compact du mockup (cellules ~2rem).
  - `modifiers={{ hasPosts: datesDuGroupe }}` (une `Date` locale par clé, construite à midi pour éviter tout glissement frontière) et `modifiersClassNames={{ hasPosts: '... rounded-full ring-2 ring-primary font-semibold cursor-pointer hover:bg-primary/20' }}` — **jour entouré d'un anneau dans la couleur du thème** (remplace le point de la v1), calé sur le mockup ; jour hors étendue atténué et non cliquable.
  - Chaque jour marqué : `title` et `aria-label` « {date PPP} — {n} post(s) » (clé i18n avec interpolation `count`).
  - `onSelect(date)` → `key = dateKey(date.toISOString())` ; `firstPostIdForDate(group, key)` ; si trouvé : `onDateSelect(key, firstPostId)` (pas de fermeture de popover : le panneau est permanent) ; jour sans post : ignorer.

- [ ] **Step 2: Typecheck and lint** — `npx tsc --noEmit -p tsconfig.app.json && npx eslint src/components/PostCalendarPanel.tsx`. Expected: exit 0 both.

- [ ] **Step 3: Commit** — commit `feat(posts): add fixed calendar panel with post-date ring markers`.

---

### Task 3: Wire into Index.tsx (panneau, décalage du wall, scroll, surbrillance)

**Files:**
- Modify: `src/pages/Index.tsx`

**Interfaces:**
- Consumes: `PostCalendarPanel` (Task 2).

- [ ] **Step 1: Render the panel** au-dessus/à côté du wall (le wall est décalé d'un `padding-left` pour ne jamais passer sous le panneau fixe — valeur du mockup : 316 px desktop). Passé `posts={displayedPosts}` (l'ordre trié courant) et `onDateSelect={handleCalendarDateSelect}`. Non rendu quand `displayedPosts.length === 0`.

- [ ] **Step 2: Implement the handler** — même squelette que la branche mobile de `handlePostClick` :
  ```ts
  const handleCalendarDateSelect = (_key: string, postId: string) => {
    if (viewMode !== 'list') setViewMode('list');
    setPostIdToScrollTo(postId);            // effet existant : scrollIntoView + offset TopBar 64px
    setHighlightedPostId(postId);           // Step 3
  };
  ```
  Noter la dépendance : l'effet de scroll existant dépend déjà de `viewMode` et `posts` — vérifier que le scroll part bien **après** le rendu de la liste quand on vient de la vue carte/grille (le `setTimeout(100)` de l'effet suffit en pratique ; sinon attendre `viewMode === 'list'` dans l'effet, ce qu'il fait déjà).

- [ ] **Step 3: Add the highlight state** — `const [highlightedPostId, setHighlightedPostId] = useState<string | null>(null)` ; un `useEffect` sur `highlightedPostId` pose un `setTimeout` de 1600 ms qui le remet à `null` (cleanup au démontage/changement). Sur le `ListPostCard` ciblé du rendu liste : `className={cn(columnCount > 1 ? 'mb-0' : undefined, post.id === highlightedPostId && 'ring-2 ring-primary ring-offset-2 ring-offset-background transition-shadow')}` — le prop `className` existe déjà et l'anneau disparait avec l'état (pas d'animation halo en v1 : l'anneau suffit, le mockup montre la cible).

- [ ] **Step 4: Verify the build** — `npx tsc --noEmit -p tsconfig.app.json && npm run build && npm run check:dates`. Expected: exit 0 partout.

- [ ] **Step 5: Commit** — commit `feat(posts): navigate the wall by date from a fixed calendar panel`.

---

### Task 4: i18n

**Files:**
- Modify: `public/locales/fr/translation.json`, `en`, `de`, `es`

- [ ] **Step 1: Add the keys** (reprendre l'existant du namespace `indexPage`) :
  - `indexPage.calendarPanel` — aria-label du panneau (fr : « Calendrier du voyage », en : « Journey calendar », de : « Reisekalender », es : « Calendario del viaje ») ;
  - `indexPage.dayWithPosts` — info-bulle des jours marqués, avec `{{date}}` et `{{count}}` (fr : « {{date}} — {{count}} post » / pluriel « posts » via les formes i18next `_one`/`_other` si le fichier les utilise déjà, sinon forme simple).

- [ ] **Step 2: Typecheck** (les JSON ne sont pas typés, mais `npm run build` les valide au chargement i18next-http-backend) — `npx tsc --noEmit -p tsconfig.app.json && npm run build`. Expected: exit 0.

- [ ] **Step 3: Commit** — commit `feat(posts): add i18n keys for calendar navigation`.

---

### Task 5: Verification walkthrough + housekeeping

**Files:**
- Modify: `agents.md`

- [ ] **Step 1: Run the app and walk the Review Focus list** — `npm run dev` (port 8080). Sur un voyage multi-mois : mois par défaut = celui du post du haut ; chevrons bornés ; jours hors voyage atténués ; jour dans l'étendue sans post inerte ; clic sur un jour à 2+ posts → ancre sur le premier selon le tri courant ; tri inversé puis re-clic → ancre sur l'autre post ; clic depuis la vue carte et la vue grille → bascule liste + scroll + anneau 1,6 s ; re-clic rapide sur une autre date → un seul anneau actif ; le panneau reste fixe pendant le scroll et le wall ne passe jamais dessous ; `columnCount` 1→3 ; langue en (noms de mois anglais) ; voyage vide → pas de panneau. Reporter ce qui a été vu avant de déclarer le fait.

- [ ] **Step 2: Update `agents.md`** — ajouter aux conventions une ligne : navigation par date = `PostCalendarPanel` (panneau fixe haut-gauche, desktop only, `postDates.ts` pour le regroupement, ancre = premier post du jour dans l'ordre affiché, marquage = anneau `ring-primary`, surbrillance 1,6 s), et `check:dates` dans les Checks.

- [ ] **Step 3: Commit** — commit `chore(docs): document calendar navigation conventions in agents.md`.

- [ ] **Step 4: Report.** Push/merge : le contrôleur demande au partenaire humain. Le mockup est testé headless (`node scripts/check-calendar-mockup.mjs`) ; le breakpoint de masquage mobile reste à choisir à l'implémentation — cf. spec, section Left to the builder.
