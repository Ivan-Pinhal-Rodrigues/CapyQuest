// Several rebirths in a row, not one in isolation.
//
// Every other essence-payout test — economy-balance.test.js, balance.test.js
// — checks essenceFromStage() at a single stage, once. None of them answer
// the question ASCEND_MIN_ESSENCE actually needs answered: what does lifetime
// essence look like after several *sequential* rebirths, with the tree's own
// essenceGain bonuses compounding into each other the way they really do at
// the table? tests/content.test.js's old "50 rebirths at stage 60" fixture
// was the closest thing that existed, and it was a hand-multiplied constant,
// not an actual climb-rebirth-climb-again loop.
//
// This file is that loop, built from the real rebirth()/tree.js functions
// rather than a re-implementation of them — the payout formula, the tier
// gating, the branch spend requirements, all exactly as a save would hit
// them. What it does not re-simulate is the combat climb between rebirths;
// tests/stages.test.js's simulateNormalPlayer already covers "how a normal
// player reaches a given stage" for a single run, so a chosen stage-per-cycle
// schedule stands in for that here — this harness is about the rebirth
// *economy* stacked on top of a climb, not the climb itself.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as B from '../src/balance.js';
import { createState } from '../src/state.js';
import { rebirth, essenceGainMult } from '../src/systems/rebirth.js';
import { canBuyNode, buyNode } from '../src/systems/tree.js';
import { TREE_NODES } from '../src/data/rebirthTree.js';
import { ASCEND_MIN_ESSENCE, ASCEND_MIN_REBIRTHS } from '../src/systems/ascension.js';

/**
 * Spend every rebirth's essence immediately, preferring `preferType` nodes
 * and cheaper tiers first — a player who prioritises the branch that pays
 * for the next cycle rather than hoarding. Sorted once; each pass then buys
 * every currently affordable node in that order and repeats until a pass
 * buys nothing, which converges in far fewer full-tree scans than picking
 * a single "best" node and rescanning from scratch after every purchase.
 */
function spendGreedily(state, preferType) {
  const ordered = [...TREE_NODES].sort((a, b) => {
    const ap = a.effect.type === preferType ? 0 : 1;
    const bp = b.effect.type === preferType ? 0 : 1;
    return ap !== bp ? ap - bp : a.tier - b.tier;
  });
  let bought = true;
  while (bought) {
    bought = false;
    for (const node of ordered) {
      if (canBuyNode(state, node.id).ok) {
        buyNode(state, node.id);
        bought = true;
      }
    }
  }
}

/**
 * Run `cycles` real rebirths back to back, each reaching `stageAt(cycleIndex)`
 * before resetting, spending everything on essence-gain nodes in between.
 * Returns the final state plus a per-cycle row for inspection.
 */
function simulateRebirthCycles(cycles, stageAt) {
  const state = createState();
  state.rebirthUnlocked = true;
  const rows = [];

  for (let i = 0; i < cycles; i++) {
    state.combat.bestDepth = B.absoluteLevel(stageAt(i), 0);
    const result = rebirth(state);
    if (!result.ok) throw new Error(`rebirth ${i} failed: ${result.reason}`);
    spendGreedily(state, 'essenceGain');
    rows.push({
      cycle: state.rebirthCount,
      lifetimeEssence: state.lifetimeEssence,
      mult: essenceGainMult(state),
    });
  }

  return { state, rows };
}

/** Never breaks past the measured wall (stage 7, tests/stages.test.js) — the pessimistic case. */
const flatAtWall = () => 7;

/** Creeps two stages deeper every two cycles, capping at 12 — an optimistic case. */
const creepingDeeper = (i) => Math.min(12, 7 + Math.floor(i / 2));

// ------------------------------------------------------------- compounding

test('essence-gain tree bonuses actually compound between rebirths', () => {
  const { rows } = simulateRebirthCycles(10, flatAtWall);
  const mults = rows.map((r) => r.mult);

  // Each row already reflects that cycle's own spend (rebirth pays, then the
  // harness immediately buys), so the first cycle already moves off 1 — the
  // thing under test is that it never goes backwards, and that ten cycles of
  // spending actually add up to something.
  assert.ok(mults[0] > 1, 'the very first payout should already afford something');
  for (let i = 1; i < mults.length; i++) {
    assert.ok(mults[i] >= mults[i - 1], `essenceGainMult dropped between cycle ${i} and ${i + 1}`);
  }
  assert.ok(mults.at(-1) > mults[0], 'ten cycles of spending on the branch must move the multiplier further');
});

test('lifetime essence grows faster than a flat multiple of the first payout', () => {
  // If the tree bonus did nothing, ten identical cycles at the same stage
  // would just be 10x the first cycle's payout. Real compounding must beat
  // that, because every cycle after the first is buying at a stage the last
  // cycle could not yet afford to.
  const { rows } = simulateRebirthCycles(10, flatAtWall);
  const naiveTenX = rows[0].lifetimeEssence * 10;
  assert.ok(rows.at(-1).lifetimeEssence > naiveTenX, 'compounding should beat a flat multiple');
});

// ------------------------------------------------------- the ascend gate

test('a player stuck at the measured wall the whole time needs more than the rebirth count alone', () => {
  // The pessimistic case: every one of the required ASCEND_MIN_REBIRTHS
  // cycles never gets past stage 7. Measured, this player is nowhere near
  // ASCEND_MIN_ESSENCE by cycle 14 — essence is a real, separate gate for
  // someone who never improves their combat reach, not a formality the
  // rebirth count alone already satisfies. That is deliberate: the two gates
  // are meant to measure different things (how many times you have gone
  // round, versus how much ground you actually covered while doing it), and
  // a player who does neither should not sail through on the other.
  const { state } = simulateRebirthCycles(ASCEND_MIN_REBIRTHS, flatAtWall);
  assert.ok(
    state.lifetimeEssence < ASCEND_MIN_ESSENCE,
    `flat-at-the-wall lifetime essence is ${state.lifetimeEssence}, unexpectedly at or past `
    + `the ${ASCEND_MIN_ESSENCE} gate after only ${ASCEND_MIN_REBIRTHS} rebirths with no depth gained`,
  );
});

test('a player who pushes a little deeper each cycle clears the essence gate before the count gate binds', () => {
  const { state } = simulateRebirthCycles(ASCEND_MIN_REBIRTHS, creepingDeeper);
  assert.ok(
    state.lifetimeEssence >= ASCEND_MIN_ESSENCE,
    `creeping-deeper lifetime essence is ${state.lifetimeEssence}, short of the ${ASCEND_MIN_ESSENCE} gate`,
  );
});

test('ASCEND_MIN_ESSENCE sits inside the real range this harness measures, not trivially above or below it', () => {
  // Measured once, here, rather than re-derived by a formula: the honest
  // range for lifetime essence at exactly the rebirth-count gate spans from
  // "never improved" to "improved steadily", and the essence gate should sit
  // inside that band — low enough that a player who is actually progressing
  // clears it right around when the count gate does, high enough that it is
  // not free for someone who is not progressing at all. Kept at the existing
  // 15,000 rather than moved: it was flagged for reconsideration going into
  // this pass in case the new banded curve made it trivial, and this harness
  // is what confirmed it did not.
  const pessimistic = simulateRebirthCycles(ASCEND_MIN_REBIRTHS, flatAtWall).state.lifetimeEssence;
  const optimistic = simulateRebirthCycles(ASCEND_MIN_REBIRTHS, creepingDeeper).state.lifetimeEssence;

  assert.ok(pessimistic < optimistic, 'the two cases must actually bound a range');
  assert.ok(
    ASCEND_MIN_ESSENCE > pessimistic && ASCEND_MIN_ESSENCE <= optimistic,
    `ASCEND_MIN_ESSENCE (${ASCEND_MIN_ESSENCE}) is outside the measured [${pessimistic}, ${optimistic}] range`,
  );
});
