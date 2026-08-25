import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as B from '../src/balance.js';

test('building cost follows the 1.15 curve', () => {
  assert.equal(B.buildingCost(100, 0), 100);
  assert.ok(Math.abs(B.buildingCost(100, 1) - 115) < 1e-9);
  assert.ok(Math.abs(B.buildingCost(100, 2) - 132.25) < 1e-9);
});

test('bulk cost equals the sum of individual costs', () => {
  const base = 137;
  const owned = 9;
  let manual = 0;
  for (let i = 0; i < 12; i++) manual += B.buildingCost(base, owned + i);
  const bulk = B.buildingBulkCost(base, owned, 12);
  assert.ok(Math.abs(bulk - manual) < 1e-6, `${bulk} vs ${manual}`);
});

test('bulk cost of zero units is free', () => {
  assert.equal(B.buildingBulkCost(100, 5, 0), 0);
  assert.equal(B.buildingBulkCost(100, 5, -3), 0);
});

test('max affordable never overspends and is maximal', () => {
  const base = 15;
  for (const owned of [0, 3, 27, 140]) {
    for (const zen of [0, 14, 15, 1e3, 5e5, 1e9]) {
      const n = B.buildingMaxAffordable(base, owned, zen);
      const cost = B.buildingBulkCost(base, owned, n);
      assert.ok(cost <= zen + 1e-6, `n=${n} costs ${cost} but only ${zen} available`);
      const oneMore = B.buildingBulkCost(base, owned, n + 1);
      assert.ok(oneMore > zen, `could have afforded ${n + 1}`);
    }
  }
});

test('max affordable is zero when the first unit is out of reach', () => {
  assert.equal(B.buildingMaxAffordable(100, 0, 99), 0);
  assert.equal(B.buildingMaxAffordable(100, 0, 0), 0);
});

test('click power applies flat before multipliers and combo last', () => {
  const value = B.clickPower({ base: 1, flat: 9, mult: 2, comboMult: 1.5 });
  assert.equal(value, (1 + 9) * 2 * 1.5);
});

test('click power adds a share of idle income', () => {
  const value = B.clickPower({ base: 1, flat: 0, mult: 1, zps: 1000, zpsShare: 0.05 });
  assert.equal(value, 1 + 50);
});

test('combo decays only after the grace window', () => {
  assert.equal(B.decayCombo(10, 0), 10);
  assert.equal(B.decayCombo(10, B.COMBO_DECAY_MS), 10);
  assert.equal(B.decayCombo(10, B.COMBO_DECAY_MS + 200), 9);
  assert.equal(B.decayCombo(10, B.COMBO_DECAY_MS + 2000), 0);
  assert.equal(B.decayCombo(0, 999999), 0);
});

test('crit chance is capped and never negative', () => {
  assert.equal(B.critChance(0.9), B.CRIT_CHANCE_CAP);
  assert.equal(B.critChance(-1), 0);
  assert.equal(B.critChance(0.3), 0.3);
});

test('offline earnings are capped in duration and paid at a reduced rate', () => {
  const oneHour = 3600e3;
  const r = B.offlineEarnings(10, oneHour, { capMs: oneHour * 12, rate: 0.6 });
  assert.equal(r.zen, 10 * 0.6 * 3600);
  assert.equal(r.creditedMs, oneHour);
  assert.equal(r.cappedMs, 0);

  const capped = B.offlineEarnings(10, oneHour * 20, { capMs: oneHour * 12, rate: 0.6 });
  assert.equal(capped.creditedMs, oneHour * 12);
  assert.equal(capped.cappedMs, oneHour * 8);
});

test('offline earnings are zero without income or elapsed time', () => {
  assert.equal(B.offlineEarnings(0, 9e6).zen, 0);
  assert.equal(B.offlineEarnings(100, 0).zen, 0);
  assert.equal(B.offlineEarnings(100, -5).zen, 0);
  assert.equal(B.offlineEarnings(100, NaN).zen, 0);
});

test('prestige yuzu round-trips with the zen requirement', () => {
  assert.equal(B.yuzuFromZen(0), 0);
  assert.equal(B.yuzuFromZen(1e12), 150);
  assert.equal(B.yuzuFromZen(4e12), 300);

  for (const target of [1, 25, 400, 9001]) {
    const zen = B.zenForYuzu(target);
    assert.ok(B.yuzuFromZen(zen) >= target, `${zen} zen should reach ${target} yuzu`);
  }
});

test('damage is mitigated by defence but never fully blocked', () => {
  const undefended = B.damage({ atk: 100, def: 0 });
  const defended = B.damage({ atk: 100, def: 100 });
  assert.equal(undefended, 100);
  assert.equal(defended, 50);
  assert.ok(B.damage({ atk: 1, def: 1e9 }) >= 1);
});

test('crits and elements multiply damage', () => {
  assert.equal(B.damage({ atk: 100, def: 0, crit: true, critMult: 2 }), 200);
  assert.equal(B.damage({ atk: 100, def: 0, element: 1.5 }), 150);
});

test('xp and level are inverses', () => {
  for (const level of [1, 2, 5, 20, 60]) {
    const xp = B.xpForLevel(level);
    assert.equal(B.levelFromXp(xp), level, `level ${level} at ${xp} xp`);
  }
});

test('enemy hp and reward scale with stage, bosses are harder', () => {
  assert.ok(B.enemyHp(10) > B.enemyHp(0));
  assert.equal(B.enemyHp(5, true), B.enemyHp(5) * 8);
  assert.ok(B.enemyReward(10) > B.enemyReward(0));
});

test('gacha pity ramps to a guaranteed five star', () => {
  assert.equal(B.fiveStarChance(0), 0.006);
  assert.equal(B.fiveStarChance(B.PITY_SOFT - 1), 0.006);
  assert.ok(B.fiveStarChance(B.PITY_SOFT) > 0.006);
  assert.equal(B.fiveStarChance(B.PITY_HARD - 1), 1);
  assert.equal(B.fiveStarChance(B.PITY_HARD + 10), 1);
});

test('forge cost climbs and the multiplier is linear', () => {
  assert.ok(B.forgeCost(5) > B.forgeCost(0));
  assert.equal(B.forgeMultiplier(0), 1);
  assert.ok(Math.abs(B.forgeMultiplier(15) - 2.8) < 1e-9);
});

test('seeded rng is deterministic and in range', () => {
  const a = B.makeRng(42);
  const b = B.makeRng(42);
  for (let i = 0; i < 50; i++) {
    const v = a();
    assert.equal(v, b());
    assert.ok(v >= 0 && v < 1);
  }
});

test('weighted pick respects weights and handles edges', () => {
  const entries = [{ id: 'a', weight: 1 }, { id: 'b', weight: 3 }];
  assert.equal(B.weightedPick(entries, 0).id, 'a');
  assert.equal(B.weightedPick(entries, 0.5).id, 'b');
  assert.equal(B.weightedPick(entries, 0.999).id, 'b');
  assert.equal(B.weightedPick([], 0.5), null);
});
