# Post Media Block-Chart Gallery Design

Date: 2026-11-27
Status: pending approval
Mockup: `docs/mockups/post-media-fill-options.html` (option B retenue)

## Intent

In list view, a post's photos all fill **one frame of the same size for every post**, tiled as blocks
of different sizes (justified block chart). Photos beyond 7 are counted in a small `+N` on the last block.

## Why

Posts mix portrait, landscape and panorama. Today's list gallery is masonry (`w-full h-auto` in
`ListPostCard`), so card heights vary wildly with the number and format of photos: the wall looks ragged
and a 5-photo post pushes its text far down. A fixed frame where every photo stays visible keeps the feed
aligned without squaring everything away.

## Goals

- Fixed media frame in `ListPostCard`: `aspect-ratio: 4/3`, identical for all posts at a given column width,
  whatever `columnCount` (1, 2 or 3) the wall uses.
- Every photo of the post visible inside the frame, laid out as **justified rows**: block width proportional
  to the photo's real aspect ratio, rows of varying heights, the whole set filling the frame exactly
  (Google Photos / Flickr behaviour).
- **At most 7 blocks** (`MAX_MEDIA_BLOCKS = 7`, replacing today's `MAX_GALLERY = 7`); the remaining photos are
  shown as `+N` on the last block, small label instead of the current `text-3xl` overlay.
- 4 px gutters between blocks, as today.
- Posts with coordinates and no media use the same 4:3 frame for the map (instead of `h-48`), so cards stay
  aligned in all cases.
- Applies to both walls rendering `ListPostCard`: `Index.tsx` and `PublicJourneyPage.tsx`.

## Non-goals

- Grid view: `GridPostCard` keeps its 1:1 `object-cover` square.
- Per-block lightbox / opening one photo from the card: clicking the card still opens `PostDetailDialog`.
- Server-side or upload-time cropping: existing `urls.medium` + `object-fit: cover`.
- `PostDetailDialog` gallery.
- Reordering photos by aspect ratio: photos stay in the order the author posted them.

## Approaches considered

Shown side by side in the mockup, with the real "Senja" post at 5 and 13 photos, and a 1→16 photo strip.

- **A. Hero + equal cells** — first photo half-width, rest in equal cells. Simple, but at 7 photos the right
  column gets narrow and the motif repeats. *Not chosen.*
- **B. Justified block chart** — blocks sized on each photo's real ratio, rows of varying heights. Least
  cropping, true block-chart look. Cost: a JS layout calculation driven by the measured frame width.
  **Chosen.**
- **C. Weighted checkerboard** — fixed grid with one double block, cells merged. CSS-light, but crops
  portraits hard. *Not chosen.*
- **D. Single hero + `+N`** — most compact, hides the other photos entirely. *Not chosen.*

## Decisions

- Option **B**, cap of **7** blocks — chosen by the user.
- Frame ratio **4/3** — builder's call: matches the mockup, wide enough for landscape travel shots, short
  enough that the card still shows its text.
- Layout is a **pure function** `computeJustifiedBlocks(photos, width, height, gap)` in
  `src/utils/mediaLayout.ts`; the component measures the frame with a `ResizeObserver` (width follows
  `columnCount` and viewport). Geometry validated for 1→16 photos at both card sizes (no overflow, no
  overlap, ≥ 93 % frame coverage).
- Row count: among all splits of 1..n, keep the one whose natural row heights sum closest to the frame
  height, then scale and stretch the last row to the bottom edge.
- **Mobile: below 480 px of frame width, 4 blocks max** (rest in `+N`) — builder's proposal: at 350 px, 7
  blocks are ~110 px tiles, unreadable. Overridable.
- **Videos**: if the post has at most one image and a video comes first, the video fills the same 4:3 frame
  (today's behaviour); videos are not tiled in the block chart. Builder's call: a muted tile in a mosaic is
  misleading.
- `+N` stays a plain label (no new i18n keys).

## Left to the builder

- Exact veil styling on the last block, using existing card tokens (`bg-black/45`, `text-sm font-bold`).
- Keeping `rounded-md` on the frame for both the gallery and the map variant.
