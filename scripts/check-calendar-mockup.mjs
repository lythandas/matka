#!/usr/bin/env node
/**
 * Headless check of docs/mockups/calendar-post-navigation.html — no browser,
 * no image, no dependency. Three layers:
 *
 *  1. Static: the file is self-contained (no <img>, no external URL) and every
 *     id / CSS class referenced by the JS exists in the markup / stylesheet.
 *  2. Execution: the extracted <script> runs in a minimal emulated DOM
 *     (elements, classList, appendChild, getElementById, listeners, timeouts).
 *  3. Behaviour: 17 cards rendered, month grid arithmetic, chevron bounds,
 *     marked days per month, click on a date → scroll + flash + tooltip,
 *     and the current-day ring: set at load from the topmost visible post,
 *     following simulated wall scrolls, re-applied on month re-render and
 *     set by date clicks.
 *
 * Usage: node scripts/check-calendar-mockup.mjs [path-to-html]
 * (defaults to docs/mockups/calendar-post-navigation.html)
 */
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import assert from 'node:assert';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const htmlPath = process.argv[2] ?? join(root, 'docs/mockups/calendar-post-navigation.html');
const html = readFileSync(htmlPath, 'utf8');

/* ===== 1. Static checks ===== */
assert(!/<img[\s>]/i.test(html), 'mockup must not contain <img> (self-contained, no images)');
const external = html.match(/(?:src|href)\s*=\s*["']https?:/gi) ?? [];
assert(external.length === 0, `external resource: ${external[0]}`);

const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
assert(scriptMatch, 'no <script> found');
const code = scriptMatch[1];

const cssMatch = html.match(/<style>([\s\S]*?)<\/style>/);
assert(cssMatch, 'no <style> found');
const css = cssMatch[1];

// Every literal id used via byId/getElementById must exist in the markup.
const wantedIds = [...code.matchAll(/(?:byId|getElementById)\(\s*'([^']+)'\s*\)/g)].map((m) => m[1]);
const definedIds = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
for (const id of wantedIds) {
  if (id.startsWith('card-')) continue; // dynamic ids, checked after execution
  assert(definedIds.has(id), `JS looks up #${id} but no element has this id`);
}

// Every class the JS assigns must have a CSS rule somewhere in the stylesheet.
const jsClasses = new Set();
for (const m of code.matchAll(/className\s*=\s*'([^']+)'/g)) m[1].split(/\s+/).forEach((c) => jsClasses.add(c));
for (const m of code.matchAll(/classList\.add\('([^']+)'\)/g)) jsClasses.add(m[1]);
for (const c of jsClasses) assert(css.includes(`.${c}`), `class .${c} used by JS has no CSS rule`);

/* ===== 2. Minimal DOM emulation ===== */
class El {
  constructor(tag) {
    this.tagName = tag;
    this.id = '';
    this._classes = [];
    this.children = [];
    this.parentNode = null;
    this.textContent = '';
    this.type = '';
    this.title = '';
    this.disabled = false;
    this.tabIndex = 0;
    this.style = {};
    this.attrs = {};
    this.listeners = {};
    this.scrolledIntoView = null;
    this.classList = {
      add: (...cs) => cs.forEach((c) => { if (!this._classes.includes(c)) this._classes.push(c); }),
      remove: (...cs) => { this._classes = this._classes.filter((c) => !cs.includes(c)); },
      contains: (c) => this._classes.includes(c),
    };
  }
  get className() { return this._classes.join(' '); }
  set className(v) { this._classes = v.split(/\s+/).filter(Boolean); }
  get offsetWidth() { return 0; }
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  append(...nodes) { nodes.forEach((n) => this.appendChild(n)); }
  insertBefore(node, ref) {
    const i = ref ? this.children.indexOf(ref) : this.children.length;
    this.children.splice(i < 0 ? this.children.length : i, 0, node);
    node.parentNode = this;
    return node;
  }
  set innerHTML(v) { assert(v === '', 'innerHTML setter only supports clearing'); this.children = []; }
  addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
  setAttribute(k, v) { this.attrs[k] = v; }
  getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; }
  click() { (this.listeners.click ?? []).forEach((fn) => fn()); }
  scrollIntoView(opts) { this.scrolledIntoView = opts; }
  getBoundingClientRect() { return { top: 0, bottom: 0 }; } // overridden per-card by the checker
  descendants() { return [...this.children, ...this.children.flatMap((c) => c.descendants())]; }
}

const timeouts = [];
const registry = new Map();
for (const m of html.matchAll(/<(\w+)[^>]*\bid="([^"]+)"/g)) {
  const el = new El(m[1]);
  el.id = m[2];
  registry.set(m[2], el);
}
const document = {
  title: 'Matka — calendrier de navigation par date',
  createElement: (tag) => new El(tag),
  createTextNode: (text) => { const t = new El('#text'); t.textContent = text; return t; },
  getElementById: (id) => {
    if (registry.has(id)) return registry.get(id);
    for (const el of registry.values()) {
      const hit = el.descendants().find((d) => d.id === id);
      if (hit) return hit;
    }
    return null;
  },
};
const window = {
  location: { hash: '' },
  listeners: {},
  addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); },
  setTimeout: (fn, ms) => { timeouts.push({ fn, ms }); return timeouts.length; },
};
// Browsers expose elements with an id as window properties ("named access")
// reachable as bare identifiers in source code. Only identifier-safe ids
// qualify — which is exactly how the previous mockup broke: it referenced
// wall_a while the markup said id="wall-a". Running the script with vm and a
// sandbox global reproduces real browser semantics.
const sandbox = { document, window, Math, Date, String, Number, console };
for (const [id, el] of registry) if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(id)) sandbox[id] = el;
runInNewContext(code, sandbox);

/* ===== 3. Behaviour checks ===== */
const byId = document.getElementById;
const dayButtons = (grid) => grid.descendants().filter((d) => d.tagName === 'button' && d.classList.contains('day'));
const hasDay = (grid, dayNum) =>
  dayButtons(grid).find((d) => d.classList.contains('has') && d.textContent === dayNum);
const plainDay = (grid, dayNum) =>
  dayButtons(grid).find((d) => !d.classList.contains('blank') && d.textContent === dayNum);

// Wall: 17 cards, one anchor id per dated day.
const wall = byId('wall');
assert(wall.children.length === 17, `wall should render 17 cards, got ${wall.children.length}`);
const postDays = ['2025-03-28', '2025-03-30', '2025-04-02', '2025-04-05', '2025-04-08', '2025-04-14', '2025-04-20', '2025-04-26', '2025-05-01', '2025-05-03'];
for (const d of postDays) assert(byId(`card-${d}`), `missing anchor card #card-${d}`);

// Default month = the most recent post's month (May 2025), chevrons bounded.
assert(byId('cal-title').textContent === 'mai 2025', `default month, got ${byId('cal-title').textContent}`);
assert(byId('cal-next').disabled === true, 'next must be disabled on the last month');
assert(byId('cal-prev').disabled === false, 'prev must be enabled on the last month');

const grid = byId('cal-grid');
// May 2025 starts on a Thursday (3 leading blanks) and the grid is padded to
// whole weeks: 35 cells = 31 days + 3 leading + 1 trailing blank.
assert(dayButtons(grid).length === 35, `May 2025 grid: 35 cells, got ${dayButtons(grid).length}`);
assert(dayButtons(grid).filter((d) => d.classList.contains('blank')).length === 4, 'May 2025: 4 blanks');
assert(dayButtons(grid).filter((d) => d.classList.contains('has')).length === 2, 'May has 2 marked days (01 + 03)');

// Day inside the journey span but without posts: enabled, inert (no listener).
const may2 = plainDay(grid, '2');
assert(may2, 'no cell for 2 May');
assert(may2.disabled === false, '2 May (in span, no post) must stay enabled');
assert((may2.listeners.click ?? []).length === 0, 'day without posts must not be clickable');
assert(!may2.classList.contains('off'), 'day inside the span must not be attenuated');

// Day outside the journey span (journey ends 3 May): disabled, attenuated.
const may10 = plainDay(grid, '10');
assert(may10, 'no cell for 10 May');
assert(may10.disabled === true, '10 May (after the journey) must be disabled');
assert(may10.classList.contains('off'), 'day outside the span must be attenuated');

// Positioning: calendar glued to the wall column's left edge, wall centered.
assert(css.includes('left: max(1.5rem, calc(50% - 672px))'), 'calendar must sit at the wall column left edge (clamped to the window edge)');
assert(!css.includes('padding-left: 316px'), 'the wall must not be pushed aside by a fixed 316px gutter anymore');
assert(css.includes('.day.has::after'), 'has-days must use the discreet dot marker');
assert(css.includes('.day.current'), 'current day must have a ring rule');

// Current-day ring at load: topmost visible post's day (2025-05-03).
// (Default emulated rects are {0,0} → the load path falls back to CARDS[0].d.)
assert(sandbox.currentKey === '2025-05-03', `currentKey at load, got ${sandbox.currentKey}`);
const may3 = hasDay(grid, '3');
assert(may3 && may3.classList.contains('current'), '3 May must carry the current ring at load');
assert(may3.classList.contains('has'), 'the current day is necessarily a post day');

// Simulated scroll: cards get viewport rects driven by a fake scrollTop,
// then the scroll listeners recorded on window are fired.
const CARD_H = 400;
const scrollState = { y: 0 };
wall.children.forEach((c, i) => {
  c.getBoundingClientRect = () => ({ top: i * CARD_H - scrollState.y, bottom: (i + 1) * CARD_H - scrollState.y });
});
const fireScroll = () => (window.listeners.scroll ?? []).forEach((fn) => fn());

fireScroll(); // rect-driven lookup, still at the top
assert(sandbox.currentKey === '2025-05-03', 'rect-driven lookup at scrollTop 0 must keep 3 May');

scrollState.y = 4 * CARD_H; // card idx 4 = first 2025-04-20 card at the reading line
fireScroll();
assert(sandbox.currentKey === '2025-04-20', `scroll must move the ring to 20 April, got ${sandbox.currentKey}`);
assert(!dayButtons(grid).some((d) => d.classList.contains('current')), 'no ring in the May grid while the current day is in April');

scrollState.y = 0;
fireScroll();
assert(sandbox.currentKey === '2025-05-03', 'scrolling back to the top must restore 3 May');
assert(hasDay(grid, '3').classList.contains('current'), '3 May ringed again');

// Month walk: May → April → March, bounds flip.
byId('cal-prev').click();
assert(byId('cal-title').textContent === 'avril 2025', 'one prev click should land on April');
assert(dayButtons(grid).filter((d) => d.classList.contains('has')).length === 6, 'April has 6 marked days');
byId('cal-prev').click();
assert(byId('cal-title').textContent === 'mars 2025', 'second prev click should land on March');
assert(dayButtons(grid).filter((d) => d.classList.contains('has')).length === 2, 'March has 2 marked days');
assert(byId('cal-prev').disabled === true, 'prev must be disabled on the first month');
assert(byId('cal-next').disabled === false, 'next must be enabled on the first month');

// Back to April, click the 4-post day.
byId('cal-next').click();
const apr20 = hasDay(grid, '20');
assert(apr20, 'no marked button for 20 April');
assert(apr20.title === '20 avril 2025 — 4 posts', `tooltip, got "${apr20.title}"`);
assert(apr20.attrs['aria-label'] === apr20.title, 'aria-label must mirror the tooltip');
apr20.click();

const target = byId('card-2025-04-20');
assert(target, 'anchor card for 20 April missing');
assert.deepEqual(target.scrolledIntoView, { behavior: 'smooth', block: 'start' }, 'click must scrollIntoView the anchor card');
assert(target.classList.contains('flash'), 'anchor card must get the flash ring');
assert(byId('cal-status').textContent === '→ 2025-04-20');
assert(sandbox.currentKey === '2025-04-20', 'clicking a date must move the current-day ring');
assert(hasDay(grid, '20').classList.contains('current'), '20 April must be ringed after the click');

// Off-journey day behaviour was checked above (May). Anchor card checks follow.

// Flash is removed by the recorded timeout.
const flashTimeout = timeouts.find((t) => t.ms === 1700);
assert(flashTimeout, 'no 1700 ms flash-removal timeout recorded');
flashTimeout.fn();
assert(!target.classList.contains('flash'), 'flash must be removed by the timeout');

// The #test headless self-check branch exists in the source.
assert(code.includes("window.location.hash === '#test'"), 'missing #test headless branch');

console.log('calendar-mockup: ok');
