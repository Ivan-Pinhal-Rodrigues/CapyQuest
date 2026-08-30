// The boss clock, and what a failed attempt costs.
//
// Thirty seconds used to be a figure the wall detector quoted at you: a boss
// that took fifty seconds still died, slowly, and the banner suggested you
// rebirth *before you had ever attempted it* — a spoiler for a game whose
// whole ask is "let them try it out and get lucky or not". The clock is real
// now, a failed attempt costs a short ATK debuff rather than ground, and the
// wall banner only speaks once a boss has actually run the clock out.
//
// The old design rolled a timed-out player back a whole stage and held them
// there until they pressed Forward. That is gone — no rollback, no hold, the
// very next tick simply re-engages the same unbeaten boss — but `holding` is
// still in the state schema and Combat.settle() still honours it if it is
// already true, purely so a save written under the old design still behaves
// the way it did when it loads. New timeouts never set it.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as B from '../src/balance.js';
import { createState, reconcileState } from '../src/state.js';
import { Combat } from '../src/systems/combat.js';
import { combatStats } from '../src/systems/combatStats.js';
import { REBIRTH_MIN_STAGE, shouldSuggestRebirth } from '../src/systems/wall.js';
import { SKILLS_BY_ID } from '../src/data/skills.js';

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

/** A plain, deterministic attacker — no crit, so damage math is exact. */
function attacker(atk) {
  return { atk, def: 0, spd: 0, crit: 0, critMult: 2, luck: 0, element: 'water', level: 1 };
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

// -------------------------------------------------------- the failed attempt

test('running the clock out costs no ground at all', () => {
  const s = atBoss(4);
  const startDepth = s.combat.depth;
  const combat = new Combat(s);
  const stats = stalemate();
  combat.engage(stats);

  run(combat, stats, B.WALL_SECONDS + 1);

  assert.equal(s.combat.depth, startDepth, 'no rollback — you stay exactly where you were');
  assert.equal(s.combat.holding, false, 'and nothing holds the fight in place either');
  assert.equal(s.combat.bossTimeouts, 1);
  assert.equal(s.combat.bossTimeoutStreak, 1);
});

test('the very next tick re-engages the same boss, full health', () => {
  const s = atBoss(4);
  const combat = new Combat(s);
  const stats = stalemate();
  combat.engage(stats);
  const bossId = combat.enemy.id;

  run(combat, stats, B.WALL_SECONDS + 1);

  assert.equal(combat.phase, 'fighting', 'auto-battle picks the fight back up on its own');
  assert.equal(combat.enemy.id, bossId, 'the same boss');
  assert.equal(combat.enemy.hp, combat.enemy.maxHp, 'at full health — it was never softened');
});

test('a timeout is announced, and says which boss and where', () => {
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

test('and a repeat timeout against the same boss still pays nothing, by construction', () => {
  // Not a special case: the next fight is this same unbeaten boss, so there is
  // no reward branch a repeat could reach until it actually falls.
  const s = atBoss(4);
  const combat = new Combat(s);
  const stats = stalemate();
  combat.engage(stats);

  const rewards = run(combat, stats, (B.WALL_SECONDS + 1) * 3);

  assert.deepEqual(rewards, []);
  assert.equal(s.combat.bossTimeouts, 3);
  assert.equal(s.combat.bossTimeoutStreak, 3, 'three in a row, not reset between them');
});

test('a win resets the streak, whatever it was fighting', () => {
  const s = atBoss(1, { weak: false });
  const combat = new Combat(s);
  const badStats = stalemate();
  combat.engage(badStats);
  run(combat, badStats, B.WALL_SECONDS + 1);
  assert.equal(s.combat.bossTimeoutStreak, 1);

  // Travel back to a trash level and win it with real stats — a win anywhere
  // clears the streak, not only a win against the boss that set it.
  combat.travelTo(s.combat.depth - B.LEVELS_PER_STAGE);
  const goodStats = combatStats(s);
  combat.engage(goodStats);
  run(combat, goodStats, 30);

  assert.ok(s.combat.clears > 0, 'the trash level should have fallen');
  assert.equal(s.combat.bossTimeoutStreak, 0);
});

test('the timer cannot fire on a boss you finish in time', () => {
  const s = atBoss(1, { weak: false });
  const combat = new Combat(s);
  const stats = combatStats(s);
  combat.engage(stats);

  run(combat, stats, B.WALL_SECONDS + 5);

  assert.equal(s.combat.bossTimeouts, 0, 'a boss that died did not outlast anybody');
  assert.equal(s.combat.bossTimeoutStreak, 0);
  assert.ok(s.combat.bossKills > 0, 'and it should have been killed');
});

test('stage 0 behaves exactly like any other stage — there is nowhere to roll back to any more', () => {
  const s = atBoss(0);
  const startDepth = s.combat.depth; // the stage-0 boss, not level 0 itself
  const combat = new Combat(s);
  const stats = stalemate();
  combat.engage(stats);

  run(combat, stats, B.WALL_SECONDS + 1);
  assert.equal(s.combat.depth, startDepth, 'unchanged, same as every other stage');
  assert.equal(s.combat.holding, false);
});

test('dying is not the same failure as running out of time', () => {
  // Three wipes walk you back one level; the clock running out costs nothing
  // but time and the debuff. Both exist, they punish differently, and a
  // fixture that confused them passed while asserting nothing.
  const s = atBoss(4);
  const startDepth = s.combat.depth;
  const combat = new Combat(s);
  // Real stats at level 1 against a stage-4 boss: this player dies.
  const stats = combatStats(s);
  run(combat, stats, B.WALL_SECONDS + 1);

  assert.ok(s.combat.depth < startDepth, 'wipes retreat, timeouts do not move you at all');
  assert.equal(s.combat.bossTimeouts, 0, 'and they are not timeouts');
});

// -------------------------------------------------------------- the debuff

test('a timeout applies a short ATK debuff that lapses on its own', () => {
  const s = atBoss(4);
  const combat = new Combat(s);
  const stats = stalemate();
  combat.engage(stats);

  assert.equal(combat.atkDebuffMult(), 1, 'nothing has failed yet');
  run(combat, stats, B.WALL_SECONDS + 1);
  assert.equal(combat.atkDebuffMult(), B.TIMEOUT_DEBUFF_MULT, 'freshly timed out');

  run(combat, stats, B.TIMEOUT_DEBUFF_SECONDS + 1);
  assert.equal(combat.atkDebuffMult(), 1, 'and it lapses well before the next thirty seconds are up');
});

test('the debuff actually reduces damage dealt, not just the multiplier', () => {
  const s = atBoss(4);
  const combat = new Combat(s);
  const stats = attacker(1000);
  combat.engage(stats);
  const hp = combat.enemy.maxHp;

  combat.enemy.hp = hp;
  combat.playerAttack(stats);
  const normal = hp - combat.enemy.hp;

  combat.enemy.hp = hp;
  combat.timeoutDebuffUntil = combat.clock + B.TIMEOUT_DEBUFF_SECONDS;
  combat.playerAttack(stats);
  const debuffed = hp - combat.enemy.hp;

  assert.ok(debuffed < normal, 'a debuffed hit must do less damage');
  assert.ok(Math.abs(debuffed / normal - B.TIMEOUT_DEBUFF_MULT) < 1e-9, 'exactly the debuff factor');
});

test('a skill cast is debuffed the same way an attack is', () => {
  const s = atBoss(4);
  const combat = new Combat(s);
  const stats = attacker(1000);
  combat.engage(stats);
  const hp = combat.enemy.maxHp;
  const skill = SKILLS_BY_ID.chomp;

  combat.enemy.hp = hp;
  combat.castSkill(skill, stats);
  const normal = hp - combat.enemy.hp;

  combat.enemy.hp = hp;
  combat.timeoutDebuffUntil = combat.clock + B.TIMEOUT_DEBUFF_SECONDS;
  combat.castSkill(skill, stats);
  const debuffed = hp - combat.enemy.hp;

  assert.ok(debuffed < normal, 'a debuffed cast must do less damage too');
});

// -------------------------------------------------- legacy save compatibility
//
// The rollback-and-hold design is gone and nothing sets `holding` any more,
// but a save written under it still has `holding: true` sitting in its combat
// block, and settle() still honours that flag exactly as it always did — the
// alternative is a save that silently starts behaving differently than it did
// the last time it was open.

test('a legacy hold still stops a win from walking the fight forward', () => {
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

test('a legacy held win still pays out — it is the ground you keep, not the reward', () => {
  const s = atBoss(1, { weak: false });
  s.combat.holding = true;

  const combat = new Combat(s);
  const stats = combatStats(s);
  combat.engage(stats);
  const rewards = run(combat, stats, 20);

  assert.ok(rewards.length > 0, 'a kill under the hold still pays');
  assert.ok(s.combat.clears > 0);
});

test('travelling anywhere on purpose releases a legacy hold', () => {
  const s = atBoss(3, { weak: false });
  s.combat.holding = true;
  const combat = new Combat(s);

  combat.travelTo(s.combat.depth + 1);
  assert.equal(s.combat.holding, false, 'Forward is the deliberate act the hold waits for');

  s.combat.holding = true;
  combat.travelTo(s.combat.depth - 1);
  assert.equal(s.combat.holding, false, 'walking back on purpose releases it too');
});

test('a legacy hold is announced rather than silently stalling', () => {
  const s = atBoss(1, { weak: false });
  s.combat.holding = true;
  const combat = new Combat(s);
  const stats = combatStats(s);
  combat.engage(stats);
  combat.drainEvents();

  run(combat, stats, 20);
  assert.ok(combat.drainEvents().some((e) => e.kind === 'held'), 'a fight that stops moving must say why');
});

test('progress() reports a legacy hold so the panel can explain it', () => {
  const s = atBoss(2);
  s.combat.holding = true;
  const combat = new Combat(s);
  combat.engage(stalemate());
  assert.equal(combat.progress().holding, true);
});

// ------------------------------------------------------------------- the save

test('a save from before the timer loads with no timeouts and no streak', () => {
  const old = createState();
  delete old.combat.holding;
  delete old.combat.bossTimeouts;
  delete old.combat.bossTimeoutStreak;

  const fixed = reconcileState(old);
  assert.equal(fixed.combat.holding, false);
  assert.equal(fixed.combat.bossTimeouts, 0);
  assert.equal(fixed.combat.bossTimeoutStreak, 0);
});

test('a hand-edited hold and streak are coerced rather than trusted', () => {
  const s = createState();
  s.combat.holding = 'yes please';
  s.combat.bossTimeouts = -4;
  s.combat.bossTimeoutStreak = -1;
  const fixed = reconcileState(s);
  assert.equal(fixed.combat.holding, true);
  assert.equal(fixed.combat.bossTimeouts, 0, 'a negative count is not a count');
  assert.equal(fixed.combat.bossTimeoutStreak, 0);
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
  // nowhere to go. The wall is measured in tests/stages.test.js.
  assert.ok(REBIRTH_MIN_STAGE < 7, `gate at ${REBIRTH_MIN_STAGE} is at or past the first wall`);
});
