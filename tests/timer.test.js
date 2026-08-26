// The boss clock, and the hold it leaves behind.
//
// Thirty seconds used to be a figure the wall detector quoted at you: a boss
// that took fifty seconds still died, slowly, and the banner suggested you
// rebirth. Now the clock is real, and the interesting part is not the timer —
// it is what happens afterwards, because a punishment that also takes away your
// ability to try again is not a punishment, it is a dead end.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as B from '../src/balance.js';
import { createState, reconcileState } from '../src/state.js';
import { Combat } from '../src/systems/combat.js';
import { combatStats } from '../src/systems/combatStats.js';
import { depthInfo } from '../src/systems/stages.js';
import { REBIRTH_MIN_STAGE, shouldSuggestRebirth } from '../src/systems/wall.js';

/** A player standing on the boss of `stage`, with the fight running. */
function atBoss(stage, { weak = true } = {}) {
  const s = createState();
  const depth = stage * B.LEVELS_PER_STAGE + B.BOSS_LEVEL;
  s.combat.depth = depth;
  s.combat.bestDepth = depth;
  s.combat.autoBattle = true;
  s.combat.unlocked = true;
  if (!weak) s.combat.xp = B.xpForLevel(400);
  return s;
}

/**
 * The stat block of somebody who cannot finish a boss but is in no danger from
 * it — enormous HP and defence, almost no attack.
 *
 * This distinction is the whole reason the fixture is hand-made rather than
 * derived from a low level: a genuinely weak player *dies*, three times, and
 * RETREAT_AFTER_LOSSES walks them back a level long before thirty seconds are
 * up. Timing out is a different failure with a different punishment, and a
 * fixture that quietly tested the other one would have passed while asserting
 * nothing.
 */
function stalemate() {
  return { atk: 0.0001, def: 1e9, hp: 1e9, spd: 20, crit: 0, critMult: 2, luck: 0, element: 'water', level: 1 };
}

/** Run the fight forward in small steps, as the game loop does. */
function run(combat, stats, seconds, step = 0.1) {
  const rewards = [];
  for (let t = 0; t < seconds; t += step) {
    combat.update(step, stats, (r) => rewards.push(r));
  }
  return rewards;
}

// ------------------------------------------------------------------ the clock

test('only a boss carries a clock', () => {
  const s = createState();
  s.combat.depth = 3; // stage 0, level 3 — not a boss
  s.combat.bestDepth = 3;
  s.combat.autoBattle = true;

  const combat = new Combat(s);
  const stats = combatStats(s);
  combat.engage(stats);

  assert.equal(combat.enemy.boss, false);
  assert.equal(combat.bossClock, 0);
  assert.equal(combat.progress().bossTime, null, 'no clock is not the same as no time left');
});

test('a boss starts on thirty seconds and counts down', () => {
  const s = atBoss(4);
  const combat = new Combat(s);
  const stats = stalemate();
  combat.engage(stats);

  assert.equal(combat.enemy.boss, true);
  assert.equal(combat.bossClock, B.WALL_SECONDS);

  run(combat, stats, 5);
  const p = combat.progress();
  assert.ok(p.bossTime < B.WALL_SECONDS, 'the clock should be running');
  assert.ok(p.bossTime > 0, 'and five seconds should not have run it out');
  assert.equal(p.bossLimit, B.WALL_SECONDS);
});

test('running the clock out drops you a whole stage and holds you there', () => {
  const s = atBoss(4);
  const startDepth = s.combat.depth;
  const combat = new Combat(s);
  const stats = stalemate();
  combat.engage(stats);

  run(combat, stats, B.WALL_SECONDS + 1);

  assert.equal(s.combat.depth, startDepth - B.LEVELS_PER_STAGE, 'back one whole stage');
  assert.equal(depthInfo(s.combat.depth).isBoss, true, 'to the previous stage boss, which you have beaten');
  assert.equal(s.combat.holding, true);
  assert.equal(s.combat.bossTimeouts, 1);
});

test('a timeout is announced, and says which boss and where you landed', () => {
  const s = atBoss(4);
  const combat = new Combat(s);
  const stats = stalemate();
  combat.engage(stats);
  combat.drainEvents();

  run(combat, stats, B.WALL_SECONDS + 1);
  const timeout = combat.drainEvents().find((e) => e.kind === 'timeout');

  assert.ok(timeout, 'a fight that ends must say so');
  assert.ok(timeout.boss?.name, 'and name what beat you');
  assert.equal(timeout.depth, s.combat.depth);
});

test('a timeout pays nothing — the boss is not softened, it is unbeaten', () => {
  const s = atBoss(4);
  const combat = new Combat(s);
  const stats = stalemate();
  combat.engage(stats);

  const before = { xp: s.combat.xp, clears: s.combat.clears, kills: s.combat.bossKills };
  const rewards = run(combat, stats, B.WALL_SECONDS + 1);

  assert.deepEqual(rewards, [], 'nothing may be paid for a boss that outlasted you');
  assert.equal(s.combat.clears, before.clears);
  assert.equal(s.combat.bossKills, before.kills);
});

test('the timer cannot fire on a boss you finish in time', () => {
  const s = atBoss(1, { weak: false });
  const combat = new Combat(s);
  const stats = combatStats(s);
  combat.engage(stats);

  run(combat, stats, B.WALL_SECONDS + 5);

  assert.equal(s.combat.bossTimeouts, 0, 'a boss that died did not outlast anybody');
  assert.equal(s.combat.holding, false);
  assert.ok(s.combat.bossKills > 0, 'and it should have been killed');
});

test('the boss at stage 0 sends you to the start, not below it', () => {
  const s = atBoss(0);
  const combat = new Combat(s);
  const stats = stalemate();
  combat.engage(stats);

  run(combat, stats, B.WALL_SECONDS + 1);
  assert.equal(s.combat.depth, 0, 'there is nowhere below the first level');
  assert.equal(s.combat.holding, true);
});

// -------------------------------------------------------------------- the hold

test('while held, winning does not walk you forward', () => {
  const s = atBoss(1, { weak: false });
  s.combat.holding = true;
  const depth = s.combat.depth;

  const combat = new Combat(s);
  const stats = combatStats(s);
  combat.engage(stats);
  run(combat, stats, 20);

  assert.ok(s.combat.bossKills > 0, 'the fight should still be winnable and still pay');
  assert.equal(s.combat.depth, depth, 'but it must not advance on its own');
});

test('a held win still pays out — it is the ground you keep, not the reward', () => {
  const s = atBoss(1, { weak: false });
  s.combat.holding = true;

  const combat = new Combat(s);
  const stats = combatStats(s);
  combat.engage(stats);
  const rewards = run(combat, stats, 20);

  assert.ok(rewards.length > 0, 'a kill under the hold still pays');
  assert.ok(s.combat.clears > 0);
});

test('travelling anywhere on purpose releases the hold', () => {
  const s = atBoss(3, { weak: false });
  s.combat.holding = true;
  const combat = new Combat(s);

  combat.travelTo(s.combat.depth + 1);
  assert.equal(s.combat.holding, false, 'Forward is the deliberate act the hold waits for');

  s.combat.holding = true;
  combat.travelTo(s.combat.depth - 1);
  assert.equal(s.combat.holding, false, 'walking back on purpose releases it too');
});

test('the hold is announced rather than silently stalling', () => {
  const s = atBoss(1, { weak: false });
  s.combat.holding = true;
  const combat = new Combat(s);
  const stats = combatStats(s);
  combat.engage(stats);
  combat.drainEvents();

  run(combat, stats, 20);
  assert.ok(combat.drainEvents().some((e) => e.kind === 'held'), 'a fight that stops moving must say why');
});

test('progress() reports the hold so the panel can explain it', () => {
  const s = atBoss(2);
  s.combat.holding = true;
  const combat = new Combat(s);
  combat.engage(stalemate());
  assert.equal(combat.progress().holding, true);
});

// ------------------------------------------------------------------- the save

test('a save from before the timer loads unheld and untimed', () => {
  const old = createState();
  delete old.combat.holding;
  delete old.combat.bossTimeouts;

  const fixed = reconcileState(old);
  assert.equal(fixed.combat.holding, false);
  assert.equal(fixed.combat.bossTimeouts, 0);
});

test('a hand-edited hold is coerced rather than trusted', () => {
  const s = createState();
  s.combat.holding = 'yes please';
  s.combat.bossTimeouts = -4;
  const fixed = reconcileState(s);
  assert.equal(fixed.combat.holding, true);
  assert.equal(fixed.combat.bossTimeouts, 0, 'a negative count is not a count');
});

// -------------------------------------------------------------- the new gate

test('rebirth does not unlock in the first few stages', () => {
  const s = createState();
  const hopeless = { atk: 0.0001, spd: 0, crit: 0, critMult: 2 };

  for (let stage = 0; stage < REBIRTH_MIN_STAGE; stage++) {
    s.combat.depth = stage * B.LEVELS_PER_STAGE;
    assert.equal(
      shouldSuggestRebirth(s, hopeless),
      false,
      `stage ${stage} should be too shallow to rebirth, however stuck you are`,
    );
  }

  s.combat.depth = REBIRTH_MIN_STAGE * B.LEVELS_PER_STAGE;
  assert.equal(shouldSuggestRebirth(s, hopeless), true, 'and at the gate it should unlock');
});

test('the gate sits below the measured first wall', () => {
  // If it did not, a genuinely stuck player would be told to keep going with
  // nowhere to go. The wall is measured at stage 7 in tests/stages.test.js.
  assert.ok(REBIRTH_MIN_STAGE < 7, `gate at ${REBIRTH_MIN_STAGE} is at or past the first wall`);
});

test('dying is not the same failure as running out of time', () => {
  // Three wipes walk you back one level; the clock running out costs a whole
  // stage and holds you. Both exist, they punish differently, and a fixture
  // that confused them passed while asserting nothing.
  const s = atBoss(4);
  const startDepth = s.combat.depth;
  const combat = new Combat(s);
  // Real stats at level 1 against a stage-4 boss: this player dies.
  const stats = combatStats(s);
  run(combat, stats, B.WALL_SECONDS + 1);

  assert.ok(s.combat.depth > startDepth - B.LEVELS_PER_STAGE, 'wipes retreat by a level, not a stage');
  assert.equal(s.combat.bossTimeouts, 0, 'and they are not timeouts');
});
