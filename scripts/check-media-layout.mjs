// Check harness for src/utils/mediaLayout.ts — dependency-free, node:assert only.
// Run via `npm run check:layout`, which first transpiles the TS util with esbuild
// into node_modules/.cache/media-layout.mjs (imported below).
import assert from "node:assert";
import {
  FRAME_RATIO,
  MAX_MEDIA_BLOCKS,
  MAX_MEDIA_BLOCKS_NARROW,
  NARROW_FRAME_PX,
  DEFAULT_GAP,
  frameHeight,
  visibleMediaCount,
  computeJustifiedBlocks,
} from "../node_modules/.cache/media-layout.mjs";

assert.equal(FRAME_RATIO, 4 / 3);
assert.equal(MAX_MEDIA_BLOCKS, 7);
assert.equal(MAX_MEDIA_BLOCKS_NARROW, 4);
assert.equal(NARROW_FRAME_PX, 480);
assert.equal(DEFAULT_GAP, 4);

const RATIOS = [0.5, 0.67, 1, 1.5, 2, 2.33]; // portrait serré -> pano

assert.equal(frameHeight(600), 450); // cadre 4:3
assert.equal(visibleMediaCount(1000, 13), 7); // plafond 7
assert.equal(visibleMediaCount(375, 13), 4); // 4 sous 480 px
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

console.log("mediaLayout: ok");
