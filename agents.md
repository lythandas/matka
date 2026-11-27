# Matka — repo context for agents

Travel-journal app: users record journeys and posts (photos, videos, coordinates),
displayed on a wall. Frontend React 18 + TypeScript + Vite + shadcn/ui + Tailwind;
backend Fastify + Postgres under `backend/`. Frontend rules live in `AI_RULES.md`
(source in `src/`, pages in `src/pages/`, routes in `src/App.tsx`, shadcn components
in `src/components/ui/` are not edited — wrap them instead).

## Where things live

- `src/pages/Index.tsx` — the wall: `viewMode` state (`'list' | 'grid' | 'map'`) picks
  the card style; the list view is a single `max-w-3xl` column (the multi-column
  selector was rolled back on 2026-11-27).
- `src/components/ListPostCard.tsx` — list-view post card; renders
  `PostMediaFrame` for media, a fixed 4:3 `MapComponent` frame when the post only
  has coordinates.
- `src/components/GridPostCard.tsx` — grid-view post card (no block chart).
- `src/components/PostDetailDialog.tsx` — post detail modal opened from a card.
- `src/components/PostMediaFrame.tsx` — the block-chart media frame (below).
- `src/hooks/useMediaRatios.ts` — measures the aspect ratio of each photo URL the
  card can actually render, once, in a module-level cache shared across cards;
  off-screen cards measure nothing (IntersectionObserver-gated), the last
  in-flight measurement is aborted when its last card stops waiting, and
  unmeasured photos fall back to 4:3.
- `src/utils/mediaUrls.ts` — maps an `/uploads/…` image URL to its downscaled
  `/thumbs/…w800…` variant (unchanged URL when it can't be mapped).
- `src/utils/imagePreloader.ts` + `src/hooks/useImagePreload.ts` — module-level
  background preloader (max 2 concurrent, `fetchPriority=low`, dedup) fed at
  idle time by cards in view, so PostDetailDialog's full-resolution images are
  already in the browser cache.
- `src/hooks/useInViewOnce.ts` — once-only IntersectionObserver gate for cards
  that don't render a PostMediaFrame (GridPostCard).
- `src/utils/mediaLayout.ts` — pure geometry of the block chart (no React, no DOM).
- `backend/src/routes/` — Fastify routes: `journeyRoutes`, `postRoutes`,
  `mediaRoutes`, `publicJourneyRoutes`, `userRoutes`, `protectedUserRoutes`.
- `docs/superpowers/` — design specs and plans; `docs/mockups/` — HTML mockups.
  `docs/mockups/post-media-fill-options.html` is the reference for the media frame;
  its option-B geometry is historical (it still implements the old "natural row
  height closest to the frame" cost) — `src/utils/mediaLayout.ts` and the spec
  are authoritative.
- `docs/mockups/calendar-post-navigation.html` + spec/plan
  `2026-11-27-calendar-post-navigation*` — calendar navigation by post date,
  **implemented** (2026-11-27, commits ce178fe..db59894):
  - `src/utils/postDates.ts` — pure grouping (local-date key, month range,
    first post of a day in displayed order), pinned by `npm run check:dates`.
  - `src/components/PostCalendarPanel.tsx` — fixed one-month panel glued to
    the left edge of the centered `max-w-3xl` wall column
    (`left: max(1.5rem, calc(50% - 650px))`: 384 half-wall + 242 panel +
    24 gap; follows the column on resize, falls back to the window edge).
    Wrapper around the shadcn `Calendar` (react-day-picker v8, `ui/` never
    edited): compact 32px round cells, `modifiersClassNames` for the markers
    (days with posts = discreet `primary` dot; current day = theme-color ring
    + accent bg), `fromMonth`/`toMonth` bound the chevrons to the journey
    months, days outside the journey extent are disabled, days without posts
    are inert. Custom `Day` component (via `useDayRender`) adds the per-day
    `title`/`aria-label` (« date — n posts »).
  - `src/pages/Index.tsx` — renders the panel (`key={journey.id}`) and tracks
    the topmost visible post: window `scroll` throttled by rAF, reading line
    at 96px (real TopBar ~72px + margin); the anchor on date click reuses the
    existing `postIdToScrollTo` effect (list-view switch first, then scroll +
    ~1.6 s `ring-primary` highlight on the card, timer reset on re-click).
  - **Auto-switch of the displayed month** only on a genuine month change of
    the current day (effect keyed on the current day's month, not on the
    displayed month) — manual chevron browsing is never parasited, no timer.
  - **Desktop only**: hidden below `xl` (1280px) — above xl the panel's right
    edge exactly touches the cards' left edge, so it never overlaps; mobile
    is out of scope (spec). i18n keys `indexPage.calendarPanel` /
    `indexPage.dayWithPosts` in the four locales. The mockup itself (v1–v4
    history: browser break of v1, v2 floated, v3 glued per user feedback)
    remains checked headless by `scripts/check-calendar-mockup.mjs`.

## Checks

- `npm run check:layout` — unit-checks `mediaLayout` geometry via
  `scripts/check-media-layout.mjs`.
- `npm run check:dates` — unit-checks `postDates` grouping via
  `scripts/check-post-dates.mjs` (esbuild + node:assert, TZ pinned).
- `node scripts/check-calendar-mockup.mjs` — headless check of the calendar
  mockup (static references + emulated-DOM execution + behaviour assertions).
- `npx tsc --noEmit -p tsconfig.app.json` — type-check.
- `npm run build` — production build. `npm run lint` — ESLint.
- `npm run dev` — Vite dev server on port **8080** (set in both `package.json`
  and `vite.config.ts`).

## Media-frame conventions (list view)

- One fixed **4:3 frame** per post card (`FRAME_RATIO`, `frameHeight` in
  `mediaLayout.ts`); all the post's photos tile inside it as a justified block
  chart.
- Block widths are proportional to each photo's **measured aspect ratio**
  (`useMediaRatios`); row heights vary so the frame is covered exactly.
- The **row count maximises the photos' visible area** (mean visible source
  fraction under `object-cover`, ties to fewer rows) — crop-minimal, not
  frame-height matching; `check:layout` pins the floors per case.
- Max **7 blocks** per frame; **4 blocks** below 480 px frame width
  (`MAX_MEDIA_BLOCKS`, `MAX_MEDIA_BLOCKS_NARROW`, `NARROW_FRAME_PX`).
- **4 px gutters** between blocks (`DEFAULT_GAP`).
- Block order = `media_items` order (block *i* is photo *i*).
- Photos beyond the cap are counted by a `+N` dark veil on the last block.
- A video plays in the frame only when the post has **no image at all** —
  `object-contain` on the black frame, `controls` kept (whole video visible).
  On a mixed `[video, photo]` post the photos win on the card and the video is
  played from the detail dialog (accepted loss).

## Image downscaling & background preloading

Design spec: `docs/superpowers/specs/2026-11-27-image-downscaling-design.md`.
Rules that later changes must keep:

- **Thumbnails**: cards display `thumbnailUrl()` (800 px wide) instead of the
  original — list via PostMediaFrame, grid via GridPostCard. The backend route
  `GET /thumbs/:fileName` (`backend/src/routes/thumbnailRoutes.ts`) derives the
  source from the file name (`abc-original.jpg.w800.jpg` → the `abc-original.jpg`
  upload), generates with sharp on first request (EXIF-rotated,
  `withoutEnlargement`), and caches in `UPLOADS_PATH/thumbs/` (temp+rename, so
  concurrent requests race safely). Served `immutable` for a year.
- **One width only** (800, `THUMBNAIL_WIDTH` on both sides): URLs are
  content-addressed, an open width parameter would let anyone spray the disk
  with variants. PNG stays PNG (alpha), svg/gif redirect to the original, other
  formats become JPEG q75 mozjpeg flattened on white. Unprocessable sources
  fall back to a redirect to the original, never a hard 500.
- **Public by design**: `/thumbs` sits outside the authenticated scope, same
  model as the `/uploads` static serving (UUID = capability token). Don't put
  it behind auth without doing the same for `/uploads`.
- **Ratios**: `useMediaRatios` measures the thumbnail URLs — fine, the backend
  only shrinks (never crops), so the aspect ratio is identical. A failed
  thumbnail (backend not upgraded, generation failed) makes the card `<img>`
  retry the **original** URL before ever showing the placeholder — a frontend
  deploy ahead of the backend degrades to today's behaviour, not to blank
  cards.
- **Preloading**: PostMediaFrame/GridPostCard call `useImagePreload` with the
  full-resolution URLs (`large ?? original`, what PostDetailDialog shows),
  gated on the card being near the viewport and scheduled via
  `requestIdleCallback` (2 s timeout; `setTimeout` fallback for Safari). The
  preloader caps at 2 concurrent low-priority downloads, dedups, and never
  aborts a started download — the viewport gate + cap is the bandwidth guard.
  Photos beyond the block cap are *not* preloaded (dialog fetches on demand).
- Upload route unchanged: `mediaInfo.urls` still points everything at the
  original; the frontend derives thumbnails client-side, so legacy DB rows and
  new uploads behave identically.
