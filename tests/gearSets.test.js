// Gear sets.
//
// The postmortem's own open item: "gear is the only system with a real
// tradeoff, and it collapses late. Any piece can be carried to rung 20, so
// eventually there is one correct answer per slot." Sets move the question up
// a level — not "which hat" but "which set".
//
// Two of these tests exist because the first draft of the design was measured
// and found to be broken in ways that read fine on paper. They are the
// interesting ones.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { GEAR, GEAR_BY_ID, SLOT_IDS } from '../src/data/gear.js';
import { GEAR_SETS, GEAR_SETS_BY_ID, SET_THRESHOLDS, bonusesAt, setOf } from '../src/data/gearSets.js';
import { createState } from '../src/state.js';
import { addToInventory, equip } from '../src/systems/loot.js';
import { equippedSets, equippedBonuses } from '../src/systems/equipment.js';
import { combatStats } from '../src/systems/combatStats.js';
import { recomputeDerived } from '../src/systems/stats.js';
import { reachableStage } from '../src/systems/wall.js';

// ------------------------------------------------------------- the catalogue

test('every piece in a set exists', () => {
  // Written from display names the first time, which produced six ids that do
  // not exist — `justAStick` for `stickRod`, `onsenBasin` (a *building*) for
  // `onsenBasinBucket`. Silent: a missing id simply means a set nobody can
  // ever complete.
  for (const set of GEAR_SETS) {
    for (const id of set.pieces) {
      assert.ok(GEAR_BY_ID[id], `${set.id} names "${id}", which is not a gear piece`);
    }
  }
});

test('no piece belongs to two sets', () => {
  const seen = new Map();
  for (const set of GEAR_SETS) {
    for (const id of set.pieces) {
      assert.equal(seen.get(id), undefined, `${id} is in both ${seen.get(id)} and ${set.id}`);
      seen.set(id, set.id);
    }
  }
});

test('a set never holds two pieces for the same slot', () => {
  // You can only wear one hat. Two hats in a set caps it at five wearable
  // pieces, which would make a six-piece threshold unreachable and a
  // four-piece one quietly harder than it looks.
  for (const set of GEAR_SETS) {
    const slots = new Set();
    for (const id of set.pieces) {
      const slot = GEAR_BY_ID[id].slot;
      assert.ok(!slots.has(slot), `${set.id} has two ${slot} pieces`);
      slots.add(slot);
    }
  }
});

test('every set can actually be completed', () => {
  for (const set of GEAR_SETS) {
    assert.ok(set.pieces.length >= Math.max(...SET_THRESHOLDS),
      `${set.id} has ${set.pieces.length} pieces but a threshold at ${Math.max(...SET_THRESHOLDS)}`);
    assert.ok(set.identity, `${set.id} does not say what it is for`);
  }
});

test('some pieces belong to no set at all', () => {
  // On purpose. They are the raw-stat answer a set bonus has to beat; without
  // something to give up, committing to a set is not a choice.
  const inSets = new Set(GEAR_SETS.flatMap((s) => s.pieces));
  const free = GEAR.filter((g) => !inSets.has(g.id));
  assert.ok(free.length >= 4, `only ${free.length} setless pieces — nothing to trade away`);
});

// ----------------------------------------------------------------- counting

test('bonuses are cumulative and gated on equipped count', () => {
  const set = GEAR_SETS[0];
  assert.deepEqual(bonusesAt(set, 1), [], 'one piece grants nothing');
  assert.equal(bonusesAt(set, 2).length, set.bonuses[2].length);
  assert.equal(bonusesAt(set, 4).length, set.bonuses[2].length + set.bonuses[4].length,
    'four pieces must keep the two-piece bonus, not replace it');
  assert.deepEqual(bonusesAt(set, 6), bonusesAt(set, 4), 'there is no six-piece tier');
});

test('sets are counted from what is worn, not what is owned', () => {
  const set = GEAR_SETS_BY_ID.reedwater;
  const state = createState();

  // All six in the bag, none equipped.
  const uids = set.pieces.map((id) => addToInventory(state, id, { tier: 5 }).uid);
  assert.deepEqual(equippedSets(state), [], 'a set in the bag is a collection, not a build');

  equip(state, uids[0]);
  equip(state, uids[1]);
  const worn = equippedSets(state);
  assert.equal(worn.length, 1);
  assert.equal(worn[0].set.id, 'reedwater');
  assert.equal(worn[0].count, 2);
});

test('set bonuses reach the real bonus list', () => {
  const state = createState();
  const before = equippedBonuses(state).length;
  for (const id of GEAR_SETS_BY_ID.reedwater.pieces.slice(0, 2)) {
    equip(state, addToInventory(state, id, { tier: 5 }).uid);
  }
  assert.ok(equippedBonuses(state).length > before,
    'wearing two of a set must add its bonus to what stats.js reads');
});

test('setless pieces contribute to no set', () => {
  assert.equal(setOf('bambooHelm'), null);
  assert.equal(setOf('notAPieceAtAll'), null);
});

// -------------------------------------------------- the two measured failures

/** Everything at one rung, so a comparison is about shape and set, not luck. */
function wearing(ids, tier = 14) {
  const state = createState();
  state.combat.xp = 5e6;
  for (const id of Object.keys(state.buildings)) state.buildings[id] = 60;
  for (const id of ids) {
    const entry = addToInventory(state, id, { tier, stars: 1 });
    entry.forge = 12;
    equip(state, entry.uid);
  }
  return state;
}

/** The strongest individual piece per slot — what optimising slot-by-slot gives. */
const BEST_IN_SLOT = SLOT_IDS.map((slot) =>
  GEAR.filter((g) => g.slot === slot).sort((a, b) => b.tier - a.tier)[0].id);

test('no set is simply the best-in-slot pieces', () => {
  // The first draft of The Still Point was exactly the six highest-tier
  // pieces. Measured against a best-in-slot baseline it scored 0.0% — because
  // it WAS the baseline. A set that costs nothing to commit to decides
  // nothing, which is the collapse this whole system exists to fix.
  const bis = new Set(BEST_IN_SLOT);
  for (const set of GEAR_SETS) {
    const overlap = set.pieces.filter((id) => bis.has(id)).length;
    assert.ok(overlap < SLOT_IDS.length,
      `${set.id} is the best-in-slot loadout — wearing it gives up nothing`);
  }
});

test('every set wins at the thing it claims to be for', () => {
  // The first draft's bonuses were worth about 2% while a full set cost 24-29%
  // combat power and 55-64% income against best-in-slot. Every one of them was
  // strictly dominated: correct code, pointless mechanic.
  //
  // This pins the identities that are measurable. Bathhouse and Tideglass are
  // deliberately absent: DEF and HP are invisible to both of the game's own
  // metrics — `power` ignores crit entirely, and reachableStage() is pure DPS
  // against boss HP — so there is nothing honest to assert about them here.
  // docs/BALANCE.md says so rather than this test pretending otherwise.
  const base = wearing(BEST_IN_SLOT);
  const baseDerived = recomputeDerived(base);
  const baseDepth = reachableStage(combatStats(base));

  const income = recomputeDerived(wearing(GEAR_SETS_BY_ID.reedwater.pieces));
  assert.ok(income.zps > baseDerived.zps,
    `Reedwater is the income set and earns ${(income.zps / baseDerived.zps).toFixed(2)}x best-in-slot`);

  const offline = recomputeDerived(wearing(GEAR_SETS_BY_ID.dreamlight.pieces));
  assert.ok(offline.offlineCapMs > baseDerived.offlineCapMs * 1.5,
    'Dreamlight is the offline set and must hold a much larger cache');

  const power = reachableStage(combatStats(wearing(GEAR_SETS_BY_ID.stillPoint.pieces)));
  assert.ok(power >= baseDepth,
    `The Still Point is the power set and reaches stage ${power} against ${baseDepth}`);
});

test('a set bonus cannot be earned by hoarding', () => {
  // Rarity, stars and enhancement scale a piece's stats and never its bonus —
  // the same rule gear bonuses already follow. A set is about which six things
  // you chose, not how far you pushed them.
  const low = wearing(GEAR_SETS_BY_ID.reedwater.pieces, 2);
  const high = wearing(GEAR_SETS_BY_ID.reedwater.pieces, 18);
  const bonusesOf = (s) => equippedBonuses(s).filter((b) => b.type === 'zpsMult').length;
  assert.equal(bonusesOf(low), bonusesOf(high),
    'the same six pieces must grant the same set bonuses at any rung');
});
