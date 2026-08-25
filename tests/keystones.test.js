// Keystones, branch exclusivity and conditional nodes — the three things that
// turn 210 sliders into a build.
//
// The load-bearing tests here are the ones about *choice*: that you cannot take
// every keystone, that you cannot go deep in every branch, and that a
// conditional node which is switched off contributes nothing rather than
// contributing a zero.

import test from 'node:test';
import assert from 'node:assert/strict';

import { createState, reconcileState } from '../src/state.js';
import {
  KEYSTONES,
  KEYSTONES_BY_ID,
  KEYSTONE_COST,
  KEYSTONE_GATE,
  KEYSTONE_MAX,
  keystoneEffects,
  keystonesFor,
} from '../src/data/keystones.js';
import { CONDITIONS, NODE_CONDITIONS, conditionMultiplier } from '../src/data/conditions.js';
import { NODES_BY_ID, TREE_BRANCHES, TREE_EFFECT_TYPES } from '../src/data/rebirthTree.js';
import {
  DEEP_BRANCH_MAX,
  DEEP_TIER,
  canBuyNode,
  canGoDeep,
  canTakeKeystone,
  deepBranches,
  dropKeystone,
  hasKeystone,
  ownedKeystones,
  respec,
  takeKeystone,
  treeEffects,
  treeSummary,
} from '../src/systems/tree.js';
import { recomputeDerived } from '../src/systems/stats.js';
import { rebirth } from '../src/systems/rebirth.js';

/** A save with enough ranks in `branch` to open its keystones. */
function invested(branch, ranks = KEYSTONE_GATE, essence = KEYSTONE_COST * 5) {
  const s = createState();
  const node = Object.values(NODES_BY_ID).find((n) => n.branch === branch && n.tier === 1);
  s.tree[node.id] = ranks;
  s.essence = essence;
  return s;
}

// ------------------------------------------------------------------ content

test('every branch offers two keystones, fourteen in all', () => {
  assert.equal(KEYSTONES.length, 14);
  assert.equal(new Set(KEYSTONES.map((k) => k.id)).size, KEYSTONES.length);
  for (const branch of TREE_BRANCHES) {
    assert.equal(keystonesFor(branch.id).length, 2, `${branch.id} does not offer two`);
  }
});

test('every keystone gives something and takes something', () => {
  // The whole shape of the system. A keystone with no drawback is a big node.
  for (const k of KEYSTONES) {
    assert.ok(k.gain.length > 0, `${k.id} gains nothing`);
    assert.ok(k.cost.length > 0, `${k.id} costs nothing — that is just an upgrade`);
    assert.ok(k.name && k.line, `${k.id} has no copy`);
  }
});

test('every keystone effect speaks the shared vocabulary', () => {
  // A bespoke effect type would be silently ignored by the accumulator.
  for (const k of KEYSTONES) {
    for (const e of keystoneEffects(k)) {
      assert.ok(TREE_EFFECT_TYPES.includes(e.type), `${k.id}: unknown effect "${e.type}"`);
      assert.ok(Number.isFinite(e.value), `${k.id}: ${e.type} has no value`);
    }
  }
});

test('drawbacks are real reductions, not token ones', () => {
  const MULTIPLICATIVE = new Set(['clickMult', 'zpsMult', 'globalMult', 'allBuildingMult', 'buffMult']);
  for (const k of KEYSTONES) {
    for (const e of k.cost) {
      if (MULTIPLICATIVE.has(e.type)) {
        assert.ok(e.value < 1, `${k.id}: ${e.type} of ${e.value} is not a cost`);
        assert.ok(e.value > 0, `${k.id}: ${e.type} of ${e.value} would zero the stat outright`);
      } else {
        assert.ok(e.value < 0, `${k.id}: ${e.type} of ${e.value} is not a cost`);
      }
    }
  }
});

// -------------------------------------------------------------- the choice

test('you cannot take more than the cap', () => {
  // Without this the drawbacks average out and the tree is a shopping list
  // again with extra steps.
  const s = createState();
  s.essence = KEYSTONE_COST * 20;
  for (const branch of TREE_BRANCHES) {
    const node = Object.values(NODES_BY_ID).find((n) => n.branch === branch.id && n.tier === 1);
    s.tree[node.id] = KEYSTONE_GATE;
  }

  let taken = 0;
  for (const k of KEYSTONES) if (takeKeystone(s, k.id).ok) taken++;
  assert.equal(taken, KEYSTONE_MAX, `took ${taken} keystones, cap is ${KEYSTONE_MAX}`);
  assert.equal(ownedKeystones(s).length, KEYSTONE_MAX);

  const refused = takeKeystone(s, KEYSTONES.find((k) => !hasKeystone(s, k.id)).id);
  assert.equal(refused.ok, false);
  assert.equal(refused.reason, 'full');
});

test('a keystone needs real investment in its own branch', () => {
  const k = KEYSTONES[0];
  const thin = invested(k.branch, KEYSTONE_GATE - 1);
  assert.equal(canTakeKeystone(thin, k.id).reason, 'locked');

  const ready = invested(k.branch, KEYSTONE_GATE);
  assert.equal(canTakeKeystone(ready, k.id).ok, true);
});

test('investment in another branch does not open this one', () => {
  const k = KEYSTONES.find((x) => x.branch === 'might');
  const s = invested('commerce', KEYSTONE_GATE * 3);
  assert.equal(canTakeKeystone(s, k.id).reason, 'locked');
});

test('a keystone costs essence and refunds it in full when dropped', () => {
  const k = KEYSTONES[0];
  const s = invested(k.branch);
  const before = s.essence;

  assert.equal(takeKeystone(s, k.id).ok, true);
  assert.equal(s.essence, before - KEYSTONE_COST);

  assert.equal(dropKeystone(s, k.id).refunded, KEYSTONE_COST);
  assert.equal(s.essence, before, 'dropping a keystone lost essence');
  assert.equal(hasKeystone(s, k.id), false);
});

test('the same keystone cannot be taken twice', () => {
  const k = KEYSTONES[0];
  const s = invested(k.branch);
  takeKeystone(s, k.id);
  assert.equal(takeKeystone(s, k.id).reason, 'owned');
});

test('dropping one you do not have changes nothing', () => {
  const s = invested(KEYSTONES[0].branch);
  const before = s.essence;
  assert.equal(dropKeystone(s, KEYSTONES[0].id).ok, false);
  assert.equal(s.essence, before);
});

// ------------------------------------------------------- branch exclusivity

test('you may only go deep in three branches', () => {
  const s = createState();
  s.essence = 1e12;
  // Open every branch's deep tiers by spending in each.
  for (const branch of TREE_BRANCHES) {
    const t1 = Object.values(NODES_BY_ID).find((n) => n.branch === branch.id && n.tier === 1);
    s.tree[t1.id] = 200;
  }

  const deepNodes = TREE_BRANCHES.map((b) =>
    Object.values(NODES_BY_ID).find((n) => n.branch === b.id && n.tier === DEEP_TIER),
  );

  let allowed = 0;
  for (const node of deepNodes) {
    if (canBuyNode(s, node.id).ok) {
      s.tree[node.id] = 1;
      allowed++;
    }
  }
  assert.equal(allowed, DEEP_BRANCH_MAX, `went deep in ${allowed} branches`);
  assert.equal(deepBranches(s).size, DEEP_BRANCH_MAX);
});

test('a branch you are already deep in can always be continued', () => {
  // The limit is on how many you pick, never on finishing one.
  const s = createState();
  s.essence = 1e12;
  for (const branch of TREE_BRANCHES) {
    const t1 = Object.values(NODES_BY_ID).find((n) => n.branch === branch.id && n.tier === 1);
    s.tree[t1.id] = 200;
  }
  const chosen = ['might', 'hide', 'fortune'];
  for (const b of chosen) {
    const node = Object.values(NODES_BY_ID).find((n) => n.branch === b && n.tier === DEEP_TIER);
    s.tree[node.id] = 1;
  }

  for (const b of chosen) assert.equal(canGoDeep(s, b), true, `${b} was blocked`);
  assert.equal(canGoDeep(s, 'legacy'), false, 'a fourth branch was allowed');

  // Another node in an already-deep branch is fine.
  const another = Object.values(NODES_BY_ID).find(
    (n) => n.branch === 'might' && n.tier === 6,
  );
  assert.notEqual(canBuyNode(s, another.id).reason, 'shallow');
});

test('a blocked deep node says why, and it is not "locked"', () => {
  // "Locked" means spend more; this one means you already chose otherwise, and
  // the panel has to be able to tell the player which.
  const s = createState();
  s.essence = 1e12;
  for (const branch of TREE_BRANCHES) {
    const t1 = Object.values(NODES_BY_ID).find((n) => n.branch === branch.id && n.tier === 1);
    s.tree[t1.id] = 200;
  }
  for (const b of ['might', 'hide', 'fortune']) {
    const node = Object.values(NODES_BY_ID).find((n) => n.branch === b && n.tier === DEEP_TIER);
    s.tree[node.id] = 1;
  }
  const blocked = Object.values(NODES_BY_ID).find((n) => n.branch === 'legacy' && n.tier === DEEP_TIER);
  const check = canBuyNode(s, blocked.id);
  assert.equal(check.ok, false);
  assert.equal(check.reason, 'shallow');
  assert.equal(check.deep.length, DEEP_BRANCH_MAX);
});

test('tiers below the deep line are never restricted', () => {
  const s = createState();
  s.essence = 1e12;
  for (const branch of TREE_BRANCHES) {
    const t1 = Object.values(NODES_BY_ID).find((n) => n.branch === branch.id && n.tier === 1);
    s.tree[t1.id] = 200;
  }
  for (const b of ['might', 'hide', 'fortune']) {
    const node = Object.values(NODES_BY_ID).find((n) => n.branch === b && n.tier === DEEP_TIER);
    s.tree[node.id] = 1;
  }
  for (const branch of TREE_BRANCHES) {
    for (let tier = 1; tier < DEEP_TIER; tier++) {
      const node = Object.values(NODES_BY_ID).find((n) => n.branch === branch.id && n.tier === tier);
      assert.notEqual(canBuyNode(s, node.id).reason, 'shallow', `${node.id} was restricted`);
    }
  }
});

// ------------------------------------------------------------- conditionals

test('every conditioned node exists and names a real condition', () => {
  // A typo here produces a node that silently never pays, which is the exact
  // failure conditionals invite.
  for (const [nodeId, conditionId] of Object.entries(NODE_CONDITIONS)) {
    assert.ok(NODES_BY_ID[nodeId], `condition on "${nodeId}", which is not a node`);
    assert.ok(CONDITIONS[conditionId], `"${nodeId}" names unknown condition "${conditionId}"`);
  }
  assert.ok(Object.keys(NODE_CONDITIONS).length >= 15);
});

test('every condition reads only the save, never a live fight', () => {
  // The restriction that keeps recomputeDerived() decoupled from combat.
  const s = createState();
  for (const [id, condition] of Object.entries(CONDITIONS)) {
    assert.doesNotThrow(() => condition.test(s), `${id} threw on a fresh save`);
    const value = condition.test(s);
    assert.ok(Number.isFinite(value), `${id} did not return a number`);
    assert.ok(condition.label, `${id} has no label to show the player`);
  }
});

test('a switched-off condition contributes nothing at all', () => {
  const nodeId = Object.keys(NODE_CONDITIONS).find(
    (id) => NODE_CONDITIONS[id] === 'committed',
  );
  const s = createState();
  s.tree[nodeId] = 3;

  // No keystone taken, so the condition is false.
  const off = treeEffects(s).filter((e) => e.type === NODES_BY_ID[nodeId].effect.type);
  assert.equal(off.length, 0, 'a false condition still emitted effects');
});

test('a false multiplicative condition leaves income untouched, not zeroed', () => {
  // The trap this arithmetic exists to avoid: scaling a x1.24 multiplier by a
  // condition of 0 gives x0, which would wipe out the player's whole income for
  // the crime of not having taken a keystone.
  const mult = Object.entries(NODE_CONDITIONS).find(([id]) => {
    const node = NODES_BY_ID[id];
    return ['globalMult', 'zpsMult', 'clickMult', 'allBuildingMult', 'buffMult'].includes(node.effect.type);
  });
  assert.ok(mult, 'no multiplicative node carries a condition — this test needs one');

  const [nodeId] = mult;
  const s = createState();
  s.tree[nodeId] = 2;
  const derived = recomputeDerived(s);
  assert.ok(Number.isFinite(derived.globalMult) && derived.globalMult > 0);
  assert.ok(derived.zps >= 0 && Number.isFinite(derived.zps));
});

test('a scaling condition pays proportionally', () => {
  const nodeId = Object.keys(NODE_CONDITIONS).find(
    (id) => NODE_CONDITIONS[id] === 'perEmptySlot',
  );
  const s = createState();
  s.tree[nodeId] = 1;

  const bare = treeEffects(s).find((e) => e.type === NODES_BY_ID[nodeId].effect.type);
  assert.ok(bare, 'a bare player got nothing from a per-empty-slot node');

  s.combat.equipped = { hat: 'a', scarf: 'b', charm: 'c' };
  const half = treeEffects(s).find((e) => e.type === NODES_BY_ID[nodeId].effect.type);
  assert.ok(half.value < bare.value, 'wearing gear did not reduce a per-empty-slot node');
});

test('conditionMultiplier is never negative', () => {
  const s = createState();
  s.combat.equipped = Object.fromEntries(
    ['hat', 'scarf', 'charm', 'sandal', 'rod', 'bucket'].map((k) => [k, 'x']),
  );
  for (const id of Object.keys(CONDITIONS)) {
    assert.ok(conditionMultiplier(id, s) >= 0, `${id} went negative`);
  }
});

// --------------------------------------------------------------- the wiring

test('keystone effects reach the derived stats, gain and cost alike', () => {
  // Hands On: tap power up, income while away down.
  const k = KEYSTONES_BY_ID.handsOn;
  const s = invested(k.branch);
  for (const id of Object.keys(s.buildings)) s.buildings[id] = 20;

  const before = recomputeDerived(s);
  takeKeystone(s, k.id);
  const after = recomputeDerived(s);

  assert.ok(after.clickValue > before.clickValue, 'the gain did not apply');
  assert.ok(after.offlineRate < before.offlineRate, 'the drawback did not apply');
  assert.ok(after.offlineCapMs < before.offlineCapMs, 'the second drawback did not apply');
});

test('every keystone visibly changes at least one derived number', () => {
  // A keystone whose effects never reach the accumulator is a very expensive
  // piece of flavour text.
  const KEYS = ['zps', 'clickValue', 'critChance', 'critMult', 'comboCap', 'comboStep',
    'goldenChanceMult', 'goldenDurationMult', 'offlineRate', 'offlineCapMs', 'zpsShare',
    'globalMult', 'essenceMult'];

  for (const k of KEYSTONES) {
    const s = invested(k.branch);
    for (const id of Object.keys(s.buildings)) s.buildings[id] = 20;
    const before = recomputeDerived(s);
    takeKeystone(s, k.id);
    const after = recomputeDerived(s);

    const moved = KEYS.some((key) => after[key] !== before[key]);
    // combat-only effects (atk/def/hp/spd/luck) do not surface in derived.
    const combatOnly = keystoneEffects(k).every((e) => e.type.startsWith('combat') || e.type === 'critDamage');
    assert.ok(moved || combatOnly, `${k.id} changed nothing`);
  }
});

test('a negative effect can never push a rate below zero', () => {
  // Nothing in the game had ever subtracted before keystones existed.
  const s = invested('commerce');
  takeKeystone(s, 'hermit'); // goldenChance -1
  s.keystones = [...s.keystones, 'hermit', 'hermit']; // stack it absurdly
  const d = recomputeDerived(s);
  assert.ok(d.goldenChanceMult >= 0, `goldenChanceMult is ${d.goldenChanceMult}`);
  assert.ok(d.goldenDurationMult >= 0);
  assert.ok(d.offlineRate >= 0);
  assert.ok(d.zpsShare >= 0);
  assert.ok(d.offlineCapMs >= 0);
});

test('respec returns keystone essence too', () => {
  const k = KEYSTONES[0];
  const s = invested(k.branch);
  const before = s.essence;
  takeKeystone(s, k.id);

  const out = respec(s);
  assert.equal(out.keystones, 1);
  assert.equal(s.keystones.length, 0);
  assert.ok(s.essence >= before, 'a respec lost the keystone essence');
});

test('keystones survive a rebirth, like every other thing the tree holds', () => {
  const k = KEYSTONES[0];
  const s = invested(k.branch);
  takeKeystone(s, k.id);
  s.combat.bestDepth = 400;
  s.rebirthUnlocked = true;

  assert.equal(rebirth(s).ok, true);
  assert.deepEqual(s.keystones, [k.id], 'a rebirth took the keystone');
});

test('keystones round-trip through a save, and an old save simply has none', () => {
  const k = KEYSTONES[0];
  const s = invested(k.branch);
  takeKeystone(s, k.id);
  const back = reconcileState(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(back.keystones, [k.id]);

  const old = createState();
  delete old.keystones;
  assert.deepEqual(reconcileState(old).keystones, []);

  const junk = reconcileState({ ...createState(), keystones: 'nonsense' });
  assert.deepEqual(junk.keystones, []);
});

test('the summary tells the panel what it needs to show a build', () => {
  const s = invested(KEYSTONES[0].branch);
  takeKeystone(s, KEYSTONES[0].id);
  const summary = treeSummary(s);
  assert.equal(summary.keystoneMax, KEYSTONE_MAX);
  assert.equal(summary.keystones.length, 1);
  assert.equal(summary.deepMax, DEEP_BRANCH_MAX);
  assert.ok(Array.isArray(summary.deep));
});

test('a negative zpsShare removes the term, it does not invert it', () => {
  // Found by measuring builds, not by reading. A tap is worth
  // (base+flat)*mult + zps*zpsShare, so The Absentee's `zpsShare: -1` did not
  // merely stop the pond feeding taps — it subtracted the whole pond from the
  // tap and produced a NEGATIVE click value. The floor now sits on the value
  // the formula consumes, not only on the one reported back out.
  const s = invested('commerce');
  for (const id of Object.keys(s.buildings)) s.buildings[id] = 40;
  takeKeystone(s, 'absentee');

  const d = recomputeDerived(s);
  assert.ok(d.clickValue > 0, `click value is ${d.clickValue}`);
  assert.ok(d.clickValueNoCombo > 0);
  assert.equal(d.zpsShare, 0, 'the share should be removed, not negative');
});

test('the keystones produce genuinely different characters', () => {
  // The point of the whole system. If every build lands on the same numbers,
  // the keystones are flavour text on a shopping list.
  function statsFor(keystones) {
    const s = createState();
    for (const n of Object.values(NODES_BY_ID)) if (n.tier <= 3) s.tree[n.id] = 2;
    for (const id of Object.keys(s.buildings)) s.buildings[id] = 30;
    s.keystones = keystones;
    const d = recomputeDerived(s);
    return { zps: d.zps, click: d.clickValue, critMult: d.critMult };
  }

  const base = statsFor([]);
  const tapper = statsFor(['handsOn', 'restless']);
  const idler = statsFor(['hermit', 'absentee']);

  // The tapper out-taps the idler by orders of magnitude, and the idler
  // out-earns the tapper while asleep. Neither is a strictly better version of
  // the other, which is what makes choosing one a decision.
  assert.ok(tapper.click > idler.click * 100, 'the tapping build does not out-tap the idle one');
  assert.ok(idler.zps > tapper.zps, 'the idle build does not out-earn the tapping one');
  assert.ok(statsFor(['glassCannon']).critMult > base.critMult);
});
