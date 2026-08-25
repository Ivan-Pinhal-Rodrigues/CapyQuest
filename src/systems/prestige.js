// Two reset layers.
//
// Prestige (the Yuzu Bath) wipes zen, generators and upgrades, and pays Yuzu
// based on the run's lifetime zen. Relics, achievements, the whole RPG side and
// the companion roster all survive.
//
// Ascension (the Still Point) wipes everything prestige wipes *plus* yuzu and
// relics, and pays Lotus. Constellations, achievements and companions survive.
//
// The rule that keeps this honest: a reset must never cost you a collection.
// Losing an hour of income is a decision; losing a 5★ you pulled is a betrayal.

import * as B from '../balance.js';
import { createState } from '../state.js';
import { RELICS_BY_ID, CONSTELLATIONS_BY_ID, rankCost } from '../data/relics.js';

export const PRESTIGE_MIN_ZEN = 1e12; // one trillion — the first yuzu
export const ASCEND_MIN_YUZU = 5000;

/** Multiplier on prestige payout from relics and constellations. */
export function yuzuGainMult(state) {
  let mult = 1;
  for (const [id, ranks] of Object.entries(state.relics || {})) {
    const def = RELICS_BY_ID[id];
    if (def?.effect.type === 'yuzuGain') mult += def.effect.value * ranks;
  }
  for (const [id, ranks] of Object.entries(state.constellations || {})) {
    const def = CONSTELLATIONS_BY_ID[id];
    if (def?.effect.type === 'yuzuGain') mult += def.effect.value * ranks;
  }
  return mult;
}

/** What a prestige right now would pay. */
export function prestigePreview(state) {
  const mult = yuzuGainMult(state);
  const yuzu = B.yuzuFromZen(state.lifetimeZen, mult);
  const nextAt = B.zenForYuzu(yuzu + 1, mult);
  return {
    yuzu,
    mult,
    nextAt,
    toNext: Math.max(0, nextAt - state.lifetimeZen),
    canPrestige: state.lifetimeZen >= PRESTIGE_MIN_ZEN && yuzu > 0,
  };
}

/**
 * Perform a prestige. Mutates and returns the state so the caller can swap it
 * in wholesale — building the fresh half from createState() means a field added
 * later is reset automatically instead of being silently carried over.
 */
export function prestige(state, now = Date.now()) {
  const preview = prestigePreview(state);
  if (!preview.canPrestige) return { ok: false, reason: 'tooSoon' };

  const fresh = createState(now);

  // Everything below is explicitly carried across the reset. Anything not
  // listed here goes back to its starting value.
  const kept = {
    createdAt: state.createdAt,
    totalZen: state.totalZen,
    lifetimeClicks: state.lifetimeClicks,
    yuzu: state.yuzu + preview.yuzu,
    lifetimeYuzu: state.lifetimeYuzu + preview.yuzu,
    lotus: state.lotus,
    lifetimeLotus: state.lifetimeLotus,
    prestigeCount: state.prestigeCount + 1,
    ascendCount: state.ascendCount,
    achievements: state.achievements,
    relics: state.relics,
    constellations: state.constellations,
    stats: state.stats,
    settings: state.settings,
    // Retention state is keyed to the calendar, not to progression. Wiping a
    // login streak or a half-finished daily because the player prestiged would
    // punish them for playing well.
    quests: state.quests,
    login: state.login,
    chest: state.chest,
    pass: state.pass,
    codes: state.codes,
    combat: state.combat,
    gacha: state.gacha,
    talents: state.talents,
  };

  Object.assign(fresh, kept);
  fresh.stats.prestiges = (fresh.stats.prestiges || 0) + 1;
  Object.assign(state, fresh);

  return { ok: true, gained: preview.yuzu, total: state.yuzu };
}

/** Lotus awarded for ascending, from lifetime yuzu. */
export function lotusFromYuzu(lifetimeYuzu) {
  if (lifetimeYuzu < ASCEND_MIN_YUZU) return 0;
  return Math.floor(Math.pow(lifetimeYuzu / ASCEND_MIN_YUZU, 0.7));
}

export function ascendPreview(state) {
  const lotus = lotusFromYuzu(state.lifetimeYuzu);
  return {
    lotus,
    canAscend: state.lifetimeYuzu >= ASCEND_MIN_YUZU && lotus > 0,
    needed: Math.max(0, ASCEND_MIN_YUZU - state.lifetimeYuzu),
  };
}

export function ascend(state, now = Date.now()) {
  const preview = ascendPreview(state);
  if (!preview.canAscend) return { ok: false, reason: 'tooSoon' };

  const fresh = createState(now);

  // Ascension takes the yuzu and the relics too. Collections still survive.
  const kept = {
    createdAt: state.createdAt,
    totalZen: state.totalZen,
    lifetimeClicks: state.lifetimeClicks,
    lotus: state.lotus + preview.lotus,
    lifetimeLotus: state.lifetimeLotus + preview.lotus,
    ascendCount: state.ascendCount + 1,
    achievements: state.achievements,
    constellations: state.constellations,
    stats: state.stats,
    settings: state.settings,
    // Retention state is keyed to the calendar, not to progression. Wiping a
    // login streak or a half-finished daily because the player prestiged would
    // punish them for playing well.
    quests: state.quests,
    login: state.login,
    chest: state.chest,
    pass: state.pass,
    codes: state.codes,
    gacha: state.gacha,
  };

  Object.assign(fresh, kept);
  fresh.stats.ascensions = (fresh.stats.ascensions || 0) + 1;
  Object.assign(state, fresh);

  return { ok: true, gained: preview.lotus, total: state.lotus };
}

// ------------------------------------------------------------------ buying

export function buyRelic(state, id) {
  return buyRank(state, id, RELICS_BY_ID, 'relics', 'yuzu');
}

export function buyConstellation(state, id) {
  return buyRank(state, id, CONSTELLATIONS_BY_ID, 'constellations', 'lotus');
}

function buyRank(state, id, table, bagKey, currency) {
  const def = table[id];
  if (!def) return { ok: false, reason: 'unknown' };

  const owned = state[bagKey][id] || 0;
  if (owned >= def.max) return { ok: false, reason: 'maxed' };

  const price = rankCost(def, owned);
  if (state[currency] < price) return { ok: false, reason: 'poor', price };

  state[currency] -= price;
  state[bagKey][id] = owned + 1;
  return { ok: true, price, ranks: owned + 1 };
}

export { rankCost };
