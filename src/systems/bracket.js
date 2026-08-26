// The weekly bracket: the leaderboard, with something at stake.
//
// The board was a screenshot. Sixty rivals were generated from the season seed,
// advanced on a believable curve, and never interacted with you in any way —
// you could read their gear, and that was the whole feature. Nothing you did
// changed your place and nothing happened when the season ended.
//
// A bracket fixes that with the pieces already lying around. Once a week you
// are matched against three rivals near your rank, your kit fights theirs, and
// you place first through fourth. You enter once; the entry is the stake.
//
// What "fights" means, precisely, because it matters that this is not theatre:
// both sides are resolved into stat blocks and traded blow for blow through
// B.damage() — the same function the real fight loop uses, so gear, rungs and
// stars carry exactly the weight they carry everywhere else. It is not the full
// Combat state machine: there are no skills, no bracing and no boss patterns,
// because a rival has a loadout and no behaviour to simulate. Calling it a duel
// rather than a fight is the honest description.
//
// Deterministic on (season, week, your kit), so refreshing the page cannot
// re-roll a result you did not like.

import * as B from '../balance.js';
import { SLOT_IDS } from '../data/gear.js';
import { resolveItem } from './equipment.js';
import { combatStats } from './combatStats.js';
import { rivalsFor, rank, playerEntry } from './leaderboard.js';
import { weekKey } from './quests.js';

/** How many rivals you face. Four in the bracket including you. */
export const BRACKET_SIZE = 3;

/** Rounds a duel runs before it is called a draw on remaining health. */
const MAX_ROUNDS = 200;

/**
 * What each placement pays.
 *
 * Fourth still pays. A weekly event that gives nothing for turning up teaches
 * people not to turn up, and the bracket is meant to be a reason to come back
 * rather than a thing you must win to have bothered.
 */
export const BRACKET_REWARDS = {
  1: { leafs: 220, tickets: 3, pass: 90, text: 'First — 220 leafs, 3 tickets' },
  2: { leafs: 140, tickets: 2, pass: 60, text: 'Second — 140 leafs, 2 tickets' },
  3: { leafs: 90, tickets: 1, pass: 40, text: 'Third — 90 leafs, 1 ticket' },
  4: { leafs: 50, tickets: 1, pass: 25, text: 'Fourth — 50 leafs, 1 ticket' },
};

/** A rival's combat block, summed from the loadout the board already gave them. */
export function rivalStats(rival) {
  const base = { atk: 0, def: 0, hp: 0, spd: 0, crit: 0.05, critMult: 2 };
  for (const piece of rival.gear || []) {
    for (const [key, value] of Object.entries(piece.stats || {})) {
      if (key === 'crit') base.crit += value;
      else if (key === 'critDmg') base.critMult += value;
      else base[key] = (base[key] || 0) + value;
    }
  }
  // Depth stands in for the levels and tree ranks a rival is implied to have.
  // Without it a deep rival in modest gear would fight like a beginner, and the
  // board's whole claim — that these are people ahead of you — would be a lie.
  const depthScale = 1 + rival.depth / 40;
  base.atk = Math.max(1, base.atk * depthScale);
  base.def = Math.max(0, base.def * depthScale);
  base.hp = Math.max(1, base.hp * depthScale);
  base.spd = Math.max(1, base.spd || 20);
  base.crit = B.clamp(base.crit, 0, 0.75);
  return base;
}

/** The player's block, in the same shape. */
export function playerStats(state) {
  const s = combatStats(state);
  return { atk: s.atk, def: s.def, hp: s.hp, spd: s.spd, crit: s.crit, critMult: s.critMult };
}

/**
 * One duel, deterministic given the seed.
 *
 * Both sides swing on their own interval, exactly as the fight loop does, so a
 * fast light build genuinely trades against a slow heavy one instead of the two
 * being collapsed into a single power number.
 */
export function duel(a, b, seed) {
  const rng = B.makeRng(seed >>> 0);
  const rate = (s) => 0.65 + Math.min(1.6, (s.spd || 20) / 260);

  let aHp = a.hp;
  let bHp = b.hp;
  let aNext = 1 / rate(a);
  let bNext = 1 / rate(b);

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const t = Math.min(aNext, bNext);
    aNext -= t;
    bNext -= t;

    if (aNext <= 1e-9) {
      const crit = rng() < a.crit;
      bHp -= B.damage({ atk: a.atk, def: b.def, crit, critMult: a.critMult });
      aNext += 1 / rate(a);
      if (bHp <= 0) return { win: true, rounds: round + 1, hpLeft: aHp / a.hp };
    }
    if (bNext <= 1e-9) {
      const crit = rng() < b.crit;
      aHp -= B.damage({ atk: b.atk, def: a.def, crit, critMult: b.critMult });
      bNext += 1 / rate(b);
      if (aHp <= 0) return { win: false, rounds: round + 1, hpLeft: 0 };
    }
  }

  // Nobody fell. Whoever is in better shape takes it — a draw would leave the
  // bracket without a placement, and "nothing happened" is the outcome this
  // whole feature exists to remove.
  const aShare = aHp / a.hp;
  const bShare = bHp / b.hp;
  return { win: aShare >= bShare, rounds: MAX_ROUNDS, hpLeft: Math.max(0, aShare), timeout: true };
}

/**
 * This week's three opponents: the rivals immediately around you on the board.
 *
 * Around rather than above, so the bracket is winnable without being a
 * formality — being matched only against people ahead of you would make fourth
 * place the permanent result, and only against people behind you would make
 * first place meaningless.
 */
export function opponentsFor(state, now = Date.now(), cached = null) {
  const { rows } = cached || rivalsFor(now);
  const me = playerEntry(state, now);
  const ranked = rank([...rows, me]);
  const myIndex = ranked.findIndex((r) => r.you);

  const near = [];
  for (let offset = 1; near.length < BRACKET_SIZE && offset < ranked.length; offset++) {
    for (const index of [myIndex - offset, myIndex + offset]) {
      if (index < 0 || index >= ranked.length || index === myIndex) continue;
      if (near.length < BRACKET_SIZE) near.push(ranked[index]);
    }
  }
  return near;
}

/** Has this week's bracket already been run? */
export function bracketEntered(state, now = Date.now()) {
  return state.bracket?.weekKey === weekKey(now) && state.bracket.placement > 0;
}

export function bracketStatus(state, now = Date.now(), cached = null) {
  const week = weekKey(now);
  const entered = bracketEntered(state, now);
  return {
    week,
    entered,
    placement: entered ? state.bracket.placement : 0,
    claimed: entered && !!state.bracket.claimed,
    results: entered ? state.bracket.results || [] : [],
    best: state.bracket?.best || 0,
    opponents: opponentsFor(state, now, cached),
    reward: entered ? BRACKET_REWARDS[state.bracket.placement] : null,
  };
}

/**
 * Fight the three of them and take a placement.
 *
 * Once a week. The result is written into the save rather than recomputed on
 * demand, so a player who then changes their gear keeps the placement they
 * actually earned — recomputing would let anyone re-roll a bad week by
 * swapping a hat.
 */
export function enterBracket(state, now = Date.now(), cached = null) {
  if (bracketEntered(state, now)) return { ok: false, reason: 'entered' };

  const opponents = opponentsFor(state, now, cached);
  if (!opponents.length) return { ok: false, reason: 'noOpponents' };

  const mine = playerStats(state);
  const week = weekKey(now);
  const seedBase = [...week].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 11);

  const results = opponents.map((rival, i) => {
    const out = duel(mine, rivalStats(rival), seedBase + i * 7919);
    return { id: rival.id, name: rival.name, won: out.win, rounds: out.rounds };
  });

  const wins = results.filter((r) => r.won).length;
  // Three opponents, so three wins is first and none is fourth.
  const placement = BRACKET_SIZE + 1 - wins;

  state.bracket = {
    weekKey: week,
    placement,
    claimed: false,
    results,
    best: Math.max(state.bracket?.best || 0, placement === 1 ? 1 : state.bracket?.best || 0),
  };
  // `best` is a placement, so lower is better — and 0 means "never placed".
  const previous = state.bracket.best;
  state.bracket.best = previous === 0 ? placement : Math.min(previous, placement);

  return { ok: true, placement, wins, results, reward: BRACKET_REWARDS[placement] };
}

/** Take the placement reward. Once. */
export function claimBracket(state, now = Date.now()) {
  if (!bracketEntered(state, now)) return { ok: false, reason: 'notEntered' };
  if (state.bracket.claimed) return { ok: false, reason: 'claimed' };
  state.bracket.claimed = true;
  return { ok: true, reward: BRACKET_REWARDS[state.bracket.placement] };
}
