// Check harness for src/utils/postDates.ts — dependency-free, node:assert only.
// Run via `npm run check:dates`, which first transpiles the TS util with esbuild
// into node_modules/.cache/post-dates.mjs (imported below).
// TZ is pinned BEFORE the dynamic import so dateKey's local-time behaviour is
// deterministic (static imports are hoisted and would evaluate first).
process.env.TZ = "Europe/Paris";
const assert = (await import("node:assert")).default;
const { dateKey, groupPostsByDate, journeyMonthRange, firstPostIdForDate } =
  await import("../node_modules/.cache/post-dates.mjs");

// ---------- dateKey : date locale, frontière UTC -> local ----------
assert.equal(dateKey("2025-04-20T23:30:00Z"), "2025-04-21"); // 23:30Z = lendemain à Paris
assert.equal(dateKey("2025-04-20T10:00:00Z"), "2025-04-20");
assert.equal(dateKey("not a date"), ""); // garde Invalid Date

// ---------- groupPostsByDate : ordre du tableau respecté ----------
const posts = [
  { id: "p1", created_at: "2025-04-20T10:00:00Z" },
  { id: "p2", created_at: "2025-04-20T08:00:00Z" },
  { id: "p3", created_at: "2025-04-21T12:00:00Z" },
];
const group = groupPostsByDate(posts);
assert.equal(group.size, 2); // 2 clés, 2 posts le même jour
assert.deepEqual(group.get("2025-04-20"), ["p1", "p2"]); // ordre du tableau
assert.deepEqual(group.get("2025-04-21"), ["p3"]);
assert.equal(groupPostsByDate([]).size, 0); // vide -> Map vide

// ---------- journeyMonthRange : mois local du plus ancien -> plus récent ----------
const range = journeyMonthRange([
  { created_at: "2025-03-28T08:00:00Z" },
  { created_at: "2025-05-03T17:00:00Z" },
]);
assert.ok(range);
assert.equal(range.startMonth.getFullYear(), 2025);
assert.equal(range.startMonth.getMonth(), 2); // mars
assert.equal(range.startMonth.getDate(), 1); // 1er du mois
assert.equal(range.endMonth.getFullYear(), 2025);
assert.equal(range.endMonth.getMonth(), 4); // mai
assert.equal(range.endMonth.getDate(), 1);
assert.equal(journeyMonthRange([]), null); // vide -> null

// ---------- firstPostIdForDate : premier post du jour ----------
assert.equal(firstPostIdForDate(group, "2025-04-20"), "p1");
assert.equal(firstPostIdForDate(group, "2025-04-21"), "p3");
assert.equal(firstPostIdForDate(group, "2025-04-22"), null); // jour absent

console.log("postDates: ok");
