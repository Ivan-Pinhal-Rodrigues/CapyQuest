// The pond shows what you have built.
//
// Forty-eight generators, ninety-six tiers — and for three versions the pond
// looked identical at minute one and at hour fifty.
//
// This file has now been rewritten twice, because the rule it describes has
// been wrong twice. Draft one drew each thing at an absolute fraction of the
// stage and clamped it past the capybara, which stacked the late-game pond into
// two vertical walls. Draft two drew up to six copies of each generator, which
// was legible at eighteen and became a hundred and eight sprites of texture at
// forty-eight. Both passed every assertion in the file at the time. Both were
// caught by looking at a screenshot.
//
// So: the drawing itself is checked in the browser and by eye. What is worth
// asserting here is the layout arithmetic — one of each, where it belongs, at a
// size that follows the count and a shape that follows the upgrades.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Scene } from '../src/render/scene.js';
import { BUILDING_ART } from '../src/render/palettes.js';
import { ICONS, SHAPE_FAMILIES, familyShape } from '../src/render/sprites.js';
import { BUILDINGS, HABITATS, buildingStage, buildingName } from '../src/data/buildings.js';

/** Scene only touches the canvas when it draws; setBuildings is pure. */
const stubScene = () => new Scene({ getContext: () => ({}) });

/** A state carrying only what the pond reads. */
const owning = (buildings, tierUpgrades = {}) => ({ buildings, tierUpgrades });

const everything = (n) => owning(Object.fromEntries(BUILDINGS.map((b) => [b.id, n])));

test('nothing owned puts nothing on the bank', () => {
  const scene = stubScene();
  scene.setBuildings(owning({}));
  assert.deepEqual(scene.buildings, []);
});

test('one of each, however many you own', () => {
  // The rule that replaced "up to six copies". A generator is a thing in the
  // pond, singular — buying more of it makes that thing bigger, not more
  // numerous. Six copies each read as clutter at eighteen generators and would
  // have been a hundred and eight sprites at forty-eight.
  for (const count of [1, 2, 40, 1e4, 1e12]) {
    const scene = stubScene();
    scene.setBuildings(owning({ lilypad: count }));
    assert.equal(scene.buildings.length, 1, `owning ${count} lily pads drew ${scene.buildings.length}`);
  }

  const all = stubScene();
  all.setBuildings(everything(500));
  assert.equal(all.buildings.length, BUILDINGS.length);
});

test('the pond looks the same every time you open it', () => {
  // Seeded from a hash of the id, not Math.random. A pond that rearranges
  // itself whenever you buy something is a pond you cannot learn the shape of.
  const state = owning({ lilypad: 40, yuzuSapling: 12, onsenBasin: 3 });
  const a = stubScene();
  const b = stubScene();
  a.setBuildings(state);
  b.setBuildings(state);
  assert.deepEqual(a.buildings, b.buildings);
});

test('a habitat spreads its occupants across the band rather than stacking them', () => {
  // Draft one's failure, in the form it can still take: `across` is a position
  // within the band, and if it does not vary the band renders as a column.
  const scene = stubScene();
  scene.setBuildings(everything(64));

  for (const habitat of HABITATS) {
    const here = scene.buildings.filter((b) => b.habitat === habitat);
    assert.ok(here.length > 0, `nothing lives in the ${habitat}`);
    const spots = new Set(here.map((b) => b.across.toFixed(3)));
    assert.equal(spots.size, here.length, `${habitat}: ${here.length} things share ${spots.size} positions`);
    for (const b of here) {
      assert.ok(b.across >= 0 && b.across <= 1, `${b.id}: across ${b.across} is outside the band`);
    }
  }
});

test('every habitat is used, and nothing is crowded into one', () => {
  // Five bands exist so the pond has depth. A habitat nobody lives in is a
  // wasted band; one holding half the catalogue is the old clutter under a new
  // name.
  const counts = HABITATS.map((h) => BUILDINGS.filter((b) => b.habitat === h).length);
  for (const [i, n] of counts.entries()) {
    assert.ok(n >= 4, `only ${n} generators live in the ${HABITATS[i]}`);
    assert.ok(n <= BUILDINGS.length * 0.35,
      `${n} of ${BUILDINGS.length} generators are in the ${HABITATS[i]} — that band is doing all the work`);
  }
});

test('a tier upgrade changes the drawing, and nothing else does', () => {
  // The user-facing rule of this phase, asserted directly: units grow the
  // thing, upgrades change what it is. A pond where everything only ever swells
  // is a pond where nothing ever arrives.
  const at = (tiers) => {
    const scene = stubScene();
    scene.setBuildings(owning({ lilypad: 60 }, tiers));
    return scene.buildings[0];
  };

  assert.equal(at({}).stage, 0);
  assert.equal(at({ lilypad_t1: true }).stage, 1);
  assert.equal(at({ lilypad_t1: true, lilypad_t2: true }).stage, 2);

  // Three stages, three different drawings.
  const shapes = [0, 1, 2].map((s) => familyShape('pad', s));
  assert.equal(new Set(shapes).size, 3, 'the three stages of a family must be three drawings');

  // Buying more units does not touch the stage.
  const scene = stubScene();
  scene.setBuildings(owning({ lilypad: 1 }));
  const before = scene.buildings[0].stage;
  scene.setBuildings(owning({ lilypad: 900 }));
  assert.equal(scene.buildings[0].stage, before, 'buying units changed the stage');
});

test('the name follows the stage, in the shop as well as the pond', () => {
  const pad = BUILDINGS[0];
  assert.equal(buildingName(pad, owning({}, {})), pad.name);
  assert.equal(buildingName(pad, owning({}, { lilypad_t1: true })), pad.stages[0]);
  assert.equal(buildingName(pad, owning({}, { lilypad_t1: true, lilypad_t2: true })), pad.stages[1]);

  // Every stage name is distinct from the base name and from each other,
  // because a rename that renames nothing is not a reward.
  for (const b of BUILDINGS) {
    const all = [b.name, ...b.stages];
    assert.equal(new Set(all).size, 3, `${b.id}: repeated stage names ${JSON.stringify(all)}`);
  }
});

test('an out-of-range stage clamps instead of throwing', () => {
  // A save carrying an upgrade for art that has since been trimmed must draw
  // the last stage there is, not take the whole pond down.
  assert.equal(familyShape('pad', 9), SHAPE_FAMILIES.pad[2]);
  assert.equal(familyShape('pad', -3), SHAPE_FAMILIES.pad[0]);
  assert.equal(familyShape('nosuchfamily', 0), null);
});

test('an old save arrives at stage one with nothing else disturbed', () => {
  // Thirty generators and sixty tier upgrades were added after 3.0 shipped.
  // `reconcileState` zero-fills unknown ids, so a 3.0 save has counts for the
  // first eighteen and nothing for the rest; the stage is read off the tier
  // upgrades rather than stored, so it needs no migration either.
  const oldSave = owning(
    Object.fromEntries(BUILDINGS.slice(0, 18).map((b) => [b.id, 25])),
    { lilypad_t1: true },
  );
  const scene = stubScene();
  scene.setBuildings(oldSave);

  assert.equal(scene.buildings.length, 18, 'the new generators must not appear unowned');
  assert.equal(scene.buildings.find((b) => b.id === 'lilypad').stage, 1);
  for (const b of scene.buildings) {
    if (b.id !== 'lilypad') assert.equal(b.stage, 0, `${b.id} came back at stage ${b.stage}`);
  }
  assert.equal(buildingStage('capybaraAbsolute', oldSave), 0);
});

test('every generator has art the pond can draw, at all three stages', () => {
  // A generator missing either half is one that silently never appears, which
  // is exactly the bug this whole line of work existed to fix.
  for (const building of BUILDINGS) {
    const art = BUILDING_ART[building.id];
    assert.ok(art, `${building.id} has no entry in BUILDING_ART`);
    assert.ok(art.palette, `${building.id} has no palette`);
    assert.ok(SHAPE_FAMILIES[building.family], `${building.id} names family "${building.family}", which does not exist`);
    for (const stage of [0, 1, 2]) {
      const shape = familyShape(building.family, stage);
      assert.ok(ICONS[shape], `${building.id} stage ${stage} wants "${shape}", which is not in ICONS`);
    }
  }
});

test('no two generators share a palette', () => {
  // With ten shapes covering forty-eight lines, colour is most of what tells
  // them apart. Two identical ramps on the same shape are two things the player
  // cannot distinguish in the pond at all.
  const seen = new Map();
  for (const [id, art] of Object.entries(BUILDING_ART)) {
    const key = [1, 2, 3, 4].map((slot) => art.palette[slot]).join('|');
    assert.ok(!seen.has(key), `${id} and ${seen.get(key)} have the same colour ramp`);
    seen.set(key, id);
  }
});

test('rebuilding is skipped when nothing changed', () => {
  // setBuildings runs on the UI tick. Re-seeding the layout every time would
  // both cost frames and reset the bob phases, freezing the animation.
  const scene = stubScene();
  scene.setBuildings(owning({ lilypad: 4 }));
  const first = scene.buildings;
  scene.setBuildings(owning({ lilypad: 4 }));
  assert.equal(scene.buildings, first, 'the array should not have been rebuilt');

  scene.setBuildings(owning({ lilypad: 5 }));
  assert.notEqual(scene.buildings, first, 'a purchase must rebuild it');

  // And a tier upgrade must too, or the pond keeps the old drawing.
  const after = scene.buildings;
  scene.setBuildings(owning({ lilypad: 5 }, { lilypad_t1: true }));
  assert.notEqual(scene.buildings, after, 'an upgrade must rebuild it');
});
