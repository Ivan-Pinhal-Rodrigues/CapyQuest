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

/**
 * What ascending costs, and why it costs more than it did.
 *
 * The gate was 5,000 lifetime essence and nothing else, which a player reached
 * by pressing Rebirth enough times — the count, not the depth. Ascension is the
 * *second* reset and it takes the tree, so arriving at it by repetition made it
 * the cheapest thing in the game to reach and the least interesting to reach.
 *
 * Three times the essence, and a rebirth count as well: you have to have
 * actually run the loop, not merely accumulated from it.
 *
 * The rebirth count was raised from 8 to 14 in the difficulty pass that added
 * TIMEOUT_DEBUFF_MULT and the essence bands below — a pure count gate,
 * chosen because it cannot move the combat wall itself (unlike BOSS_HP_MULT,
 * measured and rejected in the same pass: it scales every boss's HP at once,
 * and the normal-player fixture in tests/stages.test.js already sits close
 * enough to the thirty-second line at stage 3 and 5 that any increase flips
 * one of *those* into the first wall before stage 7 — the one actually meant
 * to be the wall — gets meaningfully harder). Fourteen is the most direct way
 * to make "really use both rebirth and ascend" true by construction: it takes
 * meaningfully more rebirth cycles before ascend is even reachable.
 */
/**
 * ASCEND_MIN_ESSENCE itself was flagged for reconsideration in the same
 * pass — the new banded payout curve (essenceBandMult() in balance.js) pays
 * substantially more at deep stages, so leaving this where it was could have
 * made ascend easier to reach despite the rest of the pass raising the bar.
 * Measured instead of assumed, with a real multi-rebirth simulation
 * (tests/rebirthSim.test.js, built for exactly this): across fourteen
 * rebirths — the new ASCEND_MIN_REBIRTHS — lifetime essence lands anywhere
 * from about 6,600 (a player who never gets past the measured wall) to about
 * 16,000 (one who pushes a couple of stages deeper every couple of cycles).
 * 15,000 sits inside that real range rather than trivially below or above
 * it, so it stays.
 */
export const ASCEND_MIN_ESSENCE = 15000;
export const ASCEND_MIN_REBIRTHS = 14;

/** Depth per ascension you keep, and the most you can ever bank. */
export const FLOOR_PER_ASCENSION = 12;
export const FLOOR_MAX = 120;

/**
 * Lotus awarded for ascending, from lifetime essence.
 *
 * Rebased on the new gate and paying roughly double the old curve at every
 * point — three at the gate rather than one, a hundred and fifty at two million
 * rather than sixty-six. A harder button that paid the same would just be a
 * worse button.
 */
export function lotusFromEssence(lifetimeEssence) {
  if (lifetimeEssence < ASCEND_MIN_ESSENCE) return 0;
  return Math.floor(3 * Math.pow(lifetimeEssence / ASCEND_MIN_ESSENCE, 0.8));
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
  const rebirths = state.rebirthCount || 0;
  const rebirthsShort = Math.max(0, ASCEND_MIN_REBIRTHS - rebirths);
  return {
    lotus,
    fromEssence,
    fromDepth,
    rebirths,
    rebirthsShort,
    canAscend: state.lifetimeEssence >= ASCEND_MIN_ESSENCE && rebirthsShort === 0 && lotus > 0,
    needed: Math.max(0, ASCEND_MIN_ESSENCE - state.lifetimeEssence),
    // Where the *next* run will begin, which is the number that tells a player
    // this ascension is not the last one over again.
    floor: Math.min(FLOOR_MAX, ((state.ascendCount || 0) + 1) * FLOOR_PER_ASCENSION),
  };
}

export function ascend(state, now = Date.now()) {
  const preview = ascendPreview(state);
  if (!preview.canAscend) {
    return { ok: false, reason: preview.rebirthsShort > 0 ? 'rebirths' : 'tooSoon', preview };
  }

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

  // Ascension takes your rebirths — that is the price, and it is now a stated
  // one. The count still has to be recoverable afterwards, or "how many times
  // have you gone round" becomes unanswerable the moment you go round once.
  state.stats.lifetimeRebirths = (state.stats.lifetimeRebirths || 0) + (state.rebirthCount || 0);

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
    // Same gap this file's own comment two lines below already promised was
    // closed: leafs and cosmetics are a collection like any other, and were
    // silently resetting on ascend the same way they were on rebirth.
    leafs: state.leafs,
    lifetimeLeafs: state.lifetimeLeafs,
    cosmetics: state.cosmetics,
    cases: state.cases,
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
    // The crew's gear is a collection, and a reset never costs a collection.
    // It lives outside `gacha` so it needs listing here explicitly — exactly
    // the case the rebuild-from-createState discipline exists to catch.
    companionGear: state.companionGear,
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
