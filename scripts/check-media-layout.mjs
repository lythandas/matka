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
assert.equal(visibleMediaCount(480, 13), 7); // 480 px = plafond normal
assert.equal(visibleMediaCount(479.98, 13), 4); // juste sous la frontière
assert.equal(visibleMediaCount(1000, 5), 5);

for (const width of [1200, 592, 480, 375, 300]) {
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
    // un bloc ne s'écarte pas trop du format réel de sa photo : sinon le
    // recadrage object-cover mange la photo même si le pavage est propre.
    // NB : borne valable pour la distribution balayée ici (ratios
    // 0.5–2.33), pas un invariant global — sur des ratios 0.3–3.0,
    // crop-min atteint légitimement ~3.3x (n=3, [2.883, 2.233, 0.439]) :
    // inhérent au crop-min sur un ensemble surtout portrait, pas un défaut.
    if (ratios.length >= 2)
      blocks.forEach((b, i) => {
        const dev = (b.w / b.h) / ratios[i];
        assert.ok(dev >= 1 / 1.75 && dev <= 1.75,
          `bloc ${i} à ${dev.toFixed(2)}x du format de sa photo w=${width} n=${ratios.length}`);
      });
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
// ratios invalides (0, NaN, négatif) -> traités comme carrés
assert.deepEqual(
  computeJustifiedBlocks([0, NaN, -1, 2], 400, 300),
  computeJustifiedBlocks([1, 1, 1, 2], 400, 300),
);

// ---------- Recadrage : fraction visible de chaque photo ----------
// Un bloc d'aspect a affichant en object-cover une photo d'aspect p garde
// min(1, a/p) * min(1, p/a) de la photo. Le nombre de lignes choisi doit
// maximiser la moyenne de cette fraction — couper le moins possible.
const visibleFraction = (a, p) => Math.min(1, a / p) * Math.min(1, p / a);

// Optimum recalculé ici, indépendamment de l'implémentation : pour chaque
// découpage candidat k = 1..n, même géométrie finale (largeurs
// proportionnelles au ratio, dernière ligne jusqu'au bord bas), même score.
function cropOptimumMean(ratios, W, H) {
  const n = ratios.length;
  let best = -1;
  for (let rows = 1; rows <= n; rows++) {
    const base = Math.floor(n / rows), extra = n % rows;
    const groups = [];
    let k = 0;
    for (let r = 0; r < rows; r++) {
      const c = base + (r < extra ? 1 : 0);
      if (c > 0) { groups.push(ratios.slice(k, k + c)); k += c; }
    }
    const heights = groups.map(
      (g) => (W - DEFAULT_GAP * (g.length - 1)) / g.reduce((a, b) => a + b, 0),
    );
    const total = heights.reduce((a, b) => a + b, 0) + DEFAULT_GAP * (groups.length - 1);
    const scale = H / total;
    let y = 0, sum = 0, i = 0;
    groups.forEach((g, r) => {
      const rowH = r === groups.length - 1 ? H - y : heights[r] * scale;
      const rs = g.reduce((a, b) => a + b, 0);
      const usable = W - DEFAULT_GAP * (g.length - 1);
      for (const p of g) {
        const bw = (usable * p) / rs;
        sum += visibleFraction(bw / rowH, ratios[i++]);
      }
      y += rowH + DEFAULT_GAP;
    });
    best = Math.max(best, sum / n);
  }
  return best;
}

// Cas épinglés (cadre 4:3 de 400 px de large) : la moyenne atteint
// l'optimum « couper le moins », et ne descend pas sous les planchers
// observés. Le portrait seul reste à 50 % : seul contain l'aurait épargné.
const PINNED = [
  { name: "1 portrait", ratios: [0.667], each: 0.50 },
  { name: "carré + pano", ratios: [1, 2.333], each: 0.50 },
  { name: "3 carrés", ratios: [1, 1, 1], each: 0.49 },
  { name: "5 photos mixtes", ratios: [1.778, 1.5, 0.667, 1, 2], mean: 0.70 },
  { name: "7 photos larges", ratios: [1.778, 1.5, 0.667, 1, 2, 1.714, 1], mean: 0.70 },
];
for (const { name, ratios, each = 0, mean = 0 } of PINNED) {
  const blocks = computeJustifiedBlocks(ratios, 400, 300);
  const fracs = blocks.map((b, i) => visibleFraction(b.w / b.h, ratios[i]));
  const m = fracs.reduce((a, b) => a + b, 0) / fracs.length;
  assert.ok(m >= cropOptimumMean(ratios, 400, 300) - 1e-9, `${name}: sous l'optimum`);
  if (mean > 0)
    assert.ok(m >= mean, `${name}: moyenne ${(m * 100).toFixed(1)}% < ${(mean * 100).toFixed(0)}%`);
  if (each > 0)
    fracs.forEach((f, i) =>
      assert.ok(f >= each, `${name}: photo ${i + 1} à ${(f * 100).toFixed(1)}% < ${(each * 100).toFixed(0)}%`));
}

console.log("mediaLayout: ok");
