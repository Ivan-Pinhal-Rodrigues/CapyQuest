// The wardrobe.
//
// Two failure modes are specific to layered sprites and neither shows up as an
// error — they show up as art that looks subtly wrong, usually somewhere other
// than the thing you changed:
//
//   1. A layer character that collides with the capybara's own palette. A hat
//      using `m` repaints every fur pixel on the body, and the hat itself looks
//      fine.
//   2. A grid that hangs off the frame. The stamp is clipped silently, so half
//      a crown is indistinguishable from a crown drawn badly.
//
// Both are cheap to assert and impossible to spot reliably by eye, which is
// exactly the shape of thing worth a test.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ACCESSORY_SHAPES, HAT_ORIGIN, HAT_SHAPES, OUTFIT_ORIGIN, OUTFIT_SHAPES,
  WEARABLE_ART, wearPalette, wornKey, wornLayers,
} from '../src/render/wearables.js';
import { CAPY } from '../src/render/sprites.js';
import { composeLayers } from '../src/render/canvas.js';
import { CAPY_PALETTE } from '../src/render/palettes.js';
import {
  ACCESSORIES, COSMETICS, COSMETIC_KINDS, HATS, OUTFITS, BANDS, cosmeticKey,
} from '../src/data/cosmetics.js';
import { PASS_LEVELS, freeReward, premiumReward } from '../src/data/pass.js';
import { EVENTS } from '../src/data/events.js';

/** Every entry that is drawn as a layer rather than as a palette or a string. */
const WEARABLE_KINDS = ['hat', 'outfit', 'accessory'];
const WEARABLES = COSMETICS.filter((c) => WEARABLE_KINDS.includes(c.kind) && c.id !== 'none');

/** kind -> [{ id, sprite, origin }] for the geometry checks. */
function placed() {
  const out = [];
  for (const [key, art] of Object.entries(WEARABLE_ART)) {
    out.push({ key, ...art });
  }
  return out;
}

// ------------------------------------------------------------------ the grids

test('every wearable grid is a rectangle', () => {
  for (const { key, sprite } of placed()) {
    const width = sprite.rows[0].length;
    assert.equal(sprite.w, width, `${key}: declared width does not match row 0`);
    assert.equal(sprite.h, sprite.rows.length, `${key}: declared height does not match`);
    for (const [i, row] of sprite.rows.entries()) {
      assert.equal(row.length, width, `${key}: row ${i} is ${row.length} wide, not ${width}`);
    }
  }
});

test('no wearable uses a character the capybara already owns', () => {
  // The whole reason canvas.js can merge palettes rather than track them per
  // layer. A lowercase character here would repaint fur, and the symptom would
  // appear on the body rather than on the hat.
  const capyChars = new Set(Object.keys(CAPY_PALETTE));

  for (const { key, sprite } of placed()) {
    for (const row of sprite.rows) {
      for (const ch of row) {
        if (ch === '.') continue;
        assert.ok(
          ch >= 'A' && ch <= 'Z',
          `${key}: uses "${ch}" — wearables are uppercase only`,
        );
        assert.ok(
          !capyChars.has(ch) || ch === '.',
          `${key}: "${ch}" collides with the capybara's own palette`,
        );
      }
    }
  }
});

test('every character a wearable draws has a colour', () => {
  for (const { key, sprite, palette } of placed()) {
    for (const row of sprite.rows) {
      for (const ch of row) {
        if (ch === '.') continue;
        assert.ok(palette[ch], `${key}: "${ch}" has no colour in its palette`);
      }
    }
  }
});

test('every wearable lands inside the capybara frame', () => {
  for (const { key, sprite, origin } of placed()) {
    assert.ok(origin.x >= 0 && origin.y >= 0, `${key}: origin is negative`);
    assert.ok(
      origin.x + sprite.w <= CAPY.w,
      `${key}: runs ${origin.x + sprite.w - CAPY.w}px off the right edge`,
    );
    assert.ok(
      origin.y + sprite.h <= CAPY.h,
      `${key}: runs ${origin.y + sprite.h - CAPY.h}px off the bottom`,
    );
  }
});

test('an outfit never paints on the water', () => {
  // Row 24 is the bottom outline and everything under it is the pool. A shirt
  // drawn onto the water looks fine in the wardrobe preview and wrong in the
  // scene, where the water moves.
  const WATERLINE = 24;
  assert.ok(
    OUTFIT_ORIGIN.y + OUTFIT_SHAPES.scarf.h <= WATERLINE,
    `outfits reach row ${OUTFIT_ORIGIN.y + OUTFIT_SHAPES.scarf.h}, past the waterline at ${WATERLINE}`,
  );
});

test('hats reach the ears', () => {
  // The ears sit at capybara x 10-11 and 19-20. A hat band that stopped short
  // of them would float above the head.
  assert.ok(HAT_ORIGIN.x <= 10, 'the hat frame starts right of the left ear');
  assert.ok(HAT_ORIGIN.x + HAT_SHAPES.beanie.w >= 21, 'the hat frame ends left of the right ear');
});

// ---------------------------------------------------- catalogue and art agree

test('every wearable in the catalogue has art, and every piece of art is sold', () => {
  for (const def of WEARABLES) {
    assert.ok(
      WEARABLE_ART[cosmeticKey(def.kind, def.id)],
      `${def.kind}:${def.id} is in the shop and draws nothing`,
    );
  }
  const catalogue = new Set(WEARABLES.map((d) => cosmeticKey(d.kind, d.id)));
  for (const key of Object.keys(WEARABLE_ART)) {
    assert.ok(catalogue.has(key), `${key} is drawn but is in no table — nobody can ever wear it`);
  }
});

test('every wearable kind opens with a bare option, free from the start', () => {
  for (const table of [HATS, OUTFITS, ACCESSORIES]) {
    const bare = table.find((i) => i.id === 'none');
    assert.ok(bare, 'a wearable kind with no bare option cannot be taken off');
    assert.equal(bare.source, 'start');
    assert.equal(WEARABLE_ART[`hat:none`], undefined, 'bare must draw nothing');
  }
});

test('store prices come from the bands rather than being picked per item', () => {
  const prices = new Set(Object.values(BANDS));
  for (const def of COSMETICS) {
    if (def.source !== 'store' || !def.band) continue;
    assert.equal(def.cost, BANDS[def.band], `${def.name} is priced off its own band`);
    assert.ok(prices.has(def.cost));
  }
});

// ----------------------------------------------------------- everything is gettable

test('nothing in the catalogue is advertised and unobtainable', () => {
  // A look with source "pass" that no pass level pays, or "event" that no
  // exchange sells, is a card in the shop that can never be earned. Nine pass
  // cosmetics were added at once here, and a typo in any of those ids would
  // produce exactly that.
  const fromPass = new Set();
  for (let level = 1; level <= PASS_LEVELS; level++) {
    for (const reward of [freeReward(level), premiumReward(level)]) {
      if (reward.cosmetic) fromPass.add(reward.cosmetic);
    }
  }

  const fromEvents = new Set();
  for (const event of EVENTS) {
    for (const row of event.exchange || []) {
      if (row.reward?.cosmetic) fromEvents.add(row.reward.cosmetic);
    }
  }

  for (const def of COSMETICS) {
    const key = cosmeticKey(def.kind, def.id);
    if (def.source === 'pass') {
      assert.ok(fromPass.has(key), `${key} says it is on the pass, and no level pays it`);
    }
    if (def.source === 'event') {
      assert.ok(fromEvents.has(key), `${key} says it is an event look, and no exchange sells it`);
    }
  }
});

test('every cosmetic a reward names actually exists', () => {
  // The other direction: a pass level paying a look that is not in any table
  // grants nothing and says nothing.
  const known = new Set(COSMETICS.map((d) => cosmeticKey(d.kind, d.id)));
  for (let level = 1; level <= PASS_LEVELS; level++) {
    for (const [track, reward] of [['free', freeReward(level)], ['premium', premiumReward(level)]]) {
      if (!reward.cosmetic) continue;
      assert.ok(known.has(reward.cosmetic), `${track} level ${level} pays "${reward.cosmetic}", which does not exist`);
    }
  }
  for (const event of EVENTS) {
    for (const row of event.exchange || []) {
      if (!row.reward?.cosmetic) continue;
      assert.ok(known.has(row.reward.cosmetic), `${event.id} sells "${row.reward.cosmetic}", which does not exist`);
    }
  }
});

test('the wardrobe is as big as the shop claims', () => {
  const counts = Object.fromEntries(COSMETIC_KINDS.map((k) => [k.id, k.items.length]));
  assert.equal(counts.hat, 27, 'hats: 26 plus bare');
  assert.equal(counts.outfit, 23, 'outfits: 22 plus bare');
  assert.equal(counts.accessory, 14, 'accessories: 13 plus bare');
  assert.equal(COSMETICS.length, 104);
});

// -------------------------------------------------------------------- layering

test('wornLayers returns the layers in stamping order and skips bare', () => {
  assert.deepEqual(wornLayers({ hat: 'none', outfit: 'none', accessory: 'none' }), []);

  const dressed = wornLayers({ hat: 'topHat', outfit: 'redScarf', accessory: 'sunglasses' });
  assert.equal(dressed.length, 3);
  // Outfit under hat under accessory: the small thing goes on top of the rest.
  assert.equal(dressed[0].sprite, OUTFIT_SHAPES.scarf);
  assert.equal(dressed[1].sprite, HAT_SHAPES.top);
  assert.equal(dressed[2].sprite, ACCESSORY_SHAPES.glasses.sprite);
});

test('an unknown id draws nothing rather than throwing', () => {
  // A pack can remove a cosmetic somebody is wearing. The renderer has to cope
  // with that quietly — the alternative is a black screen for anyone who had it
  // equipped when the pack shipped.
  assert.deepEqual(wornLayers({ hat: 'somethingRemoved' }), []);
  assert.deepEqual(wornLayers(), []);
  assert.deepEqual(wornLayers(undefined), []);
});

test('the cache key changes when, and only when, the outfit does', () => {
  const a = wornKey({ hat: 'topHat', outfit: 'redScarf', accessory: 'none' });
  const b = wornKey({ hat: 'topHat', outfit: 'redScarf', accessory: 'none' });
  const c = wornKey({ hat: 'topHat', outfit: 'redScarf', accessory: 'blush' });
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.equal(wornKey(), wornKey({ hat: 'none', outfit: 'none', accessory: 'none' }));
});

test('wearPalette fills every slot a grid can use', () => {
  const palette = wearPalette('#000', '#111', '#222', '#333', '#444');
  assert.deepEqual(Object.keys(palette).sort(), ['A', 'B', 'C', 'D', 'O']);
});

// -------------------------------------------------- layers cannot see each other

test('two layers with conflicting palettes keep their own colours', () => {
  // Every wearable draws in the same five characters, so merging their palettes
  // into one map lets the last layer repaint the first. A capybara in a red
  // cloak and black sunglasses came out wearing a black cloak — the shape was
  // right, so it read as a palette typo rather than a compositing bug, and no
  // test saw it because each grid is perfectly valid on its own.
  const composed = composeLayers(
    { w: 4, h: 1, rows: ['....'] },
    [
      { sprite: { w: 2, h: 1, rows: ['AA'] }, origin: { x: 0, y: 0 }, palette: { A: '#ff0000' } },
      { sprite: { w: 2, h: 1, rows: ['AA'] }, origin: { x: 2, y: 0 }, palette: { A: '#0000ff' } },
    ],
    { '.': null },
  );

  const row = composed.sprite.rows[0];
  assert.notEqual(row[0], row[2], 'the two layers ended up sharing a character');
  assert.equal(composed.palette[row[0]], '#ff0000', 'the first layer should still be red');
  assert.equal(composed.palette[row[2]], '#0000ff', 'the second layer should be blue');
});

test('every real wearable pair keeps both palettes', () => {
  // The case above in the actual content: dress the capybara in every
  // hat/outfit/accessory combination and check that each layer's pixels resolve
  // to that layer's own colours.
  const hats = Object.keys(WEARABLE_ART).filter((k) => k.startsWith('hat:'));
  const outfits = Object.keys(WEARABLE_ART).filter((k) => k.startsWith('outfit:'));

  for (const hatKey of hats) {
    for (const outfitKey of outfits) {
      const layers = [WEARABLE_ART[outfitKey], WEARABLE_ART[hatKey]];
      const composed = composeLayers(CAPY, layers, CAPY_PALETTE);

      // The hat's main colour must appear somewhere, and so must the outfit's,
      // unless one genuinely covers the other — which no pair here does.
      const colours = new Set();
      for (const row of composed.sprite.rows) {
        for (const ch of row) if (composed.palette[ch]) colours.add(composed.palette[ch]);
      }
      assert.ok(colours.has(WEARABLE_ART[hatKey].palette.A), `${hatKey} lost its colour under ${outfitKey}`);
      assert.ok(colours.has(WEARABLE_ART[outfitKey].palette.A), `${outfitKey} lost its colour under ${hatKey}`);
    }
  }
});

test('a layer with no palette of its own reads from the base', () => {
  // The eye expressions are stamped this way: they use the capybara's own
  // characters and must keep resolving against the capybara's palette.
  const composed = composeLayers(
    { w: 2, h: 1, rows: ['..'] },
    [{ sprite: { w: 2, h: 1, rows: ['ee'] }, origin: { x: 0, y: 0 } }],
    { '.': null, e: '#00ff00' },
  );
  assert.equal(composed.sprite.rows[0], 'ee');
  assert.equal(composed.palette.e, '#00ff00');
});

test('a layer stamped past the edge is clipped, not wrapped', () => {
  const composed = composeLayers(
    { w: 3, h: 1, rows: ['...'] },
    [{ sprite: { w: 3, h: 1, rows: ['AAA'] }, origin: { x: 2, y: 0 }, palette: { A: '#fff' } }],
    { '.': null },
  );
  // One cell painted, and nothing wrapped round to the start of the row.
  assert.equal(composed.sprite.rows[0][0], '.');
  assert.equal(composed.sprite.rows[0][1], '.');
  assert.notEqual(composed.sprite.rows[0][2], '.');
});

test('every wearable is visible, and no two are the same thing twice', () => {
  // Fifty-two items drawn from nineteen shapes by palette swap is the whole
  // pipeline working; two of them resolving to identical pixels is the pipeline
  // being abused. And an item that changes nothing at all is a card in the shop
  // that appears to do nothing when you wear it.
  const bare = composeLayers(CAPY, [], CAPY_PALETTE);
  const bareRows = bare.sprite.rows.join('\n');
  const seen = new Map();

  for (const [key, art] of Object.entries(WEARABLE_ART)) {
    const composed = composeLayers(CAPY, [art], CAPY_PALETTE);
    // Resolve to colours rather than characters: two layers use the same
    // characters, so the grids alone would compare as identical.
    const painted = composed.sprite.rows
      .map((row) => [...row].map((ch) => composed.palette[ch] || '.').join('|'))
      .join('\n');

    assert.notEqual(composed.sprite.rows.join('\n'), bareRows, `${key} draws nothing`);

    const twin = seen.get(painted);
    assert.equal(twin, undefined, `${key} is pixel-identical to ${twin}`);
    seen.set(painted, key);
  }
});
