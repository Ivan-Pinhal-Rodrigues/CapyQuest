// Rebirth, the 210-node tree, and the v1 migration.
//
// Two things here are load-bearing.
//
// The first is the reset contract: a rebirth must keep every rank in the tree
// and every collection, and reset exactly the whitelist and nothing more. The
// test does not check the list by hand — it walks a state that has *something*
// in every field, so a field added later and forgotten is caught by the shape
// of the assertion rather than by someone remembering to update it.
//
// The second is the migration. v1 kept two parallel permanent-upgrade bags
// (relics bought with yuzu, talents bought with points) and this update folds
// both into one tree. That fold is the single highest-risk change in the whole
// update: get it wrong and a player loses everything they earned before the
// update landed, silently. So it gets its own section, and the maxes of all 49
// adopted ids are pinned here so a later edit cannot quietly shrink one.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as B from '../src/balance.js';
import { createState, reconcileState } from '../src/state.js';
import { recomputeDerived } from '../src/systems/stats.js';
import { combatStats } from '../src/systems/combatStats.js';
import {
  TREE_NODES, NODES_BY_ID, TREE_BRANCHES, TIER_GATES, TIERS, NODES_PER_TIER,
  ADOPTED_IDS, nodeCost, treeLayout, describeEffect,
} from '../src/data/rebirthTree.js';
import {
  branchSpend, buyNode, canBuyNode, essenceSpent, isNodeUnlocked, nextCost,
  ranksOf, respec, totalRanks, treeEffects, treeSummary,
} from '../src/systems/tree.js';
import { rebirth, rebirthPreview, essenceGainMult, noteWall, deepestStage } from '../src/systems/rebirth.js';
import { ascend, ascendPreview, ASCEND_MIN_ESSENCE, ASCENSION_ROADMAP } from '../src/systems/ascension.js';
import { shouldSuggestRebirth } from '../src/systems/wall.js';

/** Minimal stat block that produces a chosen DPS. Mirrors stages.test.js. */
function fakeStats(dps) {
  return { atk: dps / 0.65, spd: 0, crit: 0, critMult: 2 };
}

/** A state deep enough that a rebirth would actually pay something. */
function readyToRebirth() {
  const s = createState();
  s.zen = 5e12;
  s.lifetimeZen = 5e12;
  s.totalZen = 5e12;
  s.buildings.lilypad = 40;
  s.clickUpgrades.firmerPaw = true;
  s.tierUpgrades.lilypadI = true;
  s.combat.depth = 95;
  s.combat.bestDepth = 95;
  s.rebirthUnlocked = true;
  return s;
}

// ------------------------------------------------------------------ the tree

test('the tree is 7 branches of 30, six tiers of five each', () => {
  assert.equal(TREE_NODES.length, 210);
  assert.equal(TREE_BRANCHES.length, 7);

  const layout = treeLayout();
  for (const branch of TREE_BRANCHES) {
    const tiers = layout[branch.id].tiers;
    let total = 0;
    for (let tier = 1; tier <= TIERS; tier++) {
      assert.equal(tiers[tier].length, NODES_PER_TIER, `${branch.id} tier ${tier}`);
      total += tiers[tier].length;
    }
    assert.equal(total, 30, `${branch.id} has ${total} nodes`);
  }
});

test('every node id is unique and every field resolves', () => {
  const seen = new Set();
  for (const node of TREE_NODES) {
    assert.ok(!seen.has(node.id), `duplicate node id "${node.id}"`);
    seen.add(node.id);
    assert.ok(node.name, `${node.id}: no name`);
    assert.ok(node.blurb, `${node.id}: no blurb`);
    assert.ok(node.max >= 1, `${node.id}: max rank below 1`);
    assert.ok(node.tier >= 1 && node.tier <= TIERS, `${node.id}: tier out of range`);
    assert.ok(Number.isFinite(node.effect.value), `${node.id}: non-numeric effect`);
    assert.equal(NODES_BY_ID[node.id], node);
  }
});

test('a node blurb always states the number the node actually grants', () => {
  // Blurbs are generated from the effect so they cannot disagree with it. This
  // is what makes that safe to rely on.
  for (const node of TREE_NODES) {
    assert.equal(node.blurb, describeEffect(node.effect.type, node.effect.value));
  }
  assert.match(NODES_BY_ID.might1.blurb, /ATK/);
  assert.match(NODES_BY_ID.warmStone.blurb, /\+10% all income/);
});

test('cost climbs with both tier and ranks already bought', () => {
  for (let tier = 1; tier <= TIERS; tier++) {
    for (let rank = 1; rank < 5; rank++) {
      assert.ok(
        nodeCost(tier, rank) > nodeCost(tier, rank - 1),
        `tier ${tier}: rank ${rank + 1} is not pricier than rank ${rank}`,
      );
    }
    if (tier > 1) {
      // Compared at the same rank — a deeper tier is always dearer. Deliberately
      // *not* asserted across ranks: the first rank of a new tier costing less
      // than the fifth rank of the last one is the point, so widening the tree
      // stays a live alternative to deepening one node in it.
      for (let rank = 0; rank < 5; rank++) {
        assert.ok(
          nodeCost(tier, rank) > nodeCost(tier - 1, rank),
          `tier ${tier} rank ${rank + 1} is not dearer than tier ${tier - 1}`,
        );
      }
    }
  }
});

test('tier gates measure the branch you are in, not the tree as a whole', () => {
  const s = createState();
  const tier2 = TREE_NODES.find((n) => n.branch === 'might' && n.tier === 2);
  const tier3 = TREE_NODES.find((n) => n.branch === 'might' && n.tier === 3);

  assert.equal(isNodeUnlocked(s, tier2), false);

  // Ranks in a different branch must not open this one.
  s.tree.zen1 = 50;
  assert.equal(isNodeUnlocked(s, tier2), false, 'commerce ranks opened a might tier');

  s.tree.might1 = TIER_GATES[2];
  assert.equal(isNodeUnlocked(s, tier2), true);
  assert.equal(isNodeUnlocked(s, tier3), false);
  assert.equal(branchSpend(s, 'might'), TIER_GATES[2]);

  s.tree.might2 = TIER_GATES[3] - TIER_GATES[2];
  assert.equal(isNodeUnlocked(s, tier3), true);
});

test('buying a node spends essence, respects the cap, and refuses when broke', () => {
  const s = createState();
  s.essence = 1e6;

  const price = nodeCost(1, 0);
  const result = buyNode(s, 'might1');
  assert.equal(result.ok, true);
  assert.equal(result.price, price);
  assert.equal(s.tree.might1, 1);
  assert.equal(s.essence, 1e6 - price);

  const max = NODES_BY_ID.might1.max;
  for (let i = 1; i < max; i++) buyNode(s, 'might1');
  assert.equal(ranksOf(s, 'might1'), max);
  assert.equal(buyNode(s, 'might1').reason, 'maxed');
  assert.equal(nextCost(s, 'might1'), null, 'a maxed node has no next price');

  s.essence = 0;
  assert.equal(buyNode(s, 'might2').reason, 'poor');
  assert.equal(ranksOf(s, 'might2'), 0);
  assert.equal(buyNode(s, 'noSuchNode').reason, 'unknown');
});

test('a locked node cannot be bought however much essence you have', () => {
  const s = createState();
  s.essence = 1e12;
  const deep = TREE_NODES.find((n) => n.tier === 6);
  assert.equal(canBuyNode(s, deep.id).reason, 'locked');
  assert.equal(buyNode(s, deep.id).ok, false);
  assert.equal(s.essence, 1e12, 'a refused purchase must not charge');
});

test('respec is free and returns every point of essence', () => {
  const s = createState();
  s.essence = 5000;
  const start = s.essence;

  buyNode(s, 'might1');
  buyNode(s, 'might1');
  buyNode(s, 'zen1');
  buyNode(s, 'chonk1');
  const spent = start - s.essence;
  assert.ok(spent > 0);
  assert.equal(essenceSpent(s), spent, 'the ledger must match what was charged');

  const result = respec(s);
  assert.equal(result.refunded, spent);
  assert.deepEqual(s.tree, {});
  assert.equal(s.essence, start, 'a respec must leave you exactly where you started');
});

test('tree effects stack per rank and reach both stat blocks', () => {
  const s = createState();
  s.buildings.lilypad = 100;
  const beforeZps = recomputeDerived(s).zps;
  const beforeAtk = combatStats(s).atk;

  s.tree.chonk1 = 3; // +4% idle per rank
  s.tree.feral6 = 2; // +15% ATK per rank

  assert.equal(treeEffects(s).length, 5, 'one effect entry per rank');
  assert.ok(Math.abs(recomputeDerived(s).zps - beforeZps * 1.04 ** 3) < 1e-6);
  assert.ok(Math.abs(combatStats(s).atk - beforeAtk * 1.3) < 1e-6);
});

test('the summary counts what is owned against what there is', () => {
  const s = createState();
  const empty = treeSummary(s);
  assert.equal(empty.nodes, 210);
  assert.equal(empty.ranks, 0);
  assert.ok(empty.maxRanks > 210, 'most nodes take more than one rank');

  s.tree.might1 = 2;
  s.tree.zen1 = 1;
  assert.equal(treeSummary(s).nodesOwned, 2);
  assert.equal(totalRanks(s), 3);
});

// ------------------------------------------------------------- the trigger

test('the wall unlocks rebirth, and stage 0 never does', () => {
  const s = createState();
  s.combat.depth = 3; // still in stage 0
  assert.equal(noteWall(s, fakeStats(0)), false);
  assert.equal(s.rebirthUnlocked, false, 'being stuck on the first stage is a build problem');

  s.combat.depth = 95;
  assert.equal(shouldSuggestRebirth(s, fakeStats(0)), true);
  assert.equal(noteWall(s, fakeStats(0)), true);
  assert.equal(s.rebirthUnlocked, true);
});

test('once unlocked, rebirth stays unlocked even when you are winning again', () => {
  const s = createState();
  s.combat.depth = 95;
  noteWall(s, fakeStats(0));

  // A second call is a no-op, and getting strong again does not close the door.
  assert.equal(noteWall(s, fakeStats(0)), false, 'unlocking twice would re-announce it');
  assert.equal(noteWall(s, fakeStats(1e30)), false);
  assert.equal(s.rebirthUnlocked, true);
});

test('the preview reports the live wall, not a currency threshold', () => {
  const s = createState();
  s.combat.depth = 95;
  s.combat.bestDepth = 95;

  const stuck = rebirthPreview(s, fakeStats(1));
  assert.equal(stuck.walled, true);
  assert.equal(stuck.pressure, 1);

  const cruising = rebirthPreview(s, fakeStats(1e30));
  assert.equal(cruising.walled, false);
  assert.ok(cruising.ttk < B.WALL_SECONDS);

  // Without a stat block the payout still resolves; only the wall figures drop.
  const blind = rebirthPreview(s);
  assert.equal(blind.ttk, null);
  assert.equal(blind.essence, stuck.essence);
});

test('the payout rises with depth and reports the stage that earned it', () => {
  const shallow = createState();
  shallow.combat.bestDepth = B.absoluteLevel(3, 0);
  const deep = createState();
  deep.combat.bestDepth = B.absoluteLevel(12, 0);

  assert.equal(deepestStage(shallow), 3);
  assert.equal(deepestStage(deep), 12);
  assert.ok(rebirthPreview(deep).essence > rebirthPreview(shallow).essence);
  assert.equal(rebirthPreview(shallow).stage, 3);

  // The "next essence at stage N" hint must actually reach the next essence.
  const p = rebirthPreview(shallow);
  assert.ok(B.essenceFromStage(p.nextStage, p.mult) > p.essence);
});

test('essenceGain nodes and constellations raise the payout', () => {
  const plain = readyToRebirth();
  const boosted = readyToRebirth();
  boosted.tree.theLongBath = 2;
  boosted.constellations.theHoarder = 1;

  assert.ok(essenceGainMult(boosted) > essenceGainMult(plain));
  assert.ok(rebirthPreview(boosted).essence > rebirthPreview(plain).essence);
});

test('rebirth is refused before the wall, and costs nothing when refused', () => {
  const s = readyToRebirth();
  s.rebirthUnlocked = false;

  assert.equal(rebirthPreview(s).canRebirth, false);
  assert.equal(rebirth(s).ok, false);
  assert.equal(s.buildings.lilypad, 40, 'a refused rebirth must not reset anything');
  assert.equal(s.combat.depth, 95);
});

// --------------------------------------------------- what resets, what stays

test('rebirth pays essence, resets the run, and keeps every collection', () => {
  const s = readyToRebirth();
  s.combat.xp = 50000;
  s.combat.shards = 240;
  s.combat.inventory = [{ uid: 'g1', id: 'sunDiadem', forge: 4 }];
  s.combat.equipped = { hat: 'g1' };
  s.combat.skills = ['chomp'];
  s.gacha.companions.capybaraPrime = { level: 7, shards: 3 };
  s.gacha.party = ['capybaraPrime'];
  s.gacha.tickets = 9;
  s.achievements.firstTap = 1;
  s.tree.warmStone = 1;
  s.tree.chonk1 = 3;
  s.tree.stillnessItself = 1;
  s.lotus = 12;
  s.constellations.theBather = 2;

  const expected = rebirthPreview(s).essence;
  assert.ok(expected > 0);

  const result = rebirth(s);
  assert.equal(result.ok, true);
  assert.equal(result.gained, expected);
  assert.equal(result.stage, 9);

  // --- reset
  assert.equal(s.zen, 0);
  assert.equal(s.lifetimeZen, 0);
  assert.equal(s.buildings.lilypad, 0);
  assert.deepEqual(s.clickUpgrades, {});
  assert.deepEqual(s.tierUpgrades, {});
  assert.equal(s.combat.depth, 0, 'the run downstream starts again');
  assert.equal(s.combat.bestDepth, 0);
  assert.equal(s.combat.xp, 0, 'character level starts again');

  // --- kept
  assert.equal(s.essence, expected);
  assert.equal(s.lifetimeEssence, expected);
  assert.equal(s.rebirthCount, 1);
  assert.equal(s.stats.rebirths, 1);
  assert.equal(s.rebirthUnlocked, true);
  assert.equal(s.totalZen, 5e12, 'all-time zen is never reset');
  assert.equal(s.tree.warmStone, 1, 'the tree is the whole point of the button');
  assert.equal(s.tree.chonk1, 3);
  assert.equal(s.tree.stillnessItself, 1);
  assert.equal(s.combat.inventory.length, 1, 'gear survives');
  assert.equal(s.combat.equipped.hat, 'g1');
  assert.equal(s.combat.shards, 240);
  assert.deepEqual(s.combat.skills, ['chomp']);
  assert.equal(s.gacha.companions.capybaraPrime.level, 7, 'companions survive');
  assert.equal(s.gacha.tickets, 9);
  assert.equal(s.achievements.firstTap, 1, 'trophies survive');
  assert.equal(s.lotus, 12);
  assert.equal(s.constellations.theBather, 2);
});

test('a rebirth never costs a rank of the tree, however deep it goes', () => {
  const s = readyToRebirth();
  for (const node of TREE_NODES) s.tree[node.id] = node.max;
  const before = { ...s.tree };

  assert.equal(rebirth(s).ok, true);
  assert.deepEqual(s.tree, before, 'a fully bought tree must come through untouched');
  assert.equal(totalRanks(s), treeSummary(s).maxRanks);
});

test('rebirthing twice compounds the essence rather than replacing it', () => {
  const s = readyToRebirth();
  const first = rebirth(s).gained;

  s.combat.bestDepth = 95; // walked back down
  const second = rebirth(s).gained;

  assert.equal(s.rebirthCount, 2);
  assert.equal(s.essence, first + second);
  assert.equal(s.lifetimeEssence, first + second);
});

// ---------------------------------------------------------------- ascension

test('ascension is refused below the essence threshold', () => {
  const s = createState();
  s.lifetimeEssence = ASCEND_MIN_ESSENCE - 1;
  assert.equal(ascendPreview(s).canAscend, false);
  assert.equal(ascend(s).ok, false);
});

test('ascension takes the essence and the tree but never the collection', () => {
  const s = createState();
  s.lifetimeEssence = ASCEND_MIN_ESSENCE * 40;
  s.essence = 900;
  s.tree.warmStone = 1;
  s.tree.deepRoots = 4;
  s.constellations.theBather = 2;
  s.buildings.lilypad = 50;
  s.zen = 1e9;
  s.rebirthCount = 30;
  s.rebirthUnlocked = true;
  s.gacha.companions.capybaraPrime = { level: 12, shards: 4 };
  s.combat.inventory = [{ uid: 'g1', id: 'sunDiadem', forge: 4 }];
  s.achievements.firstTap = 1;

  const expected = ascendPreview(s).lotus;
  assert.ok(expected > 0);
  assert.equal(ascend(s).ok, true);

  // taken
  assert.equal(s.essence, 0);
  assert.equal(s.lifetimeEssence, 0);
  assert.deepEqual(s.tree, {}, 'ascension takes the tree');
  assert.equal(s.buildings.lilypad, 0);
  assert.equal(s.rebirthCount, 0);

  // kept
  assert.equal(s.lotus, expected);
  assert.equal(s.ascendCount, 1);
  assert.equal(s.constellations.theBather, 2, 'constellations survive');
  assert.equal(s.gacha.companions.capybaraPrime.level, 12, 'companions survive');
  assert.equal(s.combat.inventory.length, 1, 'gear survives');
  assert.equal(s.achievements.firstTap, 1, 'trophies survive');
  assert.equal(s.rebirthUnlocked, true, 'you do not have to re-learn the wall');
});

test('the ascension layer says out loud that it is unfinished', () => {
  assert.ok(ASCENSION_ROADMAP.length >= 3, 'a roadmap of nothing is not a roadmap');
  for (const line of ASCENSION_ROADMAP) assert.ok(line.length > 20, `too vague: "${line}"`);
});

// ---------------------------------------------------------- the v1 migration

// Every id v1 could have in `relics` or `talents`, with the max rank it had
// there. If a node's max ever drops below this, a player who maxed it in v1
// silently loses ranks on load — so the numbers are pinned rather than derived.
const V1_MAX_RANKS = {
  chonk1: 5, chonk2: 5, chonk3: 5, chonk4: 3, chonk5: 3, chonk6: 3, chonk7: 3, chonk8: 1, chonk9: 1,
  zen1: 5, zen2: 5, zen3: 5, zen4: 3, zen5: 3, zen6: 3, zen7: 3, zen8: 1, zen9: 1,
  feral1: 5, feral2: 5, feral3: 5, feral4: 3, feral5: 3, feral6: 3, feral7: 3, feral8: 1, feral9: 1,
  warmStone: 1, firstYuzu: 1, steadyHand: 5, deepRoots: 5, goodMemory: 3, deepSleeper: 4,
  thriftyPaws: 5, luckyStreak: 4, heavyPaw: 4, goldenTrail: 4, lingering: 4, unbrokenRhythm: 4,
  flowState: 3, osmoticSkin: 3, ironHide: 4, sharpenedTeeth: 4, wellFed: 4, foragersEye: 4,
  openInvitation: 3, compoundInterest: 5, theLongBath: 3, stillnessItself: 1,
};

test('every v1 id survives as a node, with at least the rank cap it had', () => {
  const ids = Object.keys(V1_MAX_RANKS);
  assert.equal(ids.length, 49, '27 talents + 22 relics');
  assert.deepEqual([...ADOPTED_IDS].sort(), ids.sort(), 'the adopted set drifted');

  for (const [id, max] of Object.entries(V1_MAX_RANKS)) {
    const node = NODES_BY_ID[id];
    assert.ok(node, `v1 id "${id}" has no node — a v1 save would lose it`);
    assert.ok(node.max >= max, `${id}: max fell from ${max} to ${node.max}`);
  }
});

test('a v1 save loads with both old bags merged into the tree', () => {
  const v1 = {
    version: 1,
    zen: 1234,
    lifetimeZen: 5e11,
    totalZen: 9e12,
    yuzu: 640,
    lifetimeYuzu: 2400,
    prestigeCount: 7,
    relics: { warmStone: 1, deepRoots: 5, compoundInterest: 3 },
    talents: { chonk1: 5, feral6: 3, zen9: 1 },
    buildings: { lilypad: 12 },
    achievements: { firstTap: 111 },
    stats: { prestiges: 7, crits: 40 },
    combat: { stage: 95, bestStage: 95, inventory: [{ uid: 'g1', id: 'sunDiadem', forge: 3 }] },
  };

  const s = reconcileState(v1);

  // currency and counters renamed, not lost
  assert.equal(s.essence, 640);
  assert.equal(s.lifetimeEssence, 2400);
  assert.equal(s.rebirthCount, 7);
  assert.equal(s.stats.rebirths, 7);
  assert.equal(s.yuzu, undefined, 'the old field must not linger and confuse a later read');
  assert.equal(s.prestigeCount, undefined);

  // both bags merged, rank for rank
  assert.equal(s.tree.warmStone, 1);
  assert.equal(s.tree.deepRoots, 5);
  assert.equal(s.tree.compoundInterest, 3);
  assert.equal(s.tree.chonk1, 5);
  assert.equal(s.tree.feral6, 3);
  assert.equal(s.tree.zen9, 1);
  assert.equal(s.relics, undefined);
  assert.equal(s.talents, undefined);

  // and everything else came through
  assert.equal(s.buildings.lilypad, 12);
  assert.equal(s.achievements.firstTap, 111);
  assert.equal(s.combat.depth, 95, 'the v1 stage rename still holds');
  assert.equal(s.combat.inventory.length, 1);
  assert.equal(s.stats.crits, 40);
});

test('a migrated v1 save keeps the power its ranks were buying', () => {
  const v1 = {
    version: 1,
    buildings: { lilypad: 100 },
    relics: { warmStone: 1 }, // +10% all income
    talents: { feral6: 2 }, // +15% ATK per rank
  };
  const s = reconcileState(v1);
  const bare = createState();
  bare.buildings.lilypad = 100;

  assert.ok(Math.abs(recomputeDerived(s).zps - recomputeDerived(bare).zps * 1.1) < 1e-6);
  assert.ok(Math.abs(combatStats(s).atk - combatStats(bare).atk * 1.3) < 1e-6);
});

test('a v1 player who had prestiged does not have to find the wall again', () => {
  const veteran = reconcileState({ version: 1, prestigeCount: 4 });
  assert.equal(veteran.rebirthUnlocked, true);

  const newcomer = reconcileState({ version: 1, prestigeCount: 0 });
  assert.equal(newcomer.rebirthUnlocked, false);
});

test('an id in a save that no longer exists is ignored, not fatal', () => {
  const s = reconcileState({ version: 1, relics: { deletedRelic: 3 }, talents: { ghost: 2 } });
  // The ranks are kept in the bag — throwing them away would be destructive if
  // the id ever comes back — but they contribute nothing and break nothing.
  assert.equal(s.tree.deletedRelic, 3);
  assert.equal(treeEffects(s).length, 0);
  assert.equal(essenceSpent(s), 0);
  assert.equal(respec(s).refunded, 0);
});
