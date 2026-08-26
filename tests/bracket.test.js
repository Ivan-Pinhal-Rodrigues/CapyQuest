// The weekly bracket — the leaderboard with something at stake.
//
// The two things that matter here: it must be *winnable* (a bracket you always
// come fourth in is a weekly reminder that you are losing), and it must be
// *fixed* once entered (a result you can re-roll by swapping a hat is not a
// result).

import test from 'node:test';
import assert from 'node:assert/strict';

import { createState, reconcileState } from '../src/state.js';
import {
  BRACKET_REWARDS,
  BRACKET_SIZE,
  bracketEntered,
  bracketStatus,
  claimBracket,
  duel,
  enterBracket,
  opponentsFor,
  playerStats,
  rivalStats,
} from '../src/systems/bracket.js';
import { rivalsFor } from '../src/systems/leaderboard.js';
import { weekKey } from '../src/systems/quests.js';

const NOW = Date.UTC(2026, 7, 25, 12);

/** A player with a real kit at some depth. */
function contender(depth = 200, atk = 4000) {
  const s = createState();
  s.combat.bestDepth = depth;
  s.combat.depth = depth;
  s.combat.xp = 4e5;
  s.rebirthCount = 6;
  return s;
}

// ------------------------------------------------------------------ the duel

test('a duel is decisive and deterministic', () => {
  const a = { atk: 500, def: 40, hp: 5000, spd: 100, crit: 0.1, critMult: 2 };
  const b = { atk: 400, def: 30, hp: 4500, spd: 90, crit: 0.1, critMult: 2 };

  const first = duel(a, b, 1234);
  const again = duel(a, b, 1234);
  assert.deepEqual(first, again, 'the same seed gave a different result');
  assert.equal(typeof first.win, 'boolean');
  assert.ok(first.rounds > 0);
});

test('a much stronger fighter wins', () => {
  const strong = { atk: 5000, def: 200, hp: 50000, spd: 120, crit: 0.2, critMult: 2 };
  const weak = { atk: 100, def: 10, hp: 1000, spd: 60, crit: 0, critMult: 2 };
  for (let seed = 0; seed < 20; seed++) {
    assert.equal(duel(strong, weak, seed).win, true, `seed ${seed} went the wrong way`);
    assert.equal(duel(weak, strong, seed).win, false, `seed ${seed} went the wrong way`);
  }
});

test('speed genuinely trades against power', () => {
  // If the duel collapsed both sides into one number, a fast light build and a
  // slow heavy one with the same product would be indistinguishable.
  const fast = { atk: 260, def: 30, hp: 4000, spd: 260, crit: 0, critMult: 2 };
  const slow = { atk: 900, def: 30, hp: 4000, spd: 20, crit: 0, critMult: 2 };
  const fastWins = duel(fast, slow, 7).win;
  const swapped = duel(slow, fast, 7).win;
  assert.notEqual(fastWins, swapped, 'the duel is not symmetric — one side is favoured by turn order alone');
});

test('a duel always resolves, even between two immovable objects', () => {
  // Two fighters who cannot hurt each other must still produce a placement.
  const wall = { atk: 1, def: 1e9, hp: 1e6, spd: 50, crit: 0, critMult: 2 };
  const out = duel(wall, { ...wall }, 3);
  assert.equal(typeof out.win, 'boolean');
  assert.ok(out.timeout, 'expected this one to run out of rounds');
});

// ------------------------------------------------------------- the opponents

test('you are matched with rivals from around your own rank', () => {
  const s = contender();
  const opponents = opponentsFor(s, NOW);
  assert.equal(opponents.length, BRACKET_SIZE);
  assert.equal(new Set(opponents.map((o) => o.id)).size, BRACKET_SIZE, 'the same rival twice');
  assert.ok(opponents.every((o) => !o.you), 'you were matched against yourself');
});

test('a rival fights with the loadout the board shows', () => {
  const { rows } = rivalsFor(NOW);
  const stats = rivalStats(rows[0]);
  for (const key of ['atk', 'def', 'hp', 'spd', 'crit', 'critMult']) {
    assert.ok(Number.isFinite(stats[key]), `${key} is not a number`);
  }
  assert.ok(stats.atk > 0 && stats.hp > 0);
  assert.ok(stats.crit >= 0 && stats.crit <= 0.75);
});

test('a rival with no gear at all still fights', () => {
  const stats = rivalStats({ depth: 0, gear: [] });
  assert.ok(stats.atk >= 1 && stats.hp >= 1 && stats.spd >= 1);
});

// -------------------------------------------------------------- the bracket

test('entering places you somewhere between first and last', () => {
  const s = contender();
  const out = enterBracket(s, NOW);
  assert.equal(out.ok, true);
  assert.ok(out.placement >= 1 && out.placement <= BRACKET_SIZE + 1);
  assert.equal(out.results.length, BRACKET_SIZE);
  assert.equal(out.placement, BRACKET_SIZE + 1 - out.wins);
});

test('you enter once a week', () => {
  const s = contender();
  assert.equal(enterBracket(s, NOW).ok, true);
  assert.equal(enterBracket(s, NOW).reason, 'entered');
  assert.equal(bracketEntered(s, NOW), true);
});

test('a new week opens it again', () => {
  const s = contender();
  enterBracket(s, NOW);
  const nextWeek = NOW + 8 * 86400e3;
  assert.notEqual(weekKey(nextWeek), weekKey(NOW));
  assert.equal(bracketEntered(s, nextWeek), false);
  assert.equal(enterBracket(s, nextWeek).ok, true);
});

test('a result cannot be re-rolled by changing your gear afterwards', () => {
  // The placement is written into the save rather than recomputed, so a bad
  // week stays a bad week.
  const s = contender();
  const out = enterBracket(s, NOW);
  s.combat.xp = 1e12; // suddenly enormous
  assert.equal(bracketStatus(s, NOW).placement, out.placement);
});

test('every placement pays something, and better placements pay more', () => {
  // Fourth paying nothing would teach people not to enter.
  let last = Infinity;
  for (const place of [1, 2, 3, 4]) {
    const reward = BRACKET_REWARDS[place];
    assert.ok(reward, `no reward for placement ${place}`);
    assert.ok(reward.leafs > 0, `placement ${place} pays no leafs`);
    assert.ok(reward.leafs < last, 'a worse placement paid at least as much');
    last = reward.leafs;
  }
});

test('the reward is claimed once', () => {
  const s = contender();
  enterBracket(s, NOW);
  const first = claimBracket(s, NOW);
  assert.equal(first.ok, true);
  assert.ok(first.reward.leafs > 0);
  assert.equal(claimBracket(s, NOW).reason, 'claimed');
});

test('nothing can be claimed before entering', () => {
  const s = contender();
  assert.equal(claimBracket(s, NOW).reason, 'notEntered');
});

function placementsAt(depth) {
  const out = [];
  for (const xp of [1e4, 1e5, 4e5, 2e6, 1e7]) {
    const s = createState();
    s.combat.bestDepth = depth;
    s.combat.depth = depth;
    s.combat.xp = xp;
    s.rebirthCount = Math.floor(depth / 60);
    const result = enterBracket(s, NOW);
    if (result.ok) out.push(result.placement);
  }
  return out;
}

test('a new player wins their first brackets', () => {
  // Deliberate. The bracket is a feature someone has to learn, and the first
  // few weeks of it should teach that entering is worth doing. It stops being
  // a formality once there is anyone real to be matched against — see below.
  for (const depth of [20, 50]) {
    const placements = placementsAt(depth);
    assert.ok(
      placements.every((p) => p === 1),
      `a shallow player placed ${placements.join(',')} — the first bracket should be a win`,
    );
  }
});

test('the bracket becomes a real competition with depth', () => {
  // The balance question. Deep in, the same player at different kit strengths
  // must land across the placements — if everyone comes first it is a payout
  // with extra steps, and if everyone comes fourth it is a weekly reminder that
  // they are losing.
  for (const depth of [200, 400, 900]) {
    const placements = placementsAt(depth);
    const spread = new Set(placements);
    assert.ok(
      spread.size >= 3,
      `at depth ${depth} the placements were ${placements.join(',')} — not a competition`,
    );
    assert.ok(placements.includes(1), `nobody could win at depth ${depth}`);
    assert.ok(Math.max(...placements) > 1, `everybody won at depth ${depth}`);
  }
});

// ------------------------------------------------------------------- status

test('status describes the week without entering it', () => {
  const s = contender();
  const before = bracketStatus(s, NOW);
  assert.equal(before.entered, false);
  assert.equal(before.placement, 0);
  assert.equal(before.opponents.length, BRACKET_SIZE);
  assert.equal(before.reward, null);
  assert.equal(bracketEntered(s, NOW), false, 'reading the status entered the bracket');

  enterBracket(s, NOW);
  const after = bracketStatus(s, NOW);
  assert.equal(after.entered, true);
  assert.ok(after.reward);
  assert.equal(after.results.length, BRACKET_SIZE);
});

test('the best placement is remembered, and lower is better', () => {
  const s = contender();
  enterBracket(s, NOW);
  const first = s.bracket.placement;
  assert.equal(s.bracket.best, first);

  // A worse week later must not overwrite a better placement.
  s.bracket.best = 1;
  s.bracket.weekKey = null;
  s.bracket.placement = 0;
  enterBracket(s, NOW);
  assert.equal(s.bracket.best, 1, 'a later week overwrote a better placement');
});

test('the bracket round-trips through a save, and an old save simply has none', () => {
  const s = contender();
  enterBracket(s, NOW);
  const back = reconcileState(JSON.parse(JSON.stringify(s)));
  assert.equal(back.bracket.placement, s.bracket.placement);
  assert.equal(back.bracket.results.length, BRACKET_SIZE);

  const old = createState();
  delete old.bracket;
  const repaired = reconcileState(old);
  assert.equal(repaired.bracket.placement, 0);
  assert.deepEqual(repaired.bracket.results, []);

  const junk = reconcileState({ ...createState(), bracket: { placement: 'first', results: 'none' } });
  assert.equal(junk.bracket.placement, 0);
  assert.deepEqual(junk.bracket.results, []);
});

test('playerStats reads the same block the real fight uses', () => {
  const s = contender();
  const stats = playerStats(s);
  for (const key of ['atk', 'def', 'hp', 'spd', 'crit', 'critMult']) {
    assert.ok(Number.isFinite(stats[key]), `${key} is missing`);
  }
});
