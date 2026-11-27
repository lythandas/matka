# Image downscaling & background preloading — design

Date: 2026-11-27 · Branch: `image-downscaling`

## Goal

Make the wall (list + grid) load fast by displaying downscaled thumbnails, and
make PostDetailDialog feel instant by preloading full-resolution images in the
background after first render.

## Architecture

### Backend — `GET /thumbs/:fileName` (public, `thumbnailRoutes.ts`)

- Media files live on disk in `UPLOADS_PATH` and are served unauthenticated by
  `@fastify/static` at `/uploads/` (the UUID in the file name is the capability
  token). The thumbnail route keeps that exact model: registered outside the
  authenticated scope, deriving the source file from the requested name. Being
  stricter than `/uploads` would protect a *smaller* image worse than the
  original it comes from — incoherent; being looser is impossible.
- URL shape: `/uploads/abc-original.jpg` → `/thumbs/abc-original.jpg.w800.jpg`.
  The frontend derives it (`src/utils/mediaUrls.ts`); no DB change, so legacy
  `media_items` rows and new uploads behave identically.
- **Single width, 800 px**: card frames are at most ~400 px wide (max-w-7xl /
  3 columns), ×2 device pixel ratio = 800. A parameterised width would be an
  unbounded disk-fill vector (every width is a new cache entry); a single
  constant makes URLs content-addressed and `Cache-Control: immutable` correct.
- **Formats**: PNG → PNG (alpha survives), JPEG/WebP/BMP/TIFF → JPEG q75
  (mozjpeg, flattened on white so transparent WebP doesn't turn black),
  SVG/GIF → 302 to the original (vector / animated; sharp would flatten GIF).
  EXIF orientation applied (`rotate()`), no enlargement of smaller sources.
- **Cache**: `THUMBS_PATH` (default `UPLOADS_PATH/thumbs`, env-overridable).
  First request generates and writes temp-then-rename (atomic, same volume, so
  concurrent identical requests race safely); every later request is a plain
  file read. Processing failures log + redirect to the original (a broken
  thumbnail must never break a card).
- Path traversal: file-name charset regex + explicit `..` rejection; a `/thumbs`
  miss returns JSON 404 (excluded from the SPA fallback like `/uploads`).

### Frontend

- **Display** — `thumbnailUrl()` in PostMediaFrame (list) and GridPostCard;
  un-mappable URLs (non-`/uploads`, svg, gif) fall back to the original
  unchanged, and a failed thumbnail request also retries the original before
  ever showing the placeholder (frontend deployed ahead of the backend
  degrades to today's behaviour, not to blank cards). `useMediaRatios`
  measures the thumbnail URLs: the backend only shrinks, never crops, so the
  ratio is identical.
- **Preload** — `useImagePreload(urls, enabled)` schedules
  `enqueueImagePreload` at `requestIdleCallback` (2 s timeout, `setTimeout`
  fallback for Safari) once the card is near the viewport (PostMediaFrame's
  `inView`; GridPostCard via `useInViewOnce`). The scheduler keeps a
  module-level queue: max **2 concurrent** downloads, `fetchPriority="low"`,
  dedup per URL, no abort once started (aborting an `<img>` doesn't free the
  bytes already sent; the gate + cap is the bandwidth guard on fast scrolls).
- Preloaded URLs are `large ?? original` — exactly what PostDetailDialog
  renders — so the click hits the browser HTTP cache.
- Accepted trade: photos beyond the block cap (the `+N` veil) are not
  preloaded; the dialog fetches them on demand.

## Verification

- Backend: `npm run build`, `npm run lint` — clean.
- Frontend: `npx tsc --noEmit -p tsconfig.app.json`, `npm run build`,
  `npm run check:layout` — clean; `npm run lint` — only the pre-existing
  errors/warnings (none in touched files; the `react-refresh/only-export-components`
  warning on PostMediaFrame is the accepted one).
- No DB migration needed. Server not run (per instructions).

## Follow-ups / risks

- Global rate limit (100 req/min) applies to `/thumbs` as it already does to
  `/uploads`: a very media-heavy wall could approach it — same exposure as
  before, but thumbnails increase request counts slightly.
- First request per photo pays the sharp cost (~50–200 ms); a warm-up or
  eager generation at upload could be added later if that shows in practice.
- If uploads gain a cleanup job, `thumbs/` must be included.
