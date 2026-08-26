// The boot screen and its backdrops.
//
// The screen itself needs a DOM and is checked in the browser. What is worth
// asserting here is the content around it: that every event names a backdrop
// something can actually draw, that the tiles are well-formed, and that the
// progress steps are honest — a bar that reaches 100% before the game is up is
// a bar that lies.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

import { BACKDROPS, BACKDROP_IDS, BACKDROP_PALETTE } from '../src/render/backdrops.js';
import { BOOT_STEPS } from '../src/ui/bootScreen.js';
import { EVENTS } from '../src/data/events.js';
import { validatePack } from '../src/content/schema.js';

// ------------------------------------------------------------------ the tiles

test('every backdrop tile is a rectangle', () => {
  for (const [id, tile] of Object.entries(BACKDROPS)) {
    const width = tile.rows[0].length;
    assert.equal(tile.w, width, `${id}: declared width does not match row 0`);
    assert.equal(tile.h, tile.rows.length, `${id}: declared height does not match`);
    for (const [i, row] of tile.rows.entries()) {
      assert.equal(row.length, width, `${id}: row ${i} is ${row.length} wide, not ${width}`);
    }
  }
});

test('every character a backdrop draws has a colour', () => {
  for (const [id, tile] of Object.entries(BACKDROPS)) {
    for (const row of tile.rows) {
      for (const ch of row) {
        assert.ok(ch in BACKDROP_PALETTE, `${id}: "${ch}" has no entry in the palette`);
      }
    }
  }
});

test('a backdrop tiles seamlessly, and is sparse enough to read through', () => {
  for (const [id, tile] of Object.entries(BACKDROPS)) {
    assert.equal(tile.w, tile.h, `${id}: a non-square tile shows its seams when repeated`);

    // These sit behind the title and the status line at 35% opacity. A dense
    // tile stops being texture and starts being noise.
    const painted = tile.rows.join('').split('').filter((c) => c !== '.').length;
    const ratio = painted / (tile.w * tile.h);
    assert.ok(ratio < 0.45, `${id} covers ${(ratio * 100).toFixed(0)}% of its tile — too busy to read through`);
    assert.ok(ratio > 0.01, `${id} covers ${(ratio * 100).toFixed(1)}% — nothing would be visible`);
  }
});

test('no backdrop bands across the whole screen', () => {
  // "Seamless" above only checks the tile is square, so its edges meet. That
  // passed for a reed tile carrying two empty rows, and repeated thirteen times
  // across a desktop those rows read as ruled lines rather than as reeds. Found
  // in a screenshot, so here is the shape of it: a tile with a blank row or
  // column right through it draws a stripe at every repeat.
  //
  // Sparse tiles — stars, embers, snow — have plenty of blank rows and that is
  // the whole point of them, so this only applies to the dense ones. The line is
  // at 20%: reeds is the only tile above it (27%), and steam, citrus and ripples
  // sit just under at ~16% with blank rows that were looked at in a render and
  // do not stripe, because their marks are scattered rather than in columns.
  for (const [id, tile] of Object.entries(BACKDROPS)) {
    const painted = tile.rows.join('').split('').filter((c) => c !== '.').length;
    if (painted / (tile.w * tile.h) < 0.2) continue;

    const blankRows = tile.rows.filter((row) => !/[^.]/.test(row)).length;
    assert.equal(blankRows, 0, `${id} has ${blankRows} empty rows — they stripe when tiled`);
  }

  // Rows only. The obvious symmetry is to check empty columns too, and reeds has
  // six of them — but reeds is *made* of vertical strokes, and in the render
  // those gaps read as the space between clumps rather than as a stripe. What
  // was actually seen was horizontal banding, so that is what this asserts.

});

test('no two backdrops are the same pattern in a different colour', () => {
  // The browser probe compared the baked data URLs and reported all nine
  // distinct — which was true and useless, because they differ by *palette*.
  // Seven of the nine were in fact two shapes: petals, steam and citrus were
  // all the same three-pixel diamond, and embers, stars, snow and rift were all
  // a single dot. An event asking for its own art was getting a recolour.
  //
  // So compare the mask rather than the pixels: which cells are painted, colour
  // discarded.
  const seen = new Map();
  for (const [id, tile] of Object.entries(BACKDROPS)) {
    const mask = tile.rows.map((row) => row.replace(/[^.]/g, '#')).join('/');
    const twin = seen.get(mask);
    assert.equal(twin, undefined, `${id} is ${twin} in another colour`);
    seen.set(mask, id);
  }
});

// ---------------------------------------------------- the catalogue agrees

test('every event names a backdrop that exists', () => {
  // An event whose backdrop is a typo loads the plain colour and says nothing.
  // Ten events were given one at once, which is exactly when a typo happens.
  for (const event of EVENTS) {
    assert.ok(event.background, `${event.id} has no backdrop`);
    assert.ok(
      BACKDROP_IDS.includes(event.background) || event.background.includes('/'),
      `${event.id} names "${event.background}", which is neither a backdrop nor a path`,
    );
  }
});

test('the shipped events all use procedural backdrops', () => {
  // The repo's claim is that all character art is text. Shipping an event that
  // needs a PNG would quietly make that false.
  for (const event of EVENTS) {
    assert.ok(
      BACKDROP_IDS.includes(event.background),
      `${event.id} ships pointing at "${event.background}" rather than a drawn tile`,
    );
  }
});

test('a pack can point an event at a real picture instead', () => {
  // The whole reason assets/ exists. The schema has to let a path through.
  const { pack, warnings } = validatePack({
    events: { patch: { steamFestival: { background: 'assets/events/steam.png' } } },
  });
  assert.deepEqual(warnings, []);
  assert.equal(pack.events.patch.steamFestival.background, 'assets/events/steam.png');
});

// ------------------------------------------------------------------ the steps

test('the progress steps only ever move forwards', () => {
  const ordered = ['content', 'save', 'game', 'ready'];
  let last = 0;
  for (const name of ordered) {
    const step = BOOT_STEPS[name];
    assert.ok(step, `there is no "${name}" step`);
    assert.ok(step.at > last, `${name} does not advance the bar`);
    assert.ok(step.text, `${name} says nothing`);
    last = step.at;
  }
  assert.equal(last, 1, 'the last step must fill the bar');
});

test('nothing but the last step reaches the end', () => {
  // A bar that hits 100% and then waits is worse than no bar at all.
  for (const [name, step] of Object.entries(BOOT_STEPS)) {
    if (name === 'ready') continue;
    assert.ok(step.at < 1, `${name} fills the bar before the game is up`);
  }
});

// -------------------------------------------------------------- the overlay

test('the boot overlay is inline in the HTML, not fetched', () => {
  // The one thing on the page that must paint before any stylesheet or module
  // arrives. If this ever moves into a .css file it stops being a loading
  // screen and becomes another thing to wait for.
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const boot = html.slice(html.indexOf('<body>'), html.indexOf('<div id="app"'));

  assert.ok(boot.includes('id="boot"'), 'the overlay should be in the body');
  assert.ok(boot.includes('<style>'), 'and carry its own styles inline');
  assert.ok(boot.includes('id="bootFill"') && boot.includes('id="bootStatus"'));
  assert.ok(boot.includes('background: #150f1c'), 'painted with a literal colour, not a token');
  assert.ok(boot.includes('prefers-reduced-motion'), 'and it must respect reduced motion');
});

test('the overlay sits above the game and gets out of the way', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /\.boot\s*\{[^}]*z-index:\s*\d+/, 'it has to cover the game');
  assert.match(html, /\.boot\.is-done\s*\{[^}]*pointer-events:\s*none/,
    'an invisible overlay that still eats the first tap is worse than no overlay');
});

test('the overlay outranks every layer in the stylesheets', () => {
  // It was 90, which is under the modal layer (100) and the story cutscene
  // (120) — so the opening cutscene painted over the boot screen for the whole
  // of its fade. A stacking context is not something one file can get right
  // alone, so this reads the real numbers out of styles/ rather than pinning a
  // constant that drifts the moment a panel is added.
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const boot = Number(html.match(/\.boot\s*\{[^}]*z-index:\s*(\d+)/)[1]);

  const dir = new URL('../styles/', import.meta.url);
  let highest = 0;
  let owner = '(none)';
  for (const file of readdirSync(dir)) {
    const css = readFileSync(new URL(file, dir), 'utf8');
    for (const [, value] of css.matchAll(/z-index:\s*(\d+)/g)) {
      if (Number(value) > highest) { highest = Number(value); owner = file; }
    }
  }

  assert.ok(boot > highest,
    `the boot screen is z-index ${boot}, under ${owner}'s ${highest} — it would be painted over`);
});

test('finishing fills the bar rather than fading out mid-sentence', () => {
  // step() refuses to write once the screen is done, which is right: a late
  // callback must not scribble on a fading overlay. But finish() set that flag
  // before asking for the final step, so the flag swallowed the one call that
  // mattered — the bar stopped whereever it was and the screen faded out
  // looking like a stall.
  const source = readFileSync(new URL('../src/ui/bootScreen.js', import.meta.url), 'utf8');
  const body = source.slice(source.indexOf('  finish()'));
  const readyAt = body.indexOf("this.step('ready')");
  const doneAt = body.indexOf('this.done = true');

  assert.ok(readyAt > -1 && doneAt > -1, 'finish() should do both');
  assert.ok(readyAt < doneAt, 'the final step has to go in before the done flag closes the door');
});
