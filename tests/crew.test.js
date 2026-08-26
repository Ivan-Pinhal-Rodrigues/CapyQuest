// The pond crew: the party's gear and the party's hats.
//
// The load-bearing tests here are the boundaries between the two halves. Gear
// carries stats and hats do not, they share a panel, and the one mistake that
// would matter is a hat quietly becoming a stat stick — which is exactly the
// promise the wardrobe makes for the player and has to keep making for the crew.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createState, reconcileState } from '../src/state.js';
import { combatStats } from '../src/systems/combatStats.js';
import { recomputeDerived } from '../src/systems/stats.js';
import { grant } from '../src/systems/cosmetics.js';
import {
  CREW_BAG_CAP, addCrewItem, crewCollection, crewEquipped, crewEquippedItems,
  crewGearStats, crewHat, crewInventory, crewUnequipped, equipCrewItem,
  resolveCrewItem, rollCrewLoot, scrapCrewItem, setCrewHat, unequipCrewItem,
} from '../src/systems/crew.js';
import {
  COMPANION_BUDGET_SHARE, COMPANION_GEAR, COMPANION_SLOT_IDS, companionStatsFor,
} from '../src/data/companionGear.js';
import { COMPANIONS } from '../src/data/companions.js';
import { HATS } from '../src/data/cosmetics.js';
import { budget, MAX_TIER } from '../src/data/rarities.js';
import { statsFor, gearScore, GEAR_BY_ID } from '../src/data/gear.js';
import { rebirth } from '../src/systems/rebirth.js';
import { ascend, ASCEND_MIN_REBIRTHS } from '../src/systems/ascension.js';

/** A save with three companions in the party and a stocked bag. */
function crewed() {
  const s = createState();
  for (const id of ['pip', 'moss', 'ripple']) {
    s.gacha.companions[id] = { level: 1, shards: 0, hat: 'none', gear: {} };
  }
  s.gacha.party = ['pip', 'moss', 'ripple'];
  return s;
}

// -------------------------------------------------------------- the table

test('every companion piece is complete and on a real slot', () => {
  const seen = new Set();
  for (const def of COMPANION_GEAR) {
    assert.ok(!seen.has(def.id), `duplicate companion gear id "${def.id}"`);
    seen.add(def.id);
    assert.ok(def.name && def.blurb, `${def.id}: incomplete`);
    assert.ok(COMPANION_SLOT_IDS.includes(def.slot), `${def.id}: unknown slot "${def.slot}"`);
    assert.ok(def.tier >= 0 && def.tier <= MAX_TIER, `${def.id}: off the ladder`);
    assert.ok(Object.keys(def.stats).length > 0, `${def.id}: no stats`);
  }
});

test('every slot has pieces across the whole ladder', () => {
  // A slot whose best piece is rung 4 is a slot that stops mattering at stage 10.
  for (const slot of COMPANION_SLOT_IDS) {
    const inSlot = COMPANION_GEAR.filter((g) => g.slot === slot);
    assert.ok(inSlot.length >= 6, `${slot} has only ${inSlot.length} pieces`);
    assert.ok(Math.min(...inSlot.map((g) => g.tier)) === 0, `${slot} has nothing at the bottom`);
    assert.ok(Math.max(...inSlot.map((g) => g.tier)) >= 13, `${slot} tops out too low`);
  }
});

test('a companion piece is worth its stated share of a player piece', () => {
  // Companions already contribute level-scaled stats of their own, so gear here
  // is a bonus on a bonus. At parity the crew would out-scale the capybara
  // wearing it, which is the wrong shape for a game about one capybara.
  for (const tier of [0, 5, 10, 15, 19]) {
    const crew = companionStatsFor(COMPANION_GEAR.find((g) => g.slot === 'charm'), { tier });
    const player = statsFor(GEAR_BY_ID.strawHat, { tier });
    const ratio = gearScore(crew) / gearScore(player);
    assert.ok(
      Math.abs(ratio - COMPANION_BUDGET_SHARE) < 0.12,
      `rung ${tier}: crew gear is ${ratio.toFixed(2)}x player gear, not ~${COMPANION_BUDGET_SHARE}`,
    );
  }
});

test('the ladder is the same ladder', () => {
  // A companion piece on rung 9 and a player piece on rung 9 differ by the
  // share above and nothing else — same curve, same star step.
  const def = COMPANION_GEAR[0];
  const low = companionStatsFor(def, { tier: 3 });
  const high = companionStatsFor(def, { tier: 8 });
  const expected = budget(8) / budget(3);
  const actual = gearScore(high) / gearScore(low);
  assert.ok(Math.abs(actual - expected) < expected * 0.05, `slope ${actual} vs ${expected}`);
});

// ---------------------------------------------------------------- the bag

test('a dropped piece lands in its own bag, not the player inventory', () => {
  const s = crewed();
  const entry = addCrewItem(s, 'pebblePouch', { tier: 4, stars: 2 });

  assert.ok(entry);
  assert.equal(s.companionGear.length, 1);
  assert.equal(s.combat.inventory.length, 0, 'crew gear must not reach the player bag');
  assert.equal(resolveCrewItem(entry).tier, 4);
  assert.equal(resolveCrewItem(entry).stars, 2);
});

test('a full bag drops the weakest unworn piece rather than refusing', () => {
  const s = crewed();
  for (let i = 0; i < CREW_BAG_CAP; i++) addCrewItem(s, 'pebblePouch', { tier: 5 });
  assert.equal(s.companionGear.length, CREW_BAG_CAP);

  const good = addCrewItem(s, 'quietBead', { tier: 14, stars: 5 });
  assert.ok(good, 'the drop should still land');
  assert.equal(s.companionGear.length, CREW_BAG_CAP, 'and the bag should not grow');
  assert.ok(s.companionGear.some((e) => e.uid === good.uid));
});

test('a worn piece is never the one thrown out to make room', () => {
  const s = crewed();
  const treasured = addCrewItem(s, 'pebblePouch', { tier: 0, stars: 1 });
  equipCrewItem(s, 'pip', treasured.uid);

  for (let i = 0; i < CREW_BAG_CAP + 5; i++) addCrewItem(s, 'reedKnot', { tier: 6 });

  assert.ok(
    s.companionGear.some((e) => e.uid === treasured.uid),
    'the weakest piece in the bag was equipped and got evicted anyway',
  );
});

test('scrapping refuses a piece somebody is wearing', () => {
  const s = crewed();
  const entry = addCrewItem(s, 'warmStone', { tier: 3 });
  equipCrewItem(s, 'pip', entry.uid);

  assert.equal(scrapCrewItem(s, entry.uid).reason, 'worn');
  assert.equal(s.companionGear.length, 1);

  unequipCrewItem(s, 'pip', 'charm');
  assert.equal(scrapCrewItem(s, entry.uid).ok, true);
  assert.equal(s.companionGear.length, 0);
});

// ------------------------------------------------------------- equipping

test('a piece moves rather than duplicating when given to somebody else', () => {
  // The bag is shared. The same charm on two capybaras would be its stats twice
  // for free, which is the one way a shared bag can go wrong.
  const s = crewed();
  const entry = addCrewItem(s, 'emberCoal', { tier: 9 });

  equipCrewItem(s, 'pip', entry.uid);
  assert.equal(crewEquipped(s, 'pip', 'charm').uid, entry.uid);

  equipCrewItem(s, 'moss', entry.uid);
  assert.equal(crewEquipped(s, 'moss', 'charm').uid, entry.uid);
  assert.equal(crewEquipped(s, 'pip', 'charm'), null, 'it should have left Pip');
});

test('a piece lands in the slot its definition names', () => {
  const s = crewed();
  for (const slot of COMPANION_SLOT_IDS) {
    const def = COMPANION_GEAR.find((g) => g.slot === slot);
    const entry = addCrewItem(s, def.id);
    equipCrewItem(s, 'pip', entry.uid);
    assert.equal(crewEquipped(s, 'pip', slot).id, def.id);
  }
  assert.equal(crewEquippedItems(s, 'pip').length, COMPANION_SLOT_IDS.length);
});

test('the picker only offers pieces nobody is wearing', () => {
  const s = crewed();
  const a = addCrewItem(s, 'pebblePouch');
  const b = addCrewItem(s, 'reedKnot');

  assert.equal(crewUnequipped(s, 'charm').length, 2);
  equipCrewItem(s, 'pip', a.uid);
  const free = crewUnequipped(s, 'charm');
  assert.equal(free.length, 1);
  assert.equal(free[0].uid, b.uid);
});

test('equipping a companion you do not own is refused', () => {
  const s = crewed();
  const entry = addCrewItem(s, 'pebblePouch');
  assert.equal(equipCrewItem(s, 'capybaraPrime', entry.uid).reason, 'notOwned');
});

// ---------------------------------------------------------------- stats

test('gear on a party member reaches the combat block', () => {
  const s = crewed();
  const before = combatStats(s).atk;

  const entry = addCrewItem(s, 'snapperTooth', { tier: 12, stars: 3 });
  equipCrewItem(s, 'pip', entry.uid);

  assert.ok(combatStats(s).atk > before, 'a charm on a party member should raise ATK');
});

test('gear on a companion outside the party changes nothing', () => {
  const s = crewed();
  s.gacha.companions.fern = { level: 1, shards: 0, hat: 'none', gear: {} };
  const before = combatStats(s).power;

  const entry = addCrewItem(s, 'quietBead', { tier: 19, stars: 5 });
  equipCrewItem(s, 'fern', entry.uid);

  assert.equal(combatStats(s).power, before, 'only the party contributes');
});

test('gear is not multiplied by companion level', () => {
  // The piece is already scaled by its own rung. Multiplying the two would make
  // one charm worth several times more on a levelled companion than a fresh
  // one, which is a stealth requirement to level before equipping.
  const a = crewed();
  const b = crewed();
  b.gacha.companions.pip.level = 20;

  const entry = addCrewItem(a, 'emberCoal', { tier: 10 });
  equipCrewItem(a, 'pip', entry.uid);
  const gearOnly = crewGearStats(a, 'pip');

  const entryB = addCrewItem(b, 'emberCoal', { tier: 10 });
  equipCrewItem(b, 'pip', entryB.uid);

  assert.deepEqual(crewGearStats(b, 'pip'), gearOnly);
});

// ----------------------------------------------------------------- hats

test('a crew hat moves no number', () => {
  // The same promise the player's wardrobe makes. A hat on a companion sits
  // right next to three things that DO carry stats, which is exactly why it is
  // worth asserting rather than trusting.
  const s = crewed();
  s.buildings.lilypad = 100;
  s.combat.xp = 40000;

  const before = { zps: recomputeDerived(s).zps, power: combatStats(s).power };

  for (const hat of HATS) {
    grant(s, 'hat', hat.id);
    for (const id of s.gacha.party) {
      setCrewHat(s, id, hat.id);
      assert.equal(recomputeDerived(s).zps, before.zps, `${hat.name} moved income`);
      assert.equal(combatStats(s).power, before.power, `${hat.name} moved combat`);
    }
  }
});

test('a hat you do not own cannot be put on the crew', () => {
  const s = crewed();
  assert.equal(setCrewHat(s, 'pip', 'goldCrown').reason, 'locked');
  assert.equal(crewHat(s, 'pip'), 'none');

  grant(s, 'hat', 'goldCrown');
  assert.equal(setCrewHat(s, 'pip', 'goldCrown').ok, true);
  assert.equal(crewHat(s, 'pip'), 'goldCrown');
});

test('bare is always available', () => {
  const s = crewed();
  grant(s, 'hat', 'topHat');
  setCrewHat(s, 'pip', 'topHat');
  assert.equal(setCrewHat(s, 'pip', 'none').ok, true);
  assert.equal(crewHat(s, 'pip'), 'none');
});

test('a hat that has left the catalogue resolves to bare rather than breaking', () => {
  const s = crewed();
  s.gacha.companions.pip.hat = 'somethingRemoved';
  assert.equal(crewHat(s, 'pip'), 'none');
});

// ---------------------------------------------------------------- drops

test('crew drops are gated by depth like everything else', () => {
  // A stage-2 boss must not be able to hand out a rung-19 piece.
  const rng = () => 0.01; // always drops, always the lowest roll
  for (const stage of [0, 2, 6, 20]) {
    const drop = rollCrewLoot(stage, { rng });
    if (!drop) continue;
    assert.ok(drop.tier <= Math.floor(stage / 2), `stage ${stage} dropped rung ${drop.tier}`);
  }
});

test('a bad roll drops nothing rather than throwing', () => {
  assert.equal(rollCrewLoot(10, { rng: () => 0.99 }), null);
});

// ----------------------------------------------------------------- saves

test('a save from before the crew existed loads with empty kit', () => {
  const old = createState();
  old.gacha.companions = { pip: { level: 3, shards: 1 } };
  delete old.companionGear;

  const fixed = reconcileState(old);
  assert.deepEqual(fixed.companionGear, []);
  assert.deepEqual(fixed.gacha.companions.pip.gear, {});
  assert.equal(fixed.gacha.companions.pip.hat, 'none');
  assert.equal(fixed.gacha.companions.pip.level, 3, 'the level it had must survive');
});

test('an equip reference to a piece no longer in the bag is dropped', () => {
  const s = crewed();
  s.gacha.companions.pip.gear = { charm: 'ghost' };
  const fixed = reconcileState(s);
  assert.deepEqual(fixed.gacha.companions.pip.gear, {});
});

test('a hand-edited bag is repaired rather than trusted', () => {
  const s = crewed();
  s.companionGear = [
    { uid: 'a', id: 'pebblePouch', tier: 999, stars: 99 },
    { uid: 'b' },
    'nonsense',
    null,
  ];
  const fixed = reconcileState(s);
  assert.equal(fixed.companionGear.length, 1);
  assert.equal(fixed.companionGear[0].tier, 19);
  assert.equal(fixed.companionGear[0].stars, 5);
});

test('the collection counts what has been found, not what is held', () => {
  const s = crewed();
  addCrewItem(s, 'pebblePouch');
  addCrewItem(s, 'pebblePouch');
  addCrewItem(s, 'reedKnot');

  const found = crewCollection(s);
  assert.equal(found.owned, 2, 'two distinct pieces');
  assert.equal(found.held, 3, 'three in the bag');
  assert.equal(found.total, COMPANION_GEAR.length);
});

test('every companion has a skin the renderer can draw', () => {
  // The crew are drawn in the pond now. A companion naming a palette that does
  // not exist used to be invisible; now it would be a capybara in the water
  // wearing the wrong colours.
  const inventory = crewInventory(crewed());
  assert.deepEqual(inventory, [], 'a fresh save has an empty bag');
  for (const def of COMPANIONS) {
    assert.ok(def.skin, `${def.id} has no skin`);
  }
});

// ---------------------------------------------------------------- resets

test('crew gear survives a rebirth and an ascension', () => {
  // A reset never costs a collection. companionGear lives outside `gacha`, so
  // it has to be on both keep lists by name — and it was not, on the first
  // pass: the field was added to the schema and both resets silently wiped it.
  const s = crewed();
  const entry = addCrewItem(s, 'quietBead', { tier: 14, stars: 4 });
  equipCrewItem(s, 'pip', entry.uid);

  s.combat.bestDepth = 400;
  s.combat.depth = 400;
  s.rebirthUnlocked = true;

  const after = rebirth(s);
  assert.equal(after.ok, true, 'the rebirth should have gone through');
  assert.equal(s.companionGear.length, 1, 'the bag was emptied by a rebirth');
  assert.equal(crewEquipped(s, 'pip', 'charm')?.id, 'quietBead', 'and it should still be worn');

  s.lifetimeEssence = 1e9;
  s.essence = 1e9;
  s.rebirthCount = ASCEND_MIN_REBIRTHS;
  const ascended = ascend(s);
  assert.equal(ascended.ok, true, 'the ascension should have gone through');
  assert.equal(s.companionGear.length, 1, 'the bag was emptied by an ascension');
});
