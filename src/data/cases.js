// Three cases. Not four, not a rotating carousel of twelve — three, so a player
// can hold all of them in their head and know what each one is for.
//
// Every case shows its full drop table before you open it. An unstated roll is
// a slot machine; a stated one is a decision, and the odds here are computed
// from the same weights the roll uses rather than typed in beside them, so the
// two can never drift apart.
//
//   floor / ceiling  the rungs this case can produce
//   guaranteed       nothing below this rung ever comes out
//   pity             opens without a top-half pull before one is forced
//   starBoost        extra rolls on the star ladder

import { MAX_TIER } from './rarities.js';

export const CASES = [
  {
    id: 'reed',
    name: 'Reed Case',
    cost: 100,
    floor: 1,
    ceiling: 8,
    guaranteed: 1,
    pity: 20,
    starBoost: 0,
    color: '#5fa348',
    blurb: 'What washes up. The one a day of playing can actually afford.',
  },
  {
    id: 'onsen',
    name: 'Onsen Case',
    cost: 320,
    floor: 4,
    ceiling: 14,
    guaranteed: 6,
    pity: 15,
    starBoost: 1,
    color: '#4d8fd9',
    blurb: 'Fished out of the hot pool. Never worse than Fine.',
  },
  {
    id: 'astral',
    name: 'Astral Case',
    cost: 900,
    floor: 9,
    ceiling: MAX_TIER,
    guaranteed: 12,
    pity: 10,
    starBoost: 2,
    color: '#8f7ce8',
    blurb: 'Something fell in the pond and it was not a leaf. Never worse than Ethereal.',
  },
];

export const CASES_BY_ID = Object.fromEntries(CASES.map((c) => [c.id, c]));

/** The rung a case's pity forces once the counter runs out. */
export function pityTier(def) {
  return Math.max(def.guaranteed, def.ceiling - 2);
}

/**
 * Weights across a case's rungs, steepening toward the top. Exported because
 * the panel renders the odds straight from this — the displayed table and the
 * roll read the same numbers.
 */
export function caseWeights(def) {
  const out = [];
  const low = Math.max(def.floor, def.guaranteed);
  for (let tier = low; tier <= def.ceiling; tier++) {
    out.push({ tier, weight: Math.pow(0.45, tier - low) });
  }
  return out;
}

/** The same weights as percentages, for the drop table on the case. */
export function caseOdds(def) {
  const weights = caseWeights(def);
  const total = weights.reduce((a, w) => a + w.weight, 0);
  return weights.map((w) => ({ tier: w.tier, chance: w.weight / total }));
}
