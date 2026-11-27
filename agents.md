# Matka — repo context for agents

Travel-journal app: users record journeys and posts (photos, videos, coordinates),
displayed on a wall. Frontend React 18 + TypeScript + Vite + shadcn/ui + Tailwind;
backend Fastify + Postgres under `backend/`. Frontend rules live in `AI_RULES.md`
(source in `src/`, pages in `src/pages/`, routes in `src/App.tsx`, shadcn components
in `src/components/ui/` are not edited — wrap them instead).

## Where things live

- `src/pages/Index.tsx` — the wall: `viewMode` state (`'list' | 'grid' | 'map'`) picks
  the card style; `columnCount` (`1 | 2 | 3`) sets the list-view columns.
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
- `src/utils/mediaLayout.ts` — pure geometry of the block chart (no React, no DOM).
- `backend/src/routes/` — Fastify routes: `journeyRoutes`, `postRoutes`,
  `mediaRoutes`, `publicJourneyRoutes`, `userRoutes`, `protectedUserRoutes`.
- `docs/superpowers/` — design specs and plans; `docs/mockups/` — HTML mockups.
  `docs/mockups/post-media-fill-options.html` is the reference for the media frame;
  its option-B geometry is historical (it still implements the old "natural row
  height closest to the frame" cost) — `src/utils/mediaLayout.ts` and the spec
  are authoritative.

## Checks

- `npm run check:layout` — unit-checks `mediaLayout` geometry via
  `scripts/check-media-layout.mjs`.
- `npx tsc --noEmit -p tsconfig.app.json` — type-check.
- `npm run build` — production build. `npm run lint` — ESLint.
- `npm run dev` — Vite dev server on port **8080** (set in both `package.json`
  and `vite.config.ts`).

## Media-frame conventions (list view, branch `feat/post-media-block-chart`)

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
