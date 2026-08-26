// Ascension — the second reset layer.
//
// It shipped working but thin: it took your Essence and the whole rebirth tree,
// paid Lotus, and Lotus bought twelve upgrades. Mechanically complete, and no
// reason to exist that Rebirth did not already provide. Three things fix that,
// and none of them is a bigger number.
//
//   PAID FOR GROUND COVERED. The payout was a function of lifetime Essence,
//   which is a function of how often you pressed Rebirth. It now also counts
//   the depth of every run you have ever made — so ascending rewards the thing
//   you actually did rather than the button you pressed afterwards.
//
//   A FLOOR. Each ascension leaves you starting deeper than the last, up to a
//   cap. Without it the second ascension is the first one again with better
//   multipliers, which is the definition of a treadmill.
//
//   A BOARD, NOT A QUEUE. The twelve constellations are grouped into four
//   figures of three; lighting a whole figure pays a bonus. See data/
//   constellations.js for why that is the difference between a decision and a
//   shopping list.
//
// Collections still survive, as they do everywhere: gear, companions and
// trophies are never the price of a button.

import { createState } from '../state.js';
import { collectCache } from './cache.js';
import { CONSTELLATIONS_BY_ID, FIGURES, isFigureLit, litFigures, rankCost } from '../data/constellations.js';

export const ASCEND_MIN_ESSENCE = 5000;

/** Depth per ascension you keep, and the most you can ever bank. */
export const FLOOR_PER_ASCENSION = 12;
export const FLOOR_MAX = 120;

/** Lotus awarded for ascending, from lifetime essence. */
export function lotusFromEssence(lifetimeEssence) {
  if (lifetimeEssence < ASCEND_MIN_ESSENCE) return 0;
  return Math.floor(Math.pow(lifetimeEssence / ASCEND_MIN_ESSENCE, 0.7));
}

/**
 * Lotus from ground covered — every level of every run, this one included.
 *
 * Sub-linear, like the essence half, so that a hundred shallow rebirths never
 * out-pays going deep. The two halves are added rather than multiplied: a
 * player who has done one of them well should still be able to ascend.
 */
export function lotusFromDepth(state) {
  const total = (state.stats?.totalDepth || 0) + (state.combat?.bestDepth || 0);
  if (total <= 0) return 0;
  return Math.floor(Math.pow(total / 60, 0.8));
}

/**
 * Where the next run starts.
 *
 * A flat restart makes every ascension the first one with bigger numbers. The
 * floor is capped, and deliberately well short of where an ascending player is
 * walled, so it removes the repetition without removing the run.
 */
export function depthFloor(state) {
  return Math.min(FLOOR_MAX, (state.ascendCount || 0) * FLOOR_PER_ASCENSION);
}

export function ascendPreview(state) {
  const fromEssence = lotusFromEssence(state.lifetimeEssence);
  const fromDepth = lotusFromDepth(state);
  const lotus = fromEssence + fromDepth;
  return {
    lotus,
    fromEssence,
    fromDepth,
    canAscend: state.lifetimeEssence >= ASCEND_MIN_ESSENCE && lotus > 0,
    needed: Math.max(0, ASCEND_MIN_ESSENCE - state.lifetimeEssence),
    // Where the *next* run will begin, which is the number that tells a player
    // this ascension is not the last one over again.
    floor: Math.min(FLOOR_MAX, ((state.ascendCount || 0) + 1) * FLOOR_PER_ASCENSION),
  };
}

export function ascend(state, now = Date.now()) {
  const preview = ascendPreview(state);
  if (!preview.canAscend) return { ok: false, reason: 'tooSoon' };

  // The tank holds zen, and zen does not survive this. Rather than let a full
  // cache evaporate unnoticed, it is banked first: the lifetime counters that
  // never reset get credit for it, so the time spent away still counted for
  // something even though the coins themselves do not carry over.
  const banked = collectCache(state);
  state.totalZen += banked.zen;

  // Bank this run's depth before it goes, the same as rebirth does — an
  // ascension straight after a long run must not lose the run.
  state.stats.totalDepth = (state.stats.totalDepth || 0) + (state.combat.bestDepth || 0);
  state.stats.deepestEver = Math.max(state.stats.deepestEver || 0, state.combat.bestDepth || 0);

  const floor = Math.min(FLOOR_MAX, (state.ascendCount + 1) * FLOOR_PER_ASCENSION);
  const fresh = createState(now);

  // Ascension takes the essence and the tree too. Collections still survive.
  const kept = {
    createdAt: state.createdAt,
    totalZen: state.totalZen,
    lifetimeClicks: state.lifetimeClicks,
    lotus: state.lotus + preview.lotus,
    lifetimeLotus: state.lifetimeLotus + preview.lotus,
    ascendCount: state.ascendCount + 1,
    // Having once seen the wall is knowledge, not progress — you do not have to
    // be walled a second time to be allowed to rebirth again.
    rebirthUnlocked: state.rebirthUnlocked,
    achievements: state.achievements,
    constellations: state.constellations,
    stats: state.stats,
    settings: state.settings,
    quests: state.quests,
    // The narrative layer is knowledge, not progress. Sitting through the
    // opening again after a reset would be unbearable, and your own name is
    // yours — neither is something a button should be able to take.
    story: state.story,
    profile: state.profile,
    login: state.login,
    chest: state.chest,
    pass: state.pass,
    codes: state.codes,
    gacha: state.gacha,
    // The kit stays; the run through the terrains starts over — but not from
    // nothing. Each ascension banks a little of the ground covered.
    combat: { ...state.combat, depth: floor, bestDepth: floor, xp: 0 },
  };

  Object.assign(fresh, kept);
  fresh.stats.ascensions = (fresh.stats.ascensions || 0) + 1;
  Object.assign(state, fresh);

  return { ok: true, gained: preview.lotus, total: state.lotus };
}

export function buyConstellation(state, id) {
  const def = CONSTELLATIONS_BY_ID[id];
  if (!def) return { ok: false, reason: 'unknown' };

  const owned = state.constellations[id] || 0;
  if (owned >= def.max) return { ok: false, reason: 'maxed' };

  const price = rankCost(def, owned);
  if (state.lotus < price) return { ok: false, reason: 'poor', price };

  state.lotus -= price;
  state.constellations[id] = owned + 1;
  return { ok: true, price, ranks: owned + 1 };
}

/**
 * Effects from lit figures, folded in alongside the individual star ranks.
 *
 * Kept here rather than in the data file because it reads state, and the data
 * files are deliberately free of it.
 */
export function figureEffects(state) {
  return litFigures(state).map((figure) => figure.effect);
}

/** Figures with their lit state, for the panel. */
export function figureStatus(state) {
  return FIGURES.map((figure) => ({
    ...figure,
    lit: isFigureLit(state, figure),
    owned: figure.stars.filter((id) => (state.constellations?.[id] || 0) > 0).length,
  }));
}

export { rankCost };
