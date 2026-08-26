// The claims docs/BALANCE.md makes, asserted.
//
// A balance document that nothing checks is a snapshot of what someone believed
// on the day they wrote it. These tests are what stop it drifting into fiction:
// every figure quoted in that file that is derived rather than declared has a
// line here, and moving a constant without moving the document fails the suite.

import test from 'node:test';
import assert from 'node:assert/strict';

import * as B from '../src/balance.js';
import * as R from '../src/data/rarities.js';
import { tierCeiling } from '../src/systems/loot.js';
import { CASES, CASES_BY_ID } from '../src/data/cases.js';
import { DAILY_LEAFS } from '../src/systems/store.js';
import { PASS_LEVELS, PREMIUM_LEAFS, freeReward, premiumReward } from '../src/data/pass.js';
import { ACHIEVEMENTS } from '../src/data/achievements.js';

test('the stage boundary is the wall, not the level', () => {
  // The whole difficulty design in one assertion: ten levels inside a stage
  // must be gentler than one step between stages.
  const withinStage = B.LEVEL_GROWTH ** (B.LEVELS_PER_STAGE - 1);
  assert.ok(withinStage < B.STAGE_GROWTH, `within-stage x${withinStage.toFixed(2)} vs stage x${B.STAGE_GROWTH}`);
  assert.ok(withinStage < 1.3, `a stage's ten levels multiply hp by x${withinStage.toFixed(2)} — too steep to read as one place`);
  assert.ok(B.STAGE_GROWTH >= 1.8, 'the boundary has to be felt');
});

test('a boss is meaningfully harder than the level before it', () => {
  assert.ok(B.BOSS_HP_MULT >= 5, 'a boss that dies like a mob is not a boss');
  assert.ok(B.BOSS_ATK_MULT > 1);
});

test('the gear ladder hands over to the tree at a known stage', () => {
  // docs/BALANCE.md quotes stage 38. Past it, gear grows only through stars and
  // the forge, and the rebirth tree is what carries the run.
  const maxed = [...Array(200).keys()].find((s) => tierCeiling(s) >= R.MAX_TIER);
  assert.equal(maxed, 38);
  assert.equal(R.MAX_TIER, 19, 'twenty rungs, zero-indexed');
});

test('the rarity slope is the measured one, not the proposed one', () => {
  // 1.55 collapsed the first wall from stage 7 to stage 3. This number was
  // chosen by sweeping it against the wall position; it is not free.
  assert.equal(R.RARITY_MULT, 1.45);
});

test('the rebirth payout rises with depth and never flattens', () => {
  let last = 0;
  for (const stage of [1, 5, 10, 20, 50, 100, 500]) {
    const essence = B.essenceFromStage(stage);
    assert.ok(essence > last, `stage ${stage} pays no more than the stage before`);
    last = essence;
  }
  // Two stages deeper is always worth more than one, but a single deep run must
  // not replace several shallow ones.
  assert.ok(B.essenceFromStage(20) < 2 * B.essenceFromStage(10) * 2);
  assert.equal(B.essenceFromStage(10), 400, 'quoted in docs/BALANCE.md');
  // The point of the steeper curve: going deeper beats going again. A run that
  // reaches stage 14 must out-pay two runs that stop at 7.
  assert.ok(
    B.essenceFromStage(14) > 2 * B.essenceFromStage(7),
    'one deep run should beat two shallow ones at double the depth',
  );
});

test('the daily leaf grant is nearly one case, and never quite one', () => {
  // The entire design of the daily. Enough to feel like progress, not enough to
  // close the loop.
  const cheapest = Math.min(...CASES.map((c) => c.cost));
  assert.ok(DAILY_LEAFS < cheapest, 'a daily that buys a case removes the reason to come back');
  const ratio = DAILY_LEAFS / cheapest;
  assert.ok(ratio > 0.7 && ratio < 0.95, `daily is ${(ratio * 100).toFixed(0)}% of a case`);
});

test('the premium pass cannot buy its own renewal', () => {
  let paid = 0;
  for (let level = 1; level <= PASS_LEVELS; level++) {
    paid += premiumReward(level).leafs || 0;
  }
  assert.ok(paid < PREMIUM_LEAFS, `premium returns ${paid} against a ${PREMIUM_LEAFS} price — that is a treadmill`);
  const ratio = paid / PREMIUM_LEAFS;
  assert.ok(ratio > 0.6, `premium returns only ${(ratio * 100).toFixed(0)}% — too mean to be worth it`);
});

test('the free track pays on its own, at every level', () => {
  let leafs = 0;
  for (let level = 1; level <= PASS_LEVELS; level++) {
    const reward = freeReward(level);
    assert.ok(reward && Object.keys(reward).length > 1, `free level ${level} pays nothing`);
    leafs += reward.leafs || 0;
  }
  assert.ok(leafs > 0, 'the free track must pay leafs, not only zen');
});

test('every case states a floor and a pity, and they order sensibly', () => {
  const byCost = [...CASES].sort((a, b) => a.cost - b.cost);
  for (let i = 1; i < byCost.length; i++) {
    assert.ok(byCost[i].floor >= byCost[i - 1].floor, 'a dearer case must not have a worse floor');
    assert.ok(byCost[i].pity <= byCost[i - 1].pity, 'a dearer case should not wait longer for pity');
  }
  for (const c of CASES) {
    assert.ok(Number.isInteger(c.pity) && c.pity > 0, `${c.id} has no pity counter`);
  }
  assert.equal(CASES.length, 3, 'three cases, as specified');
  assert.ok(CASES_BY_ID.reed && CASES_BY_ID.onsen && CASES_BY_ID.astral);
});

test('the offline cache defaults are the documented ones', () => {
  assert.equal(B.OFFLINE_RATE, 0.6);
  assert.equal(B.OFFLINE_CAP_MS, 12 * 3600e3);
  assert.equal(B.WALL_SECONDS, 30);
});

test('the achievement ceiling matches what docs/BALANCE.md quotes', () => {
  let global = 1;
  let idle = 1;
  for (const ach of ACHIEVEMENTS) {
    const r = ach.reward;
    if (!r) continue;
    if (r.type === 'globalMult') { global *= r.value; idle *= r.value; }
    if (r.type === 'zpsMult' || r.type === 'allBuildingMult') idle *= r.value;
  }
  assert.ok(Math.abs(global - 68) < 6, `global is x${global.toFixed(1)}, doc says x68`);
  assert.ok(Math.abs(idle - 184) < 20, `idle is x${idle.toFixed(0)}, doc says x184`);
});

test('the float ceiling is below where float64 gives up', () => {
  assert.ok(B.VALUE_CEILING < Number.MAX_VALUE / 10);
  assert.equal(B.VALUE_CEILING, 1e300);
});
