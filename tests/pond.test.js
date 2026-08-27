// The pond shows what you have built.
//
// Eighteen generators, thirty-six tiers, three hundred and six purchasable
// upgrades — and for three versions the pond looked identical at minute one and
// at hour fifty. BUILDING_ART had a shape and a palette for every generator and
// nothing drew them.
//
// The drawing itself is checked in the browser (tests/browser/) and by looking:
// the first two attempts here both produced something the numbers were happy
// with and the eye was not. What is worth asserting in node is the layout
// arithmetic — how many appear, and that they appear in the same place twice.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Scene } from '../src/render/scene.js';
import { BUILDING_ART } from '../src/render/palettes.js';
import { ICONS } from '../src/render/sprites.js';
import { BUILDINGS } from '../src/data/buildings.js';

/** Scene only touches the canvas when it draws; setBuildings is pure. */
const stubScene = () => new Scene({ getContext: () => ({}) });

test('nothing owned puts nothing on the bank', () => {
  const scene = stubScene();
  scene.setBuildings({});
  assert.deepEqual(scene.buildings, []);
});

test('how many appear grows with the log of how many you own', () => {
  // Not one sprite per building: the late game owns thousands, and a pond with
  // three thousand lily pads in it is not a pond. Logarithmic means an early
  // purchase visibly changes the place and a late one still adds something.
  const counts = [1, 2, 3, 4, 8, 16, 1024];
  const drawn = counts.map((n) => {
    const scene = stubScene();
    scene.setBuildings({ lilypad: n });
    return scene.buildings.length;
  });
  assert.deepEqual(drawn, [1, 2, 2, 3, 4, 5, 6]);
});

test('no single generator can take over the pond', () => {
  const scene = stubScene();
  scene.setBuildings({ lilypad: 1e12 });
  assert.ok(scene.buildings.length <= 6,
    `owning a trillion lily pads drew ${scene.buildings.length} of them`);
});

test('the pond looks the same every time you open it', () => {
  // Seeded from a hash of the id, not Math.random. A pond that rearranges
  // itself whenever you buy something is a pond you cannot learn the shape of.
  const owned = { lilypad: 40, yuzuSapling: 12, onsenBasin: 3 };
  const a = stubScene();
  const b = stubScene();
  a.setBuildings(owned);
  b.setBuildings(owned);
  assert.deepEqual(a.buildings, b.buildings);
});

test('positions spread across the bank rather than stacking', () => {
  // The first draft placed everything at an absolute fraction of the stage and
  // then clamped it outward past the capybara — which collapsed almost every
  // one onto the same x, and the late-game pond rendered as two vertical walls
  // of sprites. Nothing overlapped and nothing was off-canvas, so every number
  // was happy; it took a screenshot to see. `out` is a position within the
  // band, so it must actually vary.
  const scene = stubScene();
  scene.setBuildings(Object.fromEntries(BUILDINGS.map((b) => [b.id, 64])));
  const outs = new Set(scene.buildings.map((b) => b.out.toFixed(3)));
  assert.ok(outs.size > scene.buildings.length * 0.6,
    `${outs.size} distinct positions for ${scene.buildings.length} buildings — they are stacking`);
  for (const b of scene.buildings) {
    assert.ok(b.out >= 0 && b.out <= 1, `out ${b.out} is outside the band`);
  }
});

test('both banks are used', () => {
  const scene = stubScene();
  scene.setBuildings(Object.fromEntries(BUILDINGS.map((b) => [b.id, 8])));
  const left = scene.buildings.filter((b) => b.side < 0).length;
  const right = scene.buildings.filter((b) => b.side > 0).length;
  assert.ok(left > 0 && right > 0, 'everything ended up on one side');
  assert.ok(Math.abs(left - right) < scene.buildings.length * 0.35, 'the banks are lopsided');
});

test('every generator has art the pond can draw', () => {
  // The scene draws BUILDING_ART[id] through ICONS[shape]. A generator missing
  // either is one that silently never appears, which is exactly the bug this
  // whole phase existed to fix.
  for (const building of BUILDINGS) {
    const art = BUILDING_ART[building.id];
    assert.ok(art, `${building.id} has no entry in BUILDING_ART`);
    assert.ok(ICONS[art.shape], `${building.id} names shape "${art.shape}", which is not in ICONS`);
    assert.ok(art.palette, `${building.id} has no palette`);
  }
});

test('rebuilding is skipped when nothing changed', () => {
  // setBuildings runs on the UI tick. Re-seeding the layout every time would
  // both cost frames and reset the bob phases, freezing the animation.
  const scene = stubScene();
  scene.setBuildings({ lilypad: 4 });
  const first = scene.buildings;
  scene.setBuildings({ lilypad: 4 });
  assert.equal(scene.buildings, first, 'the array should not have been rebuilt');
  scene.setBuildings({ lilypad: 5 });
  assert.notEqual(scene.buildings, first, 'a purchase must rebuild it');
});
