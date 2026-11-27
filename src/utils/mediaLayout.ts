/**
 * Pure geometry for the post-media "justified block chart": all photos of a
 * post card tiled inside one fixed 4:3 frame, Flickr/Google-Photos style —
 * block widths proportional to each photo's real aspect ratio, row heights
 * varying, the frame covered exactly. No React, no DOM.
 */

/** A tiled photo rectangle inside the frame, in frame-local pixels. */
export interface MediaBlock {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Width / height of the media frame. */
export const FRAME_RATIO: number = 4 / 3;

/** Max blocks a card shows on a normal (>= NARROW_FRAME_PX) frame. */
export const MAX_MEDIA_BLOCKS: number = 7;

/** Max blocks a card shows on a narrow (< NARROW_FRAME_PX) frame. */
export const MAX_MEDIA_BLOCKS_NARROW: number = 4;

/** Frame width below which fewer blocks are shown. */
export const NARROW_FRAME_PX: number = 480;

/** Gap between blocks, in pixels. */
export const DEFAULT_GAP: number = 4;

/** Frame height for a given frame width (4:3). */
export function frameHeight(width: number): number {
  return (width / FRAME_RATIO);
}

/**
 * How many of `total` media a card actually tiles, given the frame width:
 * capped at MAX_MEDIA_BLOCKS, or MAX_MEDIA_BLOCKS_NARROW below 480 px.
 */
export function visibleMediaCount(frameWidth: number, total: number): number {
  const cap = frameWidth < NARROW_FRAME_PX ? MAX_MEDIA_BLOCKS_NARROW : MAX_MEDIA_BLOCKS;
  return Math.max(0, Math.min(total, cap));
}

/**
 * Justified layout of `ratios` (width/height per photo, order preserved:
 * block i is photo i) inside a `width` x `height` frame with `gap` px gutters.
 *
 * For each candidate row count k = 1..n, split the photos into k consecutive
 * rows of as-equal-count-as-possible, compute the natural total height and
 * keep the k closest to `height`; then scale rows to fill the frame exactly,
 * widths inside a row proportional to the ratios, last row reaching the
 * bottom edge. Pure: never NaN, never empty/overlapping/out-of-frame blocks.
 */
export function computeJustifiedBlocks(
  ratios: number[],
  width: number,
  height: number,
  gap: number = DEFAULT_GAP,
): MediaBlock[] {
  const g = Number.isFinite(gap) && gap > 0 ? gap : 0;
  const w = Number.isFinite(width) && width > 0 ? width : 0;
  const h = Number.isFinite(height) && height > 0 ? height : 0;
  const n = ratios.length;

  // Degenerate frame or a single photo: one full-frame block.
  if (w <= 0 || h <= 0 || n <= 1) {
    return [{ x: 0, y: 0, w, h }];
  }

  // Sanitize ratios: a missing/zero/negative/NaN ratio is treated as square.
  const rs = ratios.map((r) => (Number.isFinite(r) && r > 0 ? r : 1));

  let best: { groups: number[][]; heights: number[]; scale: number } | null = null;
  let bestCost = Infinity;

  for (let rows = 1; rows <= n; rows++) {
    const base = Math.floor(n / rows);
    const extra = n % rows;
    const groups: number[][] = [];
    let k = 0;
    for (let r = 0; r < rows; r++) {
      const count = base + (r < extra ? 1 : 0);
      if (count > 0) {
        groups.push(rs.slice(k, k + count));
        k += count;
      }
    }
    const rowGaps = g * (groups.length - 1);
    const heights = groups.map(
      (group) => (w - g * (group.length - 1)) / group.reduce((a, b) => a + b, 0),
    );
    const total = heights.reduce((a, b) => a + b, 0) + rowGaps;
    const cost = Math.abs(total / h - 1);
    if (cost < bestCost) {
      bestCost = cost;
      best = { groups, heights, scale: h / total };
    }
  }

  const { groups, heights, scale } = best!;
  const blocks: MediaBlock[] = [];
  let y = 0;
  groups.forEach((group, r) => {
    const rowH = r === groups.length - 1 ? h - y : heights[r] * scale; // last row reaches the bottom edge
    const sum = group.reduce((a, b) => a + b, 0);
    const usable = w - g * (group.length - 1);
    let x = 0;
    for (const ratio of group) {
      const bw = (usable * ratio) / sum;
      blocks.push({ x, y, w: bw, h: rowH });
      x += bw + g;
    }
    y += rowH + g;
  });
  return blocks;
}
