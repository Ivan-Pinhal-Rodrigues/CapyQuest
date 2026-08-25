// Opening cases.
//
// A case is a leaf-priced roll on the rarity ladder, and it is the one place in
// the game where money — even simulated money — buys power directly. Two rules
// keep that honest, and both are enforced here rather than left to the panel:
//
//   the odds shown are the odds used   caseOdds() reads the same weights
//   pity is real and visible           a counter, not a feeling
//
// What comes out is an ordinary piece of gear. It goes into the same bag, it can
// be enhanced, refined, fused and scrapped like anything else, and a case can
// never produce something a boss could not eventually drop.

import * as B from '../balance.js';
import { GEAR } from '../data/gear.js';
import { CASES_BY_ID, caseWeights, pityTier } from '../data/cases.js';
import * as R from '../data/rarities.js';
import { addToInventory } from './loot.js';

/** This case's counters, created on first sight. */
export function caseState(state, id) {
  state.cases ??= {};
  state.cases[id] ??= { opened: 0, since: 0 };
  return state.cases[id];
}

/** Opens remaining before pity forces a good one. */
export function pityLeft(state, id) {
  const def = CASES_BY_ID[id];
  if (!def) return 0;
  return Math.max(0, def.pity - caseState(state, id).since);
}

export function canOpen(state, id) {
  const def = CASES_BY_ID[id];
  if (!def) return { ok: false, reason: 'unknown' };
  if ((state.leafs || 0) < def.cost) return { ok: false, reason: 'leafs', price: def.cost };
  return { ok: true, def };
}

/**
 * Open one case. Returns the created inventory entry alongside what it rolled,
 * so the caller can show the reveal without re-deriving any of it.
 */
export function openCase(state, id, rng = Math.random) {
  const check = canOpen(state, id);
  if (!check.ok) return check;

  const def = check.def;
  const counters = caseState(state, id);
  state.leafs -= def.cost;

  const forced = counters.since >= def.pity;
  const tier = forced
    ? pityTier(def)
    : Math.max(def.guaranteed, B.weightedPick(caseWeights(def), rng())?.tier ?? def.guaranteed);

  // A case's star boost is extra rolls on the same ladder a drop uses, not a
  // separate and better one — so the top of the star range stays equally rare
  // whichever way you got there.
  let stars = 1;
  for (let attempt = 0; attempt < 1 + def.starBoost; attempt++) {
    stars = Math.max(stars, rollCaseStars(rng));
  }

  // Pity resets on anything in the top half of the case's range.
  const good = tier >= def.ceiling - Math.floor((def.ceiling - def.guaranteed) / 2);
  counters.opened++;
  counters.since = good ? 0 : counters.since + 1;

  const pool = GEAR.filter((g) => g.tier <= tier);
  const picked = pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
  const entry = addToInventory(state, picked.id, { tier, stars });

  return {
    ok: true,
    def,
    entry,
    item: picked,
    tier,
    stars,
    pitied: forced,
    rarity: R.rarityFor(tier),
    spent: def.cost,
  };
}

function rollCaseStars(rng) {
  let stars = 1;
  for (let next = 2; next <= R.MAX_STARS; next++) {
    if (rng() >= 0.12 * Math.pow(0.45, next - 2)) break;
    stars = next;
  }
  return stars;
}
