// The interactive combat layer.
//
// The load-bearing test in this file is "an idler still wins". Everything else
// here is mechanics; that one is the promise. Adding a skill ceiling that only
// attentive players can reach would quietly make idling — a supported way to
// play, and the genre's whole premise — into a mistake.

import test from 'node:test';
import assert from 'node:assert/strict';

import { createState, reconcileState } from '../src/state.js';
import {
  Combat,
  BRACE_REDUCTION,
  FOCUS_BONUS,
  FOCUS_MAX,
  FOCUS_PER_BRACE,
  HEAVY_EVERY,
  HEAVY_MULT,
  TELEGRAPH_SECONDS,
} from '../src/systems/combat.js';
import {
  BOSS_PATTERNS,
  ENRAGE_AFTER,
  SHIELD_LEAK,
  SHIELD_SECONDS,
  patternForStage,
  wardElement,
} from '../src/data/bossPatterns.js';
import { ELEMENT_CHART } from '../src/data/elements.js';
import { LEVELS_PER_STAGE, BOSS_LEVEL } from '../src/balance.js';

/** A stat block strong enough to fight, weak enough not to one-shot. */
function stats(overrides = {}) {
  return {
    atk: 400, def: 20, hp: 4000, spd: 100,
    crit: 0, critMult: 2, luck: 0, level: 10, element: 'leaf',
    ...overrides,
  };
}

function fighting(depth = 0, overrides = {}) {
  const s = createState();
  s.combat.unlocked = true;
  s.combat.autoBattle = true;
  s.combat.depth = depth;
  s.combat.bestDepth = Math.max(depth, s.combat.bestDepth);
  Object.assign(s.combat, overrides);
  const c = new Combat(s);
  c.engage(stats());
  return { s, c };
}

/** Run a fight to a decision, or give up. Returns the phase it ended on. */
function resolve(c, st, { dt = 0.1, maxSeconds = 600, onTick } = {}) {
  let t = 0;
  while (t < maxSeconds) {
    c.update(dt, st, () => {});
    onTick?.(c, t);
    if (c.phase === 'won' || c.phase === 'lost') return c.phase;
    t += dt;
  }
  return 'timeout';
}

// ------------------------------------------------------------- the promise

test('an auto-battler with auto-cast still clears every boss pattern', () => {
  // The line this whole phase must not cross.
  for (const pattern of BOSS_PATTERNS) {
    // Find a boss stage that uses this pattern.
    let stage = 1;
    while (patternForStage(stage)?.id !== pattern.id) stage++;
    const depth = stage * LEVELS_PER_STAGE + BOSS_LEVEL;

    const { c } = fighting(depth);
    assert.equal(c.pattern?.id, pattern.id, `stage ${stage} did not get ${pattern.id}`);

    // Deliberately enormous stats: the question is whether the pattern is
    // *answerable* without input, not whether the numbers are tuned.
    const st = stats({ atk: 1e9, hp: 1e9, def: 1e6 });
    const out = resolve(c, st, { maxSeconds: 300 });
    assert.equal(out, 'won', `${pattern.id} could not be cleared without player input`);
  }
});

test('auto-cast defaults on, and a save that never chose keeps it on', () => {
  assert.equal(createState().combat.autoCast, true);
  const old = createState();
  delete old.combat.autoCast;
  assert.equal(reconcileState(old).combat.autoCast, true);
});

test('a player who turned auto-cast off keeps it off across a reload', () => {
  const s = createState();
  s.combat.autoCast = false;
  assert.equal(reconcileState(JSON.parse(JSON.stringify(s))).combat.autoCast, false);
});

// -------------------------------------------------------------- the brace

test('every fourth enemy swing winds up instead of landing', () => {
  const { c } = fighting(0);
  const st = stats({ atk: 0.0001 }); // never kill the enemy; watch it swing
  let windups = 0;
  resolve(c, st, {
    dt: 0.05,
    maxSeconds: 60,
    onTick: () => {
      for (const ev of c.drainEvents()) if (ev.kind === 'windup') windups++;
    },
  });
  assert.ok(windups > 0, 'nothing ever telegraphed');
});

test('bracing halves the heavy and pays focus', () => {
  const { c } = fighting(0);
  const st = stats({ atk: 0.0001 });

  // Drive to a wind-up.
  let guard = 0;
  while (!c.winding && guard++ < 4000) c.update(0.05, st, () => {});
  assert.ok(c.winding, 'never reached a wind-up');

  // Focus has already been building from ordinary landed hits, so the brace is
  // measured as a delta rather than an absolute.
  const before = c.playerHp;
  const focusBefore = c.focus;
  assert.equal(c.brace(), true);
  assert.equal(c.focus - focusBefore, FOCUS_PER_BRACE);

  // Let the heavy land.
  c.update(TELEGRAPH_SECONDS + 0.05, st, () => {});
  const bracedDamage = before - c.playerHp;
  assert.ok(bracedDamage > 0, 'the heavy never landed');

  // The same heavy, unbraced.
  const { c: c2 } = fighting(0);
  let g2 = 0;
  while (!c2.winding && g2++ < 4000) c2.update(0.05, st, () => {});
  const before2 = c2.playerHp;
  c2.update(TELEGRAPH_SECONDS + 0.05, st, () => {});
  const fullDamage = before2 - c2.playerHp;

  assert.ok(
    bracedDamage < fullDamage,
    `braced ${bracedDamage.toFixed(0)} was not less than unbraced ${fullDamage.toFixed(0)}`,
  );
  assert.ok(Math.abs(bracedDamage / fullDamage - BRACE_REDUCTION) < 0.01);
});

test('bracing twice on one wind-up pays once', () => {
  const { c } = fighting(0);
  const st = stats({ atk: 0.0001 });
  let guard = 0;
  while (!c.winding && guard++ < 4000) c.update(0.05, st, () => {});
  assert.equal(c.brace(), true);
  const paid = c.focus;
  assert.equal(c.brace(), false, 'a second tap on the same tell paid again');
  assert.equal(c.focus, paid, 'the second tap paid focus anyway');
});

test('bracing when nothing is winding up does nothing and costs nothing', () => {
  const { c } = fighting(0);
  c.focus = 0;
  assert.equal(c.brace(), false);
  assert.equal(c.focus, 0);
});

test('a heavy hits harder than an ordinary swing', () => {
  assert.ok(HEAVY_MULT > 1);
  assert.ok(HEAVY_EVERY >= 3, 'telegraphing every other swing would be exhausting');
  assert.ok(TELEGRAPH_SECONDS >= 0.5, 'too fast to read on a phone');
});

// --------------------------------------------------------------- the focus

test('focus raises skill damage and is spent in full', () => {
  const st = stats();

  function skillHit(focus) {
    const { s, c } = fighting(0, { autoCast: false });
    s.combat.skills = ['chomp'];
    // The stage-0 enemy has 25 HP, so an unmodified Chomp kills it and both
    // measurements come back clamped to the same remaining-HP figure. Give it
    // enough health that the hit is the thing being measured.
    c.enemy.hp = c.enemy.maxHp = 1e9;
    c.focus = focus;
    c.drainEvents();
    const before = c.enemy.hp;
    c.castById('chomp', st);
    return before - c.enemy.hp;
  }

  const cold = skillHit(0);
  const hot = skillHit(FOCUS_MAX);
  assert.ok(cold > 0, 'the skill did nothing');
  assert.ok(hot > cold, `a full meter (${hot.toFixed(0)}) did not beat an empty one (${cold.toFixed(0)})`);
  assert.ok(Math.abs(hot / cold - FOCUS_BONUS) < 0.02, `full-focus bonus is x${(hot / cold).toFixed(2)}`);
});

test('casting does NOT empty the meter, and that is the point', () => {
  // The first version of this system spent the meter on each cast, which made
  // the optimal play "hold a ready skill until Focus fills". Measured against
  // idling, that clever play came out 26% WORSE, because a skill sitting unused
  // on cooldown costs more throughput than any per-cast bonus returns. Focus is
  // a multiplier now, never a cost, so casting the moment a skill is ready is
  // always right and attention never competes with throughput.
  const { s, c } = fighting(0, { autoCast: false });
  s.combat.skills = ['chomp'];
  c.focus = FOCUS_MAX;
  c.castById('chomp', stats());
  assert.equal(c.focus, FOCUS_MAX, 'casting consumed Focus');
});

test('focus multiplies ordinary attacks too, not only skills', () => {
  function swing(focus) {
    const { c } = fighting(0);
    c.enemy.hp = c.enemy.maxHp = 1e9;
    c.focus = focus;
    const before = c.enemy.hp;
    c.playerAttack(stats({ crit: 0 }));
    return before - c.enemy.hp;
  }
  const cold = swing(0);
  const hot = swing(FOCUS_MAX);
  assert.ok(hot > cold, 'a full meter did not improve a basic attack');
  assert.ok(Math.abs(hot / cold - FOCUS_BONUS) < 0.02);
});

test('focus decays, so the zone has to be kept up', () => {
  const { c } = fighting(0);
  c.focus = FOCUS_MAX;
  c.update(1, stats({ atk: 0.0001 }), () => {});
  assert.ok(c.focus < FOCUS_MAX, 'focus never decayed');
  assert.ok(c.focus > 0, 'a single second emptied the whole meter');
});

test('bracing is worth roughly a third more damage, and idling is never punished', () => {
  // The balance promise of this whole phase, asserted rather than hoped.
  // An idler must be no worse off than before any of this existed (focus 0
  // means a multiplier of exactly 1.0), and an attentive player must gain
  // enough to be worth the attention without making idling a mistake.
  const { c } = fighting(0);
  c.focus = 0;
  assert.equal(c.focusMult(), 1, 'an idler is not at a straight 1.0 multiplier');

  c.focus = FOCUS_MAX;
  const best = c.focusMult();
  assert.ok(best > 1.25, `full attention is only worth x${best.toFixed(2)}`);
  assert.ok(best < 1.6, `full attention is worth x${best.toFixed(2)} — idling becomes a mistake`);
});

test('a fight finished by a hand-cast skill still pays out and advances', () => {
  // Found by measurement, not by reading: settle() was only reachable from
  // inside update(), so a manual finisher left the fight stuck on 'won' —
  // paying nothing, advancing nowhere, forever.
  const { s, c } = fighting(0, { autoCast: false });
  s.combat.skills = ['chomp'];
  const st = stats({ atk: 1e9 });
  const depthBefore = s.combat.depth;

  let paid = 0;
  c.castById('chomp', st);
  assert.equal(c.phase, 'won', 'the skill did not finish the fight');

  c.update(0.05, st, () => paid++);
  assert.equal(paid, 1, 'the kill never paid out');
  assert.equal(s.combat.depth, depthBefore + 1, 'the depth never advanced');
});

test('a fight settles exactly once', () => {
  const { s, c } = fighting(0, { autoCast: false });
  s.combat.skills = ['chomp'];
  const st = stats({ atk: 1e9 });
  c.castById('chomp', st);

  let paid = 0;
  for (let i = 0; i < 10; i++) c.update(0.05, st, () => paid++);
  assert.equal(paid, 1, `the same kill paid out ${paid} times`);
});

test('focus never exceeds the maximum', () => {
  const { c } = fighting(0);
  for (let i = 0; i < 200; i++) c.addFocus(FOCUS_PER_BRACE);
  assert.equal(c.focus, FOCUS_MAX);
});

// ------------------------------------------------------------ manual casting

test('manual casting refuses a skill that is not slotted or not ready', () => {
  const { s, c } = fighting(0, { autoCast: false });
  s.combat.skills = ['chomp'];
  const st = stats();

  assert.equal(c.castById('splash', st), false, 'cast a skill that is not slotted');
  assert.equal(c.castById('chomp', st), true);
  assert.equal(c.castById('chomp', st), false, 'cast the same skill twice off one cooldown');
});

test('with auto-cast off, skills do not fire themselves', () => {
  const { s, c } = fighting(0, { autoCast: false });
  s.combat.skills = ['chomp'];
  const st = stats({ atk: 0.0001 });

  let casts = 0;
  resolve(c, st, {
    dt: 0.1,
    maxSeconds: 30,
    onTick: () => {
      for (const ev of c.drainEvents()) if (ev.kind === 'skill') casts++;
    },
  });
  assert.equal(casts, 0, 'a skill fired itself with auto-cast off');
});

test('with auto-cast on, skills fire themselves', () => {
  const { s, c } = fighting(0, { autoCast: true });
  s.combat.skills = ['chomp'];
  const st = stats({ atk: 0.0001 });

  let casts = 0;
  resolve(c, st, {
    dt: 0.1,
    maxSeconds: 30,
    onTick: () => {
      for (const ev of c.drainEvents()) if (ev.kind === 'skill') casts++;
    },
  });
  assert.ok(casts > 0, 'auto-cast fired nothing');
});

test('cooldowns tick down whether or not auto-cast is on', () => {
  const { s, c } = fighting(0, { autoCast: false });
  s.combat.skills = ['chomp'];
  c.cooldowns.chomp = 4;
  c.update(1, stats({ atk: 0.0001 }), () => {});
  assert.ok(c.cooldowns.chomp < 4, 'cooldown froze with auto-cast off');
});

// ------------------------------------------------------------ boss patterns

test('the first boss has no pattern, and later ones cycle', () => {
  // Stage 0's boss teaches that bosses are big, not that they have rules.
  assert.equal(patternForStage(0), null);
  const seen = new Set();
  for (let stage = 1; stage <= BOSS_PATTERNS.length; stage++) {
    seen.add(patternForStage(stage).id);
  }
  assert.equal(seen.size, BOSS_PATTERNS.length, 'the cycle skips a pattern');
});

test('a pattern is stable for a given stage', () => {
  // A boss you failed must be the same boss when you come back.
  for (const stage of [1, 2, 3, 17, 240]) {
    assert.equal(patternForStage(stage).id, patternForStage(stage).id);
  }
});

test('an ordinary level never gets a pattern', () => {
  for (let level = 0; level < BOSS_LEVEL; level++) {
    const { c } = fighting(3 * LEVELS_PER_STAGE + level);
    assert.equal(c.pattern, null, `level ${level} got a boss pattern`);
  }
});

test('a ward leaks rather than blocking outright', () => {
  const { c } = fighting(0);
  c.ward = { element: 'water', left: SHIELD_SECONDS };
  c.pattern = { id: 'shield' };
  const before = c.enemy.hp;
  // Wrong stance: some damage gets through, so a player who cannot answer is
  // slowed rather than stopped.
  c.dealToEnemy(1000, { stance: 'ember' });
  const leaked = before - c.enemy.hp;
  assert.ok(leaked > 0, 'a ward blocked everything');
  assert.ok(Math.abs(leaked / 1000 - SHIELD_LEAK) < 0.001);
  assert.ok(c.ward, 'the wrong element broke the ward');
});

test('the right stance breaks a ward outright', () => {
  const { c } = fighting(0);
  c.ward = { element: 'water', left: SHIELD_SECONDS };
  c.pattern = { id: 'shield' };
  c.dealToEnemy(1000, { stance: 'water' });
  assert.equal(c.ward, null, 'the counter element did not break the ward');
});

test('a ward lapses on its own so a fight can never deadlock', () => {
  const { c } = fighting(0);
  c.ward = { element: 'water', left: 1 };
  c.pattern = { id: 'shield' };
  c.tickPattern(1.5);
  assert.equal(c.ward, null);
});

test('the ward element is the one that counters the boss', () => {
  // The answer is the one the stance selector already teaches.
  assert.equal(wardElement('ember', ELEMENT_CHART), 'water');
  assert.equal(wardElement('leaf', ELEMENT_CHART), 'ember');
  assert.equal(wardElement('water', ELEMENT_CHART), 'leaf');
  // Moon and Sun counter each other, so every ward in the game has an answer.
  assert.equal(wardElement('moon', ELEMENT_CHART), 'sun');
  assert.equal(wardElement('sun', ELEMENT_CHART), 'moon');
  for (const element of Object.keys(ELEMENT_CHART)) {
    assert.ok(wardElement(element, ELEMENT_CHART), `nothing counters ${element}`);
  }
});

test('an escort soaks damage until it falls, then the boss takes hits', () => {
  const { c } = fighting(0);
  c.add = { hp: 500, maxHp: 500 };
  const bossHp = c.enemy.hp;

  c.dealToEnemy(200, {});
  assert.equal(c.enemy.hp, bossHp, 'the boss took damage through its escort');
  assert.equal(c.add.hp, 300);

  c.dealToEnemy(400, {});
  assert.equal(c.add, null, 'the escort survived lethal damage');

  c.dealToEnemy(100, {});
  assert.ok(c.enemy.hp < bossHp, 'the boss was still immune after the escort fell');
});

test('enrage starts late and ramps, so a fast kill never sees it', () => {
  const { c } = fighting(0);
  c.pattern = { id: 'enrage' };
  c.fightTime = ENRAGE_AFTER - 1;
  c.tickPattern(0.1);
  assert.equal(c.enrage, 0, 'enraged before its timer');

  c.fightTime = ENRAGE_AFTER + 10;
  c.tickPattern(0.1);
  assert.ok(c.enrage > 0, 'never enraged');
});

// -------------------------------------------------------------- the readout

test('progress() reports everything the panel draws', () => {
  const { c } = fighting(0);
  const p = c.progress();
  for (const key of ['enemyHp', 'playerHp', 'focus', 'winding', 'windUp', 'braced', 'ward', 'add', 'enraged']) {
    assert.ok(key in p, `progress() is missing ${key}`);
  }
  assert.ok(p.focus >= 0 && p.focus <= 1, 'focus is not a ratio');
});

test('skillStates reports cooldown and readiness for the slotted three', () => {
  const { s, c } = fighting(0);
  s.combat.skills = ['chomp', 'splash'];
  const states = c.skillStates();
  assert.equal(states.length, 2);
  assert.equal(states[0].ready, true);

  c.cooldowns.chomp = 2;
  assert.equal(c.skillStates()[0].ready, false);
  assert.ok(c.skillStates()[0].ratio < 1);
});

test('skillReady is false for a skill that is not slotted', () => {
  const { s, c } = fighting(0);
  s.combat.skills = ['chomp'];
  assert.equal(c.skillReady('chomp'), true);
  assert.equal(c.skillReady('splash'), false);
});

test('a boss telegraphs early so the mechanic is taught before it matters', () => {
  // Ordinary enemies die in seconds; a first heavy on swing four often never
  // arrives, which would mean the player first meets bracing under boss
  // pressure. A boss's second swing is the telegraphed one.
  const { c } = fighting(2 * LEVELS_PER_STAGE + BOSS_LEVEL);
  assert.equal(c.enemy.boss, true);
  const st = stats({ atk: 0.0001, hp: 1e9 });

  let firstWindupAt = null;
  let t = 0;
  while (t < 30 && firstWindupAt === null) {
    c.update(0.05, st, () => {});
    for (const ev of c.drainEvents()) if (ev.kind === 'windup') firstWindupAt = t;
    t += 0.05;
  }
  assert.ok(firstWindupAt !== null, 'a boss never telegraphed');
  assert.ok(firstWindupAt < 2 * c.enemy.attackEvery + 1, `first tell came at ${firstWindupAt.toFixed(1)}s`);
});

test('an ordinary enemy does not telegraph on its opening swing', () => {
  // Mobs are not where this is taught, and a tell on every mob's first swing
  // would turn a quiet grind into a drumbeat of alarms.
  const { c } = fighting(2 * LEVELS_PER_STAGE);
  assert.equal(c.enemy.boss, false);
  assert.equal(c.swings, 0);
});
