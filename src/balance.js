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

// ------------------------------------------------------------------ prestige

/** Yuzu awarded for a prestige, from lifetime Zen this run. */
export function yuzuFromZen(lifetimeZen, bonusMult = 1) {
  if (lifetimeZen <= 0) return 0;
  return Math.floor(150 * Math.sqrt(lifetimeZen / 1e12) * bonusMult);
}

/** Zen needed to reach the next whole yuzu, for the "next at" hint. */
export function zenForYuzu(targetYuzu, bonusMult = 1) {
  if (targetYuzu <= 0) return 0;
  return Math.pow(targetYuzu / (150 * bonusMult), 2) * 1e12;
}

/** Each yuzu held gives a permanent global boost. */
export function yuzuBonus(yuzu, perYuzu = 0.02) {
  return 1 + Math.max(0, yuzu) * perYuzu;
}

// -------------------------------------------------------------------- combat

/** Enemy HP scales exponentially with stage; bosses are a hard wall. */
export function enemyHp(stage, isBoss = false) {
  return 12 * Math.pow(1.16, Math.max(0, stage)) * (isBoss ? 8 : 1);
}

/** Zen dropped by clearing a stage. */
export function enemyReward(stage, isBoss = false) {
  return 8 * Math.pow(1.15, Math.max(0, stage)) * (isBoss ? 12 : 1);
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

/** Level from accumulated XP: each level costs progressively more. */
export function levelFromXp(xp) {
  if (xp <= 0) return 1;
  return Math.floor(Math.pow(xp / 50, 1 / 1.6)) + 1;
}

/** Total XP needed to reach a level. */
export function xpForLevel(level) {
  if (level <= 1) return 0;
  return Math.ceil(50 * Math.pow(level - 1, 1.6));
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
