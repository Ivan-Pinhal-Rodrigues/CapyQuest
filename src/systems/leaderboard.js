// The seasonal leaderboard.
//
// The board is simulated and the panel says so out loud. What it is *not* is
// fake in the lazy sense: a rival is generated from a seed, advances across the
// 45 days on a curve that belongs to their archetype, and carries a real gear
// loadout resolved through the same resolveItem() the player's kit uses. Tapping
// one shows their rungs and their stars, drawn by the same code that draws
// yours, because a board you cannot inspect is just a list of numbers.
//
// None of it is stored. Rivals are a pure function of (season index, day), so a
// reload rebuilds exactly the same board and there is nothing to migrate.

import * as B from '../balance.js';
import { GEAR, SLOT_IDS } from '../data/gear.js';
import { MAX_TIER, MAX_STARS } from '../data/rarities.js';
import { ARCHETYPES, RIVAL_COUNT, rivalName } from '../data/rivals.js';
import { seasonAt, SEASON_DAYS } from '../data/seasons.js';
import { resolveItem } from './equipment.js';
import { passLevel } from './season.js';

/** Stated on the panel, never in small print. */
export const SIMULATED_NOTICE = 'These are simulated rivals. There is no server and no one else is playing.';

/**
 * A rival's depth on a given day. Each archetype has its own shape, so the board
 * reshuffles over a season instead of being a fixed order with a clock on it —
 * the sprinter leads in week one and gets passed, the grinder arrives late.
 */
function depthOnDay(rival, day) {
  const t = B.clamp(day / SEASON_DAYS, 0, 1);
  const arch = rival.archetype;

  // Sprinters front-load: most of their progress lands in the first fifth.
  // Grinders are close to linear. Idlers barely move. The exponent does it.
  const shape = arch.id === 'sprinter'
    ? Math.pow(t, 0.42)
    : arch.id === 'weekender'
      ? t + Math.sin(t * Math.PI * 6.4) * 0.04
      : Math.pow(t, arch.id === 'idler' ? 1.35 : 0.92);

  const reached = rival.ceiling * B.clamp(shape, 0, 1);
  return Math.max(0, Math.floor(reached));
}

/**
 * One rival, fully resolved for a moment in the season. `day` is passed rather
 * than read from the clock so the tests can walk a whole season without waiting
 * forty-five days for it.
 */
function buildRival(seed, index, day) {
  const rng = B.makeRng(seed + index * 2654435761);
  const archetype = ARCHETYPES[Math.floor(rng() * ARCHETYPES.length)];

  // The ceiling is what they would reach by the last day. Spread wide, because a
  // board where everyone finishes within ten stages of each other is not a board.
  const rank = index / RIVAL_COUNT;
  const ceiling = Math.floor((6 + Math.pow(1 - rank, 2.1) * 320) * archetype.pace * (0.85 + rng() * 0.3));

  const rival = { id: `r${index}`, name: rivalName(rng), archetype, ceiling };
  const depth = depthOnDay(rival, day);
  const stage = B.splitLevel(depth).stage;

  // Gear tracks their depth the way the player's does: the rungs a boss at that
  // depth could actually have dropped, not an arbitrary flourish.
  const tierCap = Math.min(MAX_TIER, Math.floor(stage / 2));
  const gear = SLOT_IDS.map((slot) => {
    const pool = GEAR.filter((g) => g.slot === slot && g.tier <= tierCap);
    if (!pool.length) return null;
    const def = pool[Math.floor(rng() * pool.length)];
    const tier = Math.max(def.tier, tierCap - Math.floor(rng() * 3));
    const stars = 1 + (rng() < 0.18 ? 1 : 0) + (rng() < 0.04 ? 1 : 0);
    return resolveItem({
      uid: `${rival.id}:${slot}`,
      id: def.id,
      tier: Math.min(MAX_TIER, tier),
      stars: Math.min(MAX_STARS, stars),
      forge: Math.min(15, Math.floor(stage * 0.7 * (0.7 + rng() * 0.6))),
    });
  }).filter(Boolean);

  return {
    ...rival,
    depth,
    stage,
    rebirths: Math.floor(Math.pow(stage / 7, 1.25)),
    passLevel: passLevel(Math.floor(day * 260 * archetype.pace * (0.8 + rng() * 0.5))),
    premium: rng() < 0.24,
    gear,
    power: Math.round(gear.reduce((a, g) => a + g.score, 0)),
    you: false,
  };
}

/** What the board sorts on. Depth first, because depth is what the game is. */
export function rivalScore(entry) {
  return entry.depth * 1e6 + entry.rebirths * 1e3 + Math.min(999, entry.passLevel);
}

/** The player as a board entry, so they rank by exactly the same function. */
export function playerEntry(state, now = Date.now()) {
  const depth = state.combat?.bestDepth || 0;
  const gear = SLOT_IDS.map((slot) => {
    const uid = state.combat?.equipped?.[slot];
    if (!uid) return null;
    return resolveItem((state.combat.inventory || []).find((i) => i.uid === uid));
  }).filter(Boolean);

  return {
    id: 'you',
    name: 'You',
    archetype: null,
    depth,
    stage: B.splitLevel(depth).stage,
    rebirths: state.rebirthCount || 0,
    passLevel: passLevel(state.pass?.xp || 0),
    premium: !!state.pass?.premium,
    gear,
    power: Math.round(gear.reduce((a, g) => a + g.score, 0)),
    you: true,
  };
}

/**
 * Just the rivals, which is the expensive half — sixty loadouts is a few hundred
 * resolveItem() calls. They only move when the day turns, so this is split out
 * for the caller to cache against `season.day`.
 */
export function rivalsFor(now = Date.now()) {
  const info = seasonAt(now);
  const seed = (info.index + 1) * 97_003;
  const rows = [];
  for (let i = 0; i < RIVAL_COUNT; i++) rows.push(buildRival(seed, i, info.day));
  return { season: info, rows };
}

/**
 * Rank a set of entries. 1-based and dense: two entries on the same score share
 * a rank, and the next one down skips accordingly.
 */
export function rank(rows) {
  const sorted = [...rows].sort((a, b) => rivalScore(b) - rivalScore(a) || a.name.localeCompare(b.name));

  let current = 0;
  let lastScore = null;
  sorted.forEach((row, i) => {
    const score = rivalScore(row);
    if (score !== lastScore) {
      current = i + 1;
      lastScore = score;
    }
    row.rank = current;
  });
  return sorted;
}

/**
 * The whole board for a moment, the player included and ranked among them.
 * `rivals` can be passed in from a cache; without it they are built fresh.
 */
export function leaderboard(state, now = Date.now(), cached = null) {
  const { season, rows } = cached || rivalsFor(now);
  const all = rank([...rows, playerEntry(state, now)]);
  return { season, rows: all, you: all.find((r) => r.you) };
}

/** Where the player sits, without building the whole board twice. */
export function playerRank(state, now = Date.now(), cached = null) {
  return leaderboard(state, now, cached).you;
}
