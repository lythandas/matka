# Post Media Block-Chart Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In list view, every post shows all its photos inside one fixed 4:3 frame, tiled as a justified block chart, capped at 7 blocks with the rest counted in a small "+N".

**Architecture:** Geometry is a pure function (`src/utils/mediaLayout.ts`) proven by a dependency-free node check script that runs the same file esbuild already installed by Vite. Photo aspect ratios are measured in the browser and cached per URL (`src/hooks/useMediaRatios.ts`). Rendering lives in one component (`src/components/PostMediaFrame.tsx`) that measures its own width with a `ResizeObserver` — so the frame is identical for every post at a given column width. `ListPostCard` replaces its masonry / single-image / video / map branches with that one frame.

**Tech Stack:** React 18 + TypeScript, Tailwind CSS, Vite (esbuild reused for the check script), shadcn/ui `Card`.

**Spec:** `docs/superpowers/specs/2026-11-27-post-media-block-chart-design.md`
**Mockup of the chosen layout:** `docs/mockups/post-media-fill-options.html`, option B.

## Global Constraints

- No new npm dependency: the check script transpiles the util with the `esbuild` binary already in `node_modules/.bin` (pulled in by Vite).
- Source layout per `AI_RULES.md`: components in `src/components/`, hooks in `src/hooks/`, utils in `src/utils/`; routes in `src/App.tsx` untouched.
- Styling with Tailwind classes; keep the existing `Card` / `CardContent` structure of `ListPostCard` untouched.
- Frame ratio `4 / 3`; gutter between blocks `4` px (today's `columnGap`); max blocks `7`, or `4` when the measured frame is narrower than `480` px.
- Block order follows `post.media_items` order — never re-sort photos.
- `npx tsc --noEmit -p tsconfig.app.json` is clean today (verified 2026-11-27, exit 0): it must stay clean.
- Conventional-commit messages; no `git push` without the user's explicit go.

## Review Focus

Behaviour the spec implies but no task's tests pin directly — check each by eye in the running app (Task 4, Step 5):

- **8+ photos:** 7 blocks are shown and the veil reads exactly `+N` (8 → `+1`, 13 → `+6`).
- **Coordinates and no media:** the map fills the same 4:3 frame; **no media and no coordinates** renders no frame at all (no empty black box).
- **Unloadable image URL:** its block keeps its size and the `onError` fallback `/placeholder.svg` shows — the rest of the chart does not move.
- **Extreme ratios** (21:9 panorama or 9:16 among 7 photos): no zero-width/height block and nothing drawn outside the frame.
- **Width measured as 0 on first paint** (card mounted hidden, or before layout): no `NaN` geometry — one full-frame block until the width is real.
- **Ratios arriving late:** the frame's outer size never changes while inner blocks re-tile (no page reflow, only inner movement).
- **`columnCount` 1→3 / window resize:** blocks follow the new width, no stale absolute positions.

## File Structure

- Create `src/utils/mediaLayout.ts` — pure geometry, no React, no DOM.
- Create `src/hooks/useMediaRatios.ts` — measures each URL's natural size, module-level cache.
- Create `src/components/PostMediaFrame.tsx` — the fixed frame, absolute blocks, "+N" veil, video branch.
- Modify `src/components/ListPostCard.tsx:45-55,102-158` — use the frame; drop the masonry.
- Create `scripts/check-media-layout.mjs` — assertions over the transpiled util.
- Modify `package.json` — add the `check:layout` script.
- Delete `docs/mockups/image-container-options.html` (rejected mockup, user-approved).
- Create `agents.md` at the repo root (global rule: per-folder context file).

---

### Task 1: Block-chart geometry util + check harness

**Files:**
- Create: `src/utils/mediaLayout.ts`
- Create: `scripts/check-media-layout.mjs`
- Modify: `package.json` (add `scripts.check:layout`)

**Interfaces:**
- Consumes: nothing.
- Produces:
  ```ts
  export interface MediaBlock { x: number; y: number; w: number; h: number }
  export const FRAME_RATIO: number;            // 4 / 3
  export const MAX_MEDIA_BLOCKS: number;       // 7
  export const MAX_MEDIA_BLOCKS_NARROW: number;// 4
  export const NARROW_FRAME_PX: number;        // 480
  export const DEFAULT_GAP: number;            // 4
  export function frameHeight(width: number): number
  export function visibleMediaCount(frameWidth: number, total: number): number
  export function computeJustifiedBlocks(
    ratios: number[], width: number, height: number, gap?: number
  ): MediaBlock[]
  ```

- [ ] **Step 1: Write the failing check script** `scripts/check-media-layout.mjs`. It imports the transpiled util (`../node_modules/.cache/media-layout.mjs`) and asserts, with `node:assert`. `RATIOS` covers the real spread of travel photos, and each case slices like the app does (`visibleMediaCount`) so the util is exercised on the 7 blocks a card can actually show:

  ```js
  const RATIOS = [0.5, 0.67, 1, 1.5, 2, 2.33]; // portrait serré -> pano

  assert.equal(frameHeight(600), 450);                                  // cadre 4:3
  assert.equal(visibleMediaCount(1000, 13), 7);                          // plafond 7
  assert.equal(visibleMediaCount(375, 13), 4);                           // 4 sous 480 px
  assert.equal(visibleMediaCount(1000, 5), 5);

  for (const width of [1200, 592, 375, 300]) {
    const height = frameHeight(width);
    for (let total = 1; total <= 16; total++) {
      const ratios = Array.from({ length: total }, (_, i) => RATIOS[i % RATIOS.length])
        .slice(0, visibleMediaCount(width, total));
      const blocks = computeJustifiedBlocks(ratios, width, height);
      assert.equal(blocks.length, ratios.length, `n=${ratios.length} w=${width}`);
      for (const b of blocks) {
        assert.ok(Number.isFinite(b.x + b.y + b.w + b.h), `NaN w=${width} n=${ratios.length}`);
        assert.ok(b.w > 0 && b.h > 0, `bloc vide w=${width} n=${ratios.length}`);
        assert.ok(b.x >= -0.5 && b.y >= -0.5 && b.x + b.w <= width + 0.5 && b.y + b.h <= height + 0.5,
          `déborde w=${width} n=${ratios.length}`);
      }
      for (let i = 0; i < blocks.length; i++)
        for (let j = i + 1; j < blocks.length; j++) {
          const a = blocks[i], b = blocks[j];
          const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
          const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
          assert.ok(!(ox > 1 && oy > 1), `chevauchement ${i}/${j} w=${width} n=${ratios.length}`);
        }
      const coverage = blocks.reduce((s, b) => s + b.w * b.h, 0) / (width * height);
      assert.ok(coverage >= 0.9, `couverture ${(coverage * 100).toFixed(1)}% w=${width} n=${ratios.length}`);
      // dans une même ligne, les largeurs suivent les ratios des photos
      const rows = new Map();
      blocks.forEach((b, i) => {
        const key = Math.round(b.y);
        if (!rows.has(key)) rows.set(key, []);
        rows.get(key).push(i);
      });
      for (const idxs of rows.values())
        for (const i of idxs.slice(1)) {
          const got = blocks[idxs[0]].w / blocks[i].w;
          const want = ratios[idxs[0]] / ratios[i];
          assert.ok(Math.abs(got - want) < 0.01, `largeurs non proportionnelles w=${width}`);
        }
    }
  }

  assert.deepEqual(computeJustifiedBlocks([1, 1, 1], 0, 0), [{ x: 0, y: 0, w: 0, h: 0 }]); // pas de NaN
  assert.deepEqual(computeJustifiedBlocks([1.5], 800, 600), [{ x: 0, y: 0, w: 800, h: 600 }]); // 1 photo = cadre
  ```

  Finish the script with `console.log("mediaLayout: ok")`.

- [ ] **Step 2: Add the npm script** to `package.json`:
  `"check:layout": "esbuild src/utils/mediaLayout.ts --format=esm --outfile=node_modules/.cache/media-layout.mjs --log-level=error && node scripts/check-media-layout.mjs"`

- [ ] **Step 3: Run it to verify it fails** — `npm run check:layout`. Expected: esbuild error `Could not resolve "src/utils/mediaLayout.ts"`.

- [ ] **Step 4: Implement `src/utils/mediaLayout.ts`** with the exact signatures above. Algorithm (same as the validated mockup, `docs/mockups/post-media-fill-options.html` → `layoutJustified`): for each candidate row count 1..n, split the photos into consecutive rows of as-equal-count-as-possible, natural row height `(width - gap*(k-1)) / Σ ratios`, keep the count whose natural total height is closest to `height`, scale rows by `height / total`, widths inside a row `= (width - gap*(k-1)) * ratio_i / Σ ratios`, last row extended to the bottom edge. Guard `width <= 0 || n <= 1` first.

- [ ] **Step 5: Run it to verify it passes** — `npm run check:layout`. Expected: `ok` lines for all widths, exit 0.

- [ ] **Step 6: Commit** — `git add src/utils/mediaLayout.ts scripts/check-media-layout.mjs package.json` then commit `feat(posts): add justified block-chart layout math for post media frames`.

---

### Task 2: Photo ratio hook

**Files:**
- Create: `src/hooks/useMediaRatios.ts`

**Interfaces:**
- Consumes: `FRAME_RATIO` from Task 1 (the ratio assumed before a photo is measured).
- Produces: `export function useMediaRatios(urls: string[]): number[]` — `ratios[i]` parallel to `urls[i]`, `FRAME_RATIO` until that URL is measured.

- [ ] **Step 1: Implement the hook.** Module-level `Map<string, number>` cache so re-renders, scrolling and `columnCount` changes never re-measure. Uncached URL → `new Image()`, resolve `naturalWidth / naturalHeight` (fall back to `FRAME_RATIO` on load error or zero size), store in cache, `setState` only if the result changed. Keep the array order stable (`useMemo` on the joined URLs) so blocks never shuffle while loading. No `ready` flag: the frame re-tiles as ratios land, nothing waits on it.

- [ ] **Step 2: Typecheck** — `npx tsc --noEmit -p tsconfig.app.json`. Expected: no output, exit 0.

- [ ] **Step 3: Lint** — `npx eslint src/hooks/useMediaRatios.ts`. Expected: no errors.

- [ ] **Step 4: Commit** — `git add src/hooks/useMediaRatios.ts` then commit `feat(posts): measure media aspect ratios for block layout`.

> No headless test here: measurement needs a real `Image`/DOM. It is verified against real photos in the app in Task 4, Step 5.

---

### Task 3: PostMediaFrame component

**Files:**
- Create: `src/components/PostMediaFrame.tsx`

**Interfaces:**
- Consumes: `computeJustifiedBlocks`, `frameHeight`, `visibleMediaCount`, `MAX_MEDIA_BLOCKS`, `FRAME_RATIO`, `DEFAULT_GAP` (Task 1); `useMediaRatios` (Task 2).
- Produces: `export const MEDIA_FRAME_CLASS: string` (`"relative w-full overflow-hidden rounded-md bg-black"`) and `export const MEDIA_FRAME_STYLE: React.CSSProperties` (`{ aspectRatio: String(FRAME_RATIO) }`) — both reused by the map branch in Task 4; `interface PostMediaFrameProps { media: MediaInfo[]; alt?: string; className?: string }` and `const PostMediaFrame: React.FC<PostMediaFrameProps>` as the file's default export.

- [ ] **Step 1: Implement the component.**
  - Images = `media.filter(m => m.type === 'image')`; pass their `urls.medium ?? urls.original` to `useMediaRatios`.
  - Frame width comes from a `ResizeObserver` on the frame `div`; `visible = visibleMediaCount(width, images.length)`; blocks from `computeJustifiedBlocks(ratios.slice(0, visible), width, frameHeight(width), DEFAULT_GAP)`; skip rendering blocks while `width === 0`.
  - Each block: absolutely positioned `div` (`left/top/width/height` in px, `overflow-hidden`) wrapping `<img src loading="lazy" className="h-full w-full object-cover">` with the `onError` → `/placeholder.svg` handler already used in `ListPostCard`, and `alt` from the `alt` prop (default `""` — `ListPostCard` uses `post.title || t('common.postImage')` today, and Task 4 passes that value in).
  - `images.length - visible > 0` → veil `div` over the **last** block, `bg-black/45 flex items-center justify-center text-sm font-bold text-white`, text `+N`.
  - Video: rendered **only when the post has no image at all** (`images.length === 0`) and a video is present; it fills the frame and **keeps `controls`**, with `object-cover`. Ruling 2026-11-27: today's list card plays a video post from the card (`<video controls>`) and shows the photo when a post has one photo plus one video — the fixed frame must not remove either behaviour, so no `controls`-free/muted variant and no video-over-photo precedence.
  - Nothing to render (no image, no video) → return `null`.

- [ ] **Step 2: Typecheck and lint** — `npx tsc --noEmit -p tsconfig.app.json && npx eslint src/components/PostMediaFrame.tsx`. Expected: exit 0 both.

- [ ] **Step 3: Commit** — commit `feat(posts): render post media in a fixed block-chart frame`.

---

### Task 4: Wire the frame into ListPostCard

**Files:**
- Modify: `src/components/ListPostCard.tsx` (lines 45-55 for the media bookkeeping, 102-158 for the rendered block)

**Interfaces:**
- Consumes: `PostMediaFrame`, `MEDIA_FRAME_CLASS` (Task 3).

- [ ] **Step 1: Replace the media block.** Delete `MAX_GALLERY`, `visibleImages`, `remainingCount`, `galleryColumns` and the `columnCount` masonry JSX, the standalone `<img>` and `<video>` branches; render `<PostMediaFrame media={mediaItems} alt={post.title || t('common.postImage')} />` when the post has media.
- [ ] **Step 2: Unify the coordinates branch.** The `MapComponent` case keeps `coordinates` but renders inside the shared frame: `<div className={MEDIA_FRAME_CLASS} style={MEDIA_FRAME_STYLE}><MapComponent coordinates={post.coordinates} className="h-full w-full" /></div>` (replaces `className="h-48"`), so text-only-with-map posts keep the same card height as photo posts.
- [ ] **Step 3: Verify the build** — `npx tsc --noEmit -p tsconfig.app.json && npm run build && npm run check:layout`. Expected: all exit 0.
- [ ] **Step 4: Commit** — commit `feat(posts): use block-chart media frame in list view`.
- [ ] **Step 5: Run the app and walk the Review Focus list** — `npm run dev` (port 8080), then in the **list** view: 1 photo, 3 photos, 5 photos, 8+ photos (`+N` exact), video post, coordinates-only post, text-only post, `columnCount` 1→2→3, and a 375 px-wide viewport (4 blocks max). Repeat the 5-photo and 8+ cases on a **public journey** (`PublicJourneyPage`) since it renders the same card. Check every line of the Review Focus section above. Report what was seen before calling this done.

---

### Task 5: Housekeeping

**Files:**
- Delete: `docs/mockups/image-container-options.html`
- Create: `agents.md`
- Add to git: `docs/superpowers/specs/2026-11-27-post-media-block-chart-design.md`, `docs/superpowers/plans/2026-11-27-post-media-block-chart.md`, `docs/mockups/post-media-fill-options.html`

- [ ] **Step 1: Delete the rejected mockup** (user-approved) — `rm docs/mockups/image-container-options.html`. Keep `docs/mockups/post-media-fill-options.html` as the reference for the chosen layout.
- [ ] **Step 2: Write `agents.md`** at the repo root: what Matka is (React/Vite + shadcn frontend, Fastify + Postgres backend in `backend/`), where things live (`src/pages/Index.tsx` wall with `viewMode` list/grid and `columnCount`, `ListPostCard` / `GridPostCard`, `src/hooks/useMediaRatios`), how to check (`npm run check:layout`, `npx tsc --noEmit -p tsconfig.app.json`, `npm run build`, `npm run dev` on :8080), and the media-frame conventions (fixed 4:3 frame, 7 blocks max, 4 below 480 px, 4 px gutters, block order = `media_items` order).
- [ ] **Step 3: Commit** the deletion, `agents.md` and the three design documents — commit `chore(docs): add repo agents.md, block-chart spec, plan and mockup`.
- [ ] **Step 4: Report.** Pushing/merging is not part of this task: the controller asks the human partner.
