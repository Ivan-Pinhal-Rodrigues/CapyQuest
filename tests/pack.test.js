// The content pack: what it may change, what it must never break, and what
// happens when it is nonsense.
//
// The pack is the one input in the game that is neither code the tests cover
// nor a save the reconciler repairs — an admin edits it by hand and commits it.
// So the most valuable tests here are the ugly ones: garbage in, defaults out,
// game still runs.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  applyPack, boostById, cosmeticById, currentPack, leafPackById, liveBoosts,
  liveCosmetics, liveCosmeticKinds, liveEventDefs, liveLeafPacks, packWarnings,
  passRewardFor, resetContent, rotatingEvents, scheduledEvents, shopCosmetics,
} from '../src/content/registry.js';
import { validatePack } from '../src/content/schema.js';
import { mergePacks, PACK_README } from '../src/content/load.js';
import { COSMETICS } from '../src/data/cosmetics.js';
import { BOOSTS } from '../src/data/boosts.js';
import { LEAF_PACKS } from '../src/data/leafPacks.js';
import { EVENTS } from '../src/data/events.js';
import { freeReward, premiumReward } from '../src/data/pass.js';
import { createState } from '../src/state.js';
import { buyCosmetic, equipped, grant, owns } from '../src/systems/cosmetics.js';
import { buyBoost, buyLeafPack } from '../src/systems/store.js';
import { activeEvent, nextEvent } from '../src/systems/events.js';

// Every test starts from the shipped tables. A pack left applied by an earlier
// test would make the next one lie.
function clean() {
  resetContent();
}

// ---------------------------------------------------------------- the basics

test('with no pack, the catalogue is exactly what the game ships', () => {
  clean();
  assert.equal(liveCosmetics().length, COSMETICS.length);
  assert.equal(liveBoosts().length, BOOSTS.length);
  assert.equal(liveLeafPacks().length, LEAF_PACKS.length);
  assert.equal(liveEventDefs().length, EVENTS.length);
  assert.deepEqual(currentPack(), {});
});

test('a patch changes one field and leaves the rest alone', () => {
  clean();
  const before = cosmeticById('skin', 'void');
  applyPack({ cosmetics: { patch: { 'skin:void': { cost: 999 } } } });
  const after = cosmeticById('skin', 'void');

  assert.equal(after.cost, 999);
  assert.equal(after.name, before.name, 'the name should be untouched');
  assert.equal(after.blurb, before.blurb, 'the blurb should be untouched');
  clean();
});

test('an addition lands at the end and is buyable', () => {
  clean();
  applyPack({
    cosmetics: {
      add: [{ kind: 'title', id: 'earlyBird', name: 'Early Bird', source: 'store', cost: 120, blurb: 'Up early.' }],
    },
  });

  const state = createState();
  state.leafs = 500;
  const result = buyCosmetic(state, 'title', 'earlyBird');

  assert.equal(result.ok, true);
  assert.equal(state.leafs, 380);
  assert.equal(owns(state, 'title', 'earlyBird'), true);
  clean();
});

test('adding an id that already exists patches it rather than duplicating it', () => {
  clean();
  const before = liveCosmetics().length;
  applyPack({ cosmetics: { add: [{ kind: 'skin', id: 'void', name: 'Void', source: 'store', cost: 10 }] } });

  assert.equal(liveCosmetics().length, before, 'no duplicate entry');
  assert.equal(cosmeticById('skin', 'void').cost, 10);
  clean();
});

// ------------------------------------------------ hidden vs removed vs owned

test('hiding pulls something off the shelf without taking it from anyone', () => {
  clean();
  const state = createState();
  grant(state, 'skin', 'void');

  applyPack({ cosmetics: { patch: { 'skin:void': { hidden: true } } } });

  assert.equal(owns(state, 'skin', 'void'), true, 'still owned');
  assert.ok(!shopCosmetics().some((c) => c.id === 'void'), 'gone from the shop');

  const shopper = createState();
  shopper.leafs = 5000;
  assert.equal(buyCosmetic(shopper, 'skin', 'void').reason, 'notForSale');
  clean();
});

test('removing a cosmetic does not remove it from a wardrobe', () => {
  clean();
  const state = createState();
  grant(state, 'skin', 'void');
  state.cosmetics.skin = 'void';

  applyPack({ cosmetics: { remove: ['skin:void'] } });

  assert.equal(cosmeticById('skin', 'void'), null, 'gone from the catalogue');
  assert.equal(owns(state, 'skin', 'void'), true, 'a pack must never take a look off a player');
  assert.equal(equipped(state, 'skin'), 'void', 'and it stays worn');
  clean();
});

test('a hidden boost and a hidden leaf pack cannot be bought', () => {
  clean();
  applyPack({
    boosts: { patch: { [BOOSTS[0].id]: { hidden: true } } },
    leafPacks: { patch: { handful: { hidden: true } } },
  });

  const state = createState();
  state.leafs = 100000;
  assert.equal(buyBoost(state, BOOSTS[0].id).reason, 'unknown');
  assert.equal(buyLeafPack(state, 'handful').reason, 'unknown');
  assert.ok(!liveLeafPacks().some((p) => p.id === 'handful'));
  clean();
});

test('patching something that is not there is a no-op, not a crash', () => {
  clean();
  const before = liveBoosts().length;
  applyPack({ boosts: { patch: { notAThing: { cost: 1 } } } });
  assert.equal(liveBoosts().length, before);
  clean();
});

// ------------------------------------------------------------ the pass table

test('a pass override replaces one level and only that level', () => {
  clean();
  applyPack({ pass: { premium: { 50: { leafs: 300, text: '300 leafs' } } } });

  assert.deepEqual(passRewardFor(50, 'premium'), { leafs: 300, text: '300 leafs' });
  assert.deepEqual(passRewardFor(51, 'premium'), premiumReward(51));
  assert.deepEqual(passRewardFor(50, 'free'), freeReward(50), 'the other track is untouched');
  clean();
});

// -------------------------------------------------------------- event clocks

test('an event with dates runs on the clock and beats the rotation', () => {
  clean();
  const start = Date.UTC(2030, 0, 10);
  const end = Date.UTC(2030, 0, 20);
  applyPack({
    events: {
      patch: {
        steamFestival: {
          live: true,
          startsAt: new Date(start).toISOString(),
          endsAt: new Date(end).toISOString(),
        },
      },
    },
  });

  assert.equal(scheduledEvents().length, 1);
  assert.ok(!rotatingEvents().some((e) => e.id === 'steamFestival'));

  const during = activeEvent(start + 86400e3);
  assert.equal(during.id, 'steamFestival');
  assert.ok(during.key.startsWith('at:'), 'a dated occurrence has its own key');
  assert.equal(during.msLeft, end - (start + 86400e3));

  const after = activeEvent(end + 1000);
  assert.notEqual(after?.id, 'steamFestival', 'it stops when it says it stops');
  clean();
});

test('a dated event that has not started yet shows up as what is next', () => {
  clean();
  const start = Date.UTC(2030, 5, 1);
  applyPack({
    events: {
      patch: {
        crystalTide: {
          live: true,
          startsAt: new Date(start).toISOString(),
          endsAt: new Date(start + 5 * 86400e3).toISOString(),
        },
      },
    },
  });

  const next = nextEvent(start - 3600e3);
  assert.equal(next.id, 'crystalTide');
  assert.equal(next.inMs, 3600e3);
  clean();
});

test('two overlapping dated events resolve to the one closing soonest', () => {
  clean();
  const now = Date.UTC(2031, 2, 2);
  applyPack({
    events: {
      patch: {
        steamFestival: {
          live: true,
          startsAt: new Date(now - 86400e3).toISOString(),
          endsAt: new Date(now + 10 * 86400e3).toISOString(),
        },
        crystalTide: {
          live: true,
          startsAt: new Date(now - 86400e3).toISOString(),
          endsAt: new Date(now + 2 * 86400e3).toISOString(),
        },
      },
    },
  });

  assert.equal(activeEvent(now).id, 'crystalTide');
  clean();
});

// ------------------------------------------------------------------- garbage

test('a pack of pure nonsense leaves the game on its defaults', () => {
  clean();
  const shipped = liveCosmetics().length;

  for (const junk of [null, undefined, 42, 'hello', [], { cosmetics: 'no' }, { cosmetics: { add: 'no' } }]) {
    applyPack(junk);
    assert.equal(liveCosmetics().length, shipped, `${JSON.stringify(junk)} should change nothing`);
  }
  clean();
});

test('every malformed entry is dropped individually, not in a batch', () => {
  clean();
  const { warnings } = applyPack({
    cosmetics: {
      add: [
        { kind: 'title', id: 'good', name: 'Good', source: 'store', cost: 10 },
        { kind: 'nonsense', id: 'bad', name: 'Bad' },
        { kind: 'title', name: 'No id' },
        { kind: 'skin', id: 'notAPalette', name: 'Missing palette' },
      ],
    },
  });

  assert.equal(warnings.length, 3, 'three bad entries, three warnings');
  assert.ok(cosmeticById('title', 'good'), 'the good one still lands');
  assert.equal(cosmeticById('title', 'bad'), null);
  clean();
});

test('a skin naming a palette the renderer does not have is refused', () => {
  const { pack, warnings } = validatePack({
    cosmetics: { add: [{ kind: 'skin', id: 'chartreuse', name: 'Chartreuse' }] },
  });
  assert.equal(pack.cosmetics, undefined);
  assert.match(warnings[0], /palette/);
});

test('an event cannot start without also stopping', () => {
  const { warnings } = validatePack({
    events: { patch: { steamFestival: { startsAt: '2030-01-01T00:00:00Z' } } },
  });
  assert.match(warnings[0], /together/);

  const backwards = validatePack({
    events: {
      patch: { steamFestival: { startsAt: '2030-02-01T00:00:00Z', endsAt: '2030-01-01T00:00:00Z' } },
    },
  });
  assert.match(backwards.warnings[0], /after/);
});

test('a reward that pays nothing is refused', () => {
  const { warnings } = validatePack({ pass: { free: { 10: { text: 'nothing at all' } } } });
  assert.match(warnings[0], /pays nothing/);
});

test('a pack cannot smuggle in a field nobody validates', () => {
  clean();
  applyPack({
    cosmetics: {
      add: [{ kind: 'title', id: 'sneaky', name: 'Sneaky', source: 'store', cost: 1, clickMult: 1000 }],
    },
  });
  assert.equal(cosmeticById('title', 'sneaky').clickMult, undefined);
  clean();
});

test('warnings survive until the next apply, for the admin panel to show', () => {
  clean();
  applyPack({ boosts: { add: [{ id: 'broken' }] } });
  assert.ok(packWarnings().length > 0);
  applyPack({});
  assert.equal(packWarnings().length, 0);
  clean();
});

// ------------------------------------------------------------------- merging

test('a draft merges over the committed file rather than replacing it', () => {
  const file = { cosmetics: { add: [{ kind: 'title', id: 'a', name: 'A' }] } };
  const draft = { cosmetics: { patch: { 'skin:void': { cost: 5 } } } };
  const merged = mergePacks(file, draft);

  assert.equal(merged.cosmetics.add.length, 1, "the file's addition survives");
  assert.equal(merged.cosmetics.patch['skin:void'].cost, 5, "the draft's patch is there too");
});

test('boostById and leafPackById see pack additions', () => {
  clean();
  applyPack({
    boosts: { add: [{ id: 'extra', name: 'Extra', cost: 10, hours: 1, effects: [{ type: 'globalMult', value: 2 }] }] },
    leafPacks: { add: [{ id: 'tiny', name: 'Tiny', leafs: 5, price: '£0.10' }] },
  });
  assert.equal(boostById('extra').name, 'Extra');
  assert.equal(leafPackById('tiny').leafs, 5);
  clean();
});

test('the fallback look of every kind survives a pack', () => {
  clean();
  applyPack({ cosmetics: { remove: ['skin:classic'] } });
  for (const kind of liveCosmeticKinds()) {
    assert.ok(kind.defaultId, `${kind.id} must keep a fallback`);
  }
  // Removing the default from the catalogue must not leave a player wearing
  // something that cannot be resolved.
  assert.equal(equipped(createState(), 'skin'), 'classic');
  clean();
});

test('the shipped pack.json is valid', async () => {
  const { warnings } = validatePack(await shippedPack());
  assert.deepEqual(warnings, [], `content/pack.json should be clean: ${warnings.join('; ')}`);
});

test('the shipped pack carries the same instructions the exporter writes', async () => {
  // The admin panel puts PACK_README back on every export. If the two drifted,
  // the first admin to export and commit would replace the file's guidance with
  // a stale copy — or an older one would overwrite a newer one.
  assert.deepEqual((await shippedPack())._readme, PACK_README);
});

test('the readme survives validation as an ignored key', async () => {
  const { pack } = validatePack(await shippedPack());
  assert.equal(pack._readme, undefined, 'underscore keys never reach the catalogue');
});

async function shippedPack() {
  const { readFileSync } = await import('node:fs');
  return JSON.parse(readFileSync(new URL('../content/pack.json', import.meta.url), 'utf8'));
}
