// Ascension — the second reset layer, and openly unfinished.
//
// It works: reaching the Still Point takes your Essence and the whole rebirth
// tree, and pays Lotus, which buys constellations that no reset can touch. What
// it does not yet have is a *reason* — a layer of its own to play through, the
// way Rebirth has the tree. That is being built, and the panel says so rather
// than pretending otherwise.
//
// Collections still survive, as they do everywhere: gear, companions and
// trophies are never the price of a button.

import { createState } from '../state.js';
import { CONSTELLATIONS_BY_ID, rankCost } from '../data/constellations.js';

export const ASCEND_MIN_ESSENCE = 5000;

/** Lotus awarded for ascending, from lifetime essence. */
export function lotusFromEssence(lifetimeEssence) {
  if (lifetimeEssence < ASCEND_MIN_ESSENCE) return 0;
  return Math.floor(Math.pow(lifetimeEssence / ASCEND_MIN_ESSENCE, 0.7));
}

export function ascendPreview(state) {
  const lotus = lotusFromEssence(state.lifetimeEssence);
  return {
    lotus,
    canAscend: state.lifetimeEssence >= ASCEND_MIN_ESSENCE && lotus > 0,
    needed: Math.max(0, ASCEND_MIN_ESSENCE - state.lifetimeEssence),
  };
}

export function ascend(state, now = Date.now()) {
  const preview = ascendPreview(state);
  if (!preview.canAscend) return { ok: false, reason: 'tooSoon' };

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
    login: state.login,
    chest: state.chest,
    pass: state.pass,
    codes: state.codes,
    gacha: state.gacha,
    // The kit stays; the run through the terrains starts over.
    combat: { ...state.combat, depth: 0, bestDepth: 0, xp: 0 },
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
 * What is still missing, shown on the panel. Being specific about the gap is
 * more respectful than a vague "coming soon", and it keeps this list honest —
 * it has to be updated when a line of it ships.
 */
export const ASCENSION_ROADMAP = [
  'A Still Point map with its own stages, above the terrain ladder.',
  'Lotus-only gear that cannot drop anywhere else.',
  'Constellation links — bonuses for owning neighbours in the same figure.',
  'An endgame event, The Still Point Rift, that pays Lotus directly.',
];

export { rankCost };
