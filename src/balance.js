// Every number that decides how the game feels lives here.
// Pure functions, no imports, no state — so tests/balance.test.js can hammer them.

export const COST_GROWTH = 1.15; // classic idle-game curve
export const CRIT_CHANCE_CAP = 0.75;
export const COMBO_DECAY_MS = 2400; // grace period between clicks before combo drops
export const COMBO_STEP = 0.02; // each combo point adds 2% click power
export const COMBO_BASE_CAP = 25; // combo points before upgrades
export const OFFLINE_CAP_MS = 12 * 60 * 60 * 1000; // 12h of nap credit
export const OFFLINE_RATE = 0.6; // offline earns 60% of online ZPS

// ---------------------------------------------------------------- generators

/** Cost of the next single unit of a generator you already own `owned` of. */
export function buildingCost(baseCost, owned, discount = 1) {
  return baseCost * Math.pow(COST_GROWTH, owned) * discount;
}

/**
 * Total cost of buying `count` more units, as a geometric series.
 * base*r^owned * (r^count - 1) / (r - 1)
 */
export function buildingBulkCost(baseCost, owned, count, discount = 1) {
  if (count <= 0) return 0;
  const r = COST_GROWTH;
  const first = baseCost * Math.pow(r, owned) * discount;
  return (first * (Math.pow(r, count) - 1)) / (r - 1);
}

/**
 * How many units `zen` can afford, by inverting the bulk-cost series.
 * Returns a non-negative integer, capped by `limit`.
 */
export function buildingMaxAffordable(baseCost, owned, zen, discount = 1, limit = 1e6) {
  if (zen <= 0) return 0;
  const r = COST_GROWTH;
  const first = baseCost * Math.pow(r, owned) * discount;
  if (zen < first) return 0;
  const n = Math.log((zen * (r - 1)) / first + 1) / Math.log(r);
  const count = Math.min(Math.floor(n + 1e-9), limit);
  return Math.max(0, count);
}

/** Zen-per-second contributed by one generator line. */
export function buildingOutput(baseRate, owned, multiplier = 1) {
  return baseRate * owned * multiplier;
}

// -------------------------------------------------------------------- clicks

/**
 * Zen earned by a single tap.
 * flat adds land first, then every multiplicative source stacks on top.
 */
export function clickPower({
  base = 1,
  flat = 0,
  mult = 1,
  comboMult = 1,
  buffMult = 1,
  zps = 0,
  zpsShare = 0,
} = {}) {
  const raw = (base + flat) * mult;
  return (raw + zps * zpsShare) * comboMult * buffMult;
}

/** Combo points -> click multiplier. */
export function comboMultiplier(comboPoints, step = COMBO_STEP) {
  return 1 + Math.max(0, comboPoints) * step;
}

/** Combo points are capped, and upgrades raise the ceiling. */
export function comboCap(bonus = 0) {
  return COMBO_BASE_CAP + bonus;
}

/**
 * Combo decays once you stop clicking. Returns the surviving point total.
 * Past the grace window it bleeds ~1 point per 200ms so it feels like a timer,
 * not a cliff.
 */
export function decayCombo(points, msSinceLastClick, graceMs = COMBO_DECAY_MS) {
  if (points <= 0) return 0;
  if (msSinceLastClick <= graceMs) return points;
  const lost = Math.floor((msSinceLastClick - graceMs) / 200);
  return Math.max(0, points - lost);
}

/** Crit chance never reaches certainty — keeps the surprise alive. */
export function critChance(raw) {
  return Math.min(CRIT_CHANCE_CAP, Math.max(0, raw));
}

/** Crit damage multiplier, from a base of 2x plus upgrade bonuses. */
export function critMultiplier(bonus = 0) {
  return 2 + Math.max(0, bonus);
}

// ------------------------------------------------------------------- offline

/**
 * Nap Report: what accrued while the tab was closed.
 * Capped in duration and paid at a reduced rate, both raised by relics.
 */
export function offlineEarnings(zps, elapsedMs, { capMs = OFFLINE_CAP_MS, rate = OFFLINE_RATE } = {}) {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0 || zps <= 0) {
    return { zen: 0, creditedMs: 0, cappedMs: 0 };
  }
  const creditedMs = Math.min(elapsedMs, capMs);
  return {
    zen: (zps * rate * creditedMs) / 1000,
    creditedMs,
    cappedMs: Math.max(0, elapsedMs - creditedMs),
  };
}

// ------------------------------------------------------------------- rebirth

// The payout itself lives further down with the stage maths, because it is
// measured in stages — see essenceFromStage(). v1's zen-derived prestige payout
// is gone: paying off currency rewarded the wrong thing, since it is the boss
// HP curve and not the coin curve that ends a run.

/**
 * Lifetime rebirth currency is a permanent global boost. Measured on *lifetime*
 * essence rather than the balance in hand, so spending it on the tree can never
 * make you weaker — otherwise the tree would be a trap.
 */
export function essenceBonus(lifetime, per = 0.02) {
  return 1 + Math.max(0, lifetime) * per;
}

// -------------------------------------------------------------------- combat

// Progression is deliberately lumpy: the ten levels inside a stage are a gentle
// ramp, and crossing into the next stage is a jump you feel. That is what makes
// a *stage* the unit of difficulty rather than a level.
//
//   across a stage's 10 levels   LEVEL_GROWTH^9  = ×1.14   (barely felt)
//   crossing into the next stage STAGE_GROWTH/that = ×1.92   (felt hard)
//   net per stage                STAGE_GROWTH     = ×2.2
//
// Almost all of the difficulty lives in the boundary. Clearing level 7 of a
// stage should feel like clearing level 6; arriving at the next stage should
// not. The magnitude is set by where the first rebirth wall has to land —
// see tests/stages.test.js, which simulates a normal player and asserts it.
export const LEVELS_PER_STAGE = 10;
export const STAGE_GROWTH = 2.2;
export const LEVEL_GROWTH = 1.015;
export const ATK_STAGE_GROWTH = 1.75;
export const ATK_LEVEL_GROWTH = 1.012;

/** The last level of every stage is a boss. */
export const BOSS_LEVEL = LEVELS_PER_STAGE - 1;
export const BOSS_HP_MULT = 10;
export const BOSS_ATK_MULT = 1.8;
export const BOSS_REWARD_MULT = 8;

/** Seconds a boss may take before the run counts as walled. */
export const WALL_SECONDS = 30;

export function isBossLevel(level) {
  return level === BOSS_LEVEL;
}

/** Split an absolute level number into { stage, level }. */
export function splitLevel(absolute) {
  const n = Math.max(0, Math.floor(absolute));
  return { stage: Math.floor(n / LEVELS_PER_STAGE), level: n % LEVELS_PER_STAGE };
}

export function absoluteLevel(stage, level) {
  return Math.max(0, stage) * LEVELS_PER_STAGE + Math.max(0, level);
}

/**
 * Ceiling for any generated quantity.
 *
 * Stages are unbounded, but 64-bit floats are not: 5^441 already exceeds
 * Number.MAX_VALUE, and past that every stat becomes Infinity and every
 * downstream calculation becomes NaN. Clamping keeps the game *running* at any
 * depth — around stage 430 the curve simply becomes an asymptote, which is far
 * beyond anywhere a player can reach and infinitely better than a broken save.
 */
export const VALUE_CEILING = 1e300;

function capped(value) {
  return Number.isFinite(value) ? Math.min(value, VALUE_CEILING) : VALUE_CEILING;
}

/** Enemy HP at a stage/level. No last stage — see VALUE_CEILING. */
export function enemyHp(stage, level = 0, isBoss = isBossLevel(level)) {
  const s = Math.max(0, stage);
  const l = Math.max(0, level);
  return capped(8 * Math.pow(STAGE_GROWTH, s) * Math.pow(LEVEL_GROWTH, l) * (isBoss ? BOSS_HP_MULT : 1));
}

/** Enemy attack. Grows more slowly than HP so fights get longer, not deadlier. */
export function enemyAtk(stage, level = 0, isBoss = isBossLevel(level)) {
  const s = Math.max(0, stage);
  const l = Math.max(0, level);
  return capped(4 * Math.pow(ATK_STAGE_GROWTH, s) * Math.pow(ATK_LEVEL_GROWTH, l) * (isBoss ? BOSS_ATK_MULT : 1));
}

/** Enemy defence. Kept well under HP growth so gear stays the answer, not a wall. */
export function enemyDef(stage, level = 0) {
  return capped(2 * Math.pow(1.35, Math.max(0, stage)) * Math.pow(1.04, Math.max(0, level)));
}

/** Zen dropped by clearing a level. */
export function enemyReward(stage, level = 0, isBoss = isBossLevel(level)) {
  const s = Math.max(0, stage);
  const l = Math.max(0, level);
  return capped(10 * Math.pow(2.5, s) * Math.pow(1.05, l) * (isBoss ? BOSS_REWARD_MULT : 1));
}

/**
 * How long the boss of a stage would take to kill at a given damage-per-second.
 * Infinity when the player does no damage at all.
 */
export function timeToKillBoss(stage, dps) {
  if (!(dps > 0)) return Infinity;
  return enemyHp(stage, BOSS_LEVEL, true) / dps;
}

/**
 * The rebirth wall: the boss of this stage cannot be finished inside
 * WALL_SECONDS. This is the signal that the run is over, rather than an
 * arbitrary currency threshold.
 */
export function isWalled(stage, dps, seconds = WALL_SECONDS) {
  return timeToKillBoss(stage, dps) > seconds;
}

/** Essence paid by a rebirth, scaling off the deepest stage reached. */
export function essenceFromStage(deepestStage, bonusMult = 1) {
  const s = Math.max(0, deepestStage);
  if (s <= 0) return 0;
  return Math.floor(12 * Math.pow(s, 1.45) * bonusMult);
}

/** Deepest stage needed to reach a given essence payout — for the "next at" hint. */
export function stageForEssence(targetEssence, bonusMult = 1) {
  if (targetEssence <= 0) return 0;
  return Math.pow(targetEssence / (12 * bonusMult), 1 / 1.45);
}

/** Elemental triangle: 1.5x strong, 0.75x weak, 1x neutral. */
export function elementModifier(attacker, defender, chart) {
  if (!attacker || !defender) return 1;
  if (chart?.[attacker]?.strong === defender) return 1.5;
  if (chart?.[attacker]?.weak === defender) return 0.75;
  return 1;
}

/** Damage of one attack. DEF is a soft reduction, never a full block. */
export function damage({ atk, def = 0, crit = false, critMult = 2, element = 1 }) {
  const mitigated = atk * (100 / (100 + Math.max(0, def)));
  return Math.max(1, mitigated * (crit ? critMult : 1) * element);
}

// Levels cost exponentially more, not polynomially more.
//
// XP *awarded* grows exponentially with stage (there is no other way to keep a
// reward meaningful at depth). If XP *required* grew polynomially, levels would
// run away — a v1 curve produced level 80,000 by stage 19. Matching the two
// exponentials makes levels advance at a steady handful per stage forever.
export const XP_BASE = 50;
export const XP_GROWTH = 1.105;

/** Level from accumulated XP. */
export function levelFromXp(xp) {
  if (!(xp > 0)) return 1;
  const n = Math.log(1 + (xp * (XP_GROWTH - 1)) / XP_BASE) / Math.log(XP_GROWTH);
  return Math.floor(n) + 1;
}

/** Total XP needed to reach a level. */
export function xpForLevel(level) {
  if (level <= 1) return 0;
  return Math.ceil((XP_BASE * (Math.pow(XP_GROWTH, level - 1) - 1)) / (XP_GROWTH - 1));
}

// ---------------------------------------------------------------------- gear

/** Cost in shards to take a piece from `level` to `level+1`. */
export function forgeCost(level, rarityMult = 1) {
  return Math.ceil(8 * Math.pow(1.55, level) * rarityMult);
}

/** Stat multiplier from enhancement level (+0 .. +15). */
export function forgeMultiplier(level) {
  return 1 + Math.max(0, level) * 0.12;
}

// --------------------------------------------------------------------- gacha

export const PITY_SOFT = 65;
export const PITY_HARD = 80;

/**
 * 5-star chance for a given pity count. Flat until soft pity, then ramps hard
 * so the counter visibly "heats up" — the part that makes pulling feel fair.
 */
export function fiveStarChance(pity) {
  if (pity >= PITY_HARD - 1) return 1;
  if (pity < PITY_SOFT) return 0.006;
  return Math.min(1, 0.006 + (pity - PITY_SOFT + 1) * 0.06);
}

// ------------------------------------------------------------------- helpers

/** Clamp a value into [min, max]. */
export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/** Deterministic PRNG (mulberry32) so seeded rolls are reproducible in tests. */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Weighted pick from [{ weight, ... }] using a 0..1 roll. */
export function weightedPick(entries, roll) {
  const total = entries.reduce((sum, e) => sum + (e.weight || 0), 0);
  if (total <= 0) return null;
  let target = roll * total;
  for (const entry of entries) {
    target -= entry.weight || 0;
    if (target < 0) return entry;
  }
  return entries[entries.length - 1];
}
