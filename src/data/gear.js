// 42 gear pieces across 6 slots.
//
// A definition is a *shape*, not a power level. `stats` here says how a piece
// spends its budget — atk-heavy, hp-heavy, crit-heavy — and the rung it is
// sitting on says how much budget there is to spend (see data/rarities.js).
// So two pieces on the same rung are worth the same and play differently, and
// any piece can be carried the whole way up the ladder.
//
// slot     hat | scarf | charm | sandal | rod | bucket
// tier     the rung a piece normally drops on, 0..19; the forge can raise it
// stats    proportions only — the absolute numbers are re-derived from the rung
// bonus    optional idle-game effect, in the systems/stats.js vocabulary

import * as B from '../balance.js';
import * as R from './rarities.js';

export const SLOTS = [
  { id: 'hat', name: 'Hat', shape: 'hat' },
  { id: 'scarf', name: 'Scarf', shape: 'scarf' },
  { id: 'charm', name: 'Charm', shape: 'charm' },
  { id: 'sandal', name: 'Sandal', shape: 'sandal' },
  { id: 'rod', name: 'Rod', shape: 'rod' },
  { id: 'bucket', name: 'Bucket', shape: 'bucket' },
];

export const SLOT_IDS = SLOTS.map((s) => s.id);

export const GEAR = [
  // ------------------------------------------------------------------ hats
  { id: 'strawHat', name: 'Straw Hat', slot: 'hat', tier: 0, stats: { atk: 3, hp: 12 }, blurb: 'Keeps the sun off. Mostly.' },
  { id: 'lilyCrown', name: 'Lily Crown', slot: 'hat', tier: 2, stats: { atk: 7, hp: 26, luck: 2 }, blurb: 'Worn by whoever naps in the middle.' },
  { id: 'bambooHelm', name: 'Bamboo Helm', slot: 'hat', tier: 4, stats: { atk: 14, def: 12, hp: 55 }, blurb: 'Surprisingly good at its job.' },
  { id: 'towelTurban', name: 'Towel Turban', slot: 'hat', tier: 4, stats: { hp: 90, def: 8 }, bonus: { type: 'zpsMult', value: 1.05 }, blurb: 'Straight from the hot cabinet.' },
  { id: 'moonCirclet', name: 'Moon Circlet', slot: 'hat', tier: 7, stats: { atk: 30, crit: 0.05, luck: 6 }, blurb: 'Only visible at certain angles.' },
  { id: 'geodeCrown', name: 'Geode Crown', slot: 'hat', tier: 10, stats: { atk: 58, def: 40, hp: 210 }, bonus: { type: 'globalMult', value: 1.08 }, blurb: 'Hums the note the springs hum back.' },
  { id: 'sunDiadem', name: 'Sun Diadem', slot: 'hat', tier: 13, stats: { atk: 110, crit: 0.1, critDmg: 0.5 }, bonus: { type: 'clickMult', value: 1.25 }, blurb: 'Forged where the light gets made.' },

  // ---------------------------------------------------------------- scarves
  { id: 'ragScarf', name: 'Rag Scarf', slot: 'scarf', tier: 0, stats: { def: 4, hp: 15 }, blurb: 'It was a towel once.' },
  { id: 'reedWrap', name: 'Reed Wrap', slot: 'scarf', tier: 2, stats: { def: 9, hp: 32, spd: 2 }, blurb: 'Woven tight enough to keep the wind out.' },
  { id: 'steamShawl', name: 'Steam Shawl', slot: 'scarf', tier: 4, stats: { def: 18, hp: 68 }, bonus: { type: 'zpsMult', value: 1.06 }, blurb: 'Permanently, pleasantly damp.' },
  { id: 'marketSilk', name: 'Market Silk', slot: 'scarf', tier: 7, stats: { def: 34, hp: 130, luck: 8 }, bonus: { type: 'costDiscount', value: 0.03 }, blurb: 'Cost more than it should have.' },
  { id: 'tidalMantle', name: 'Tidal Mantle', slot: 'scarf', tier: 7, stats: { def: 42, hp: 155, spd: 5 }, blurb: 'Moves a half-second before you do.' },
  { id: 'dreamStole', name: 'Dream Stole', slot: 'scarf', tier: 10, stats: { def: 70, hp: 260, luck: 14 }, bonus: { type: 'offlineRate', value: 0.06 }, blurb: 'Works best while you are elsewhere.' },
  { id: 'voidCollar', name: 'Void Collar', slot: 'scarf', tier: 13, stats: { def: 128, hp: 480, crit: 0.06 }, bonus: { type: 'globalMult', value: 1.15 }, blurb: 'Nothing gets through. Nothing at all.' },

  // ----------------------------------------------------------------- charms
  { id: 'riverPebble', name: 'River Pebble', slot: 'charm', tier: 0, stats: { luck: 3, crit: 0.01 }, blurb: 'Smooth. Reassuring. Free.' },
  { id: 'yuzuCharm', name: 'Yuzu Charm', slot: 'charm', tier: 2, stats: { luck: 6, crit: 0.02 }, bonus: { type: 'goldenChance', value: 0.06 }, blurb: 'Smells faintly of citrus forever.' },
  { id: 'luckyWhiskerCharm', name: 'Lucky Whisker', slot: 'charm', tier: 4, stats: { luck: 12, crit: 0.04, critDmg: 0.2 }, blurb: 'Came off on its own. Allegedly.' },
  { id: 'emberSeal', name: 'Ember Seal', slot: 'charm', tier: 4, stats: { atk: 22, crit: 0.03 }, blurb: 'Still warm from something.' },
  { id: 'moonMirror', name: 'Moon Mirror', slot: 'charm', tier: 7, stats: { luck: 22, crit: 0.07, critDmg: 0.4 }, bonus: { type: 'critChance', value: 0.03 }, blurb: 'The reflection blinks a beat late.' },
  { id: 'shardHeart', name: 'Shard Heart', slot: 'charm', tier: 10, stats: { atk: 62, crit: 0.1, critDmg: 0.8, luck: 30 }, blurb: 'It beats. Nobody has asked why.' },
  { id: 'stillPoint', name: 'The Still Point', slot: 'charm', tier: 16, stats: { atk: 160, crit: 0.15, critDmg: 1.5, luck: 60 }, bonus: { type: 'globalMult', value: 1.3 }, blurb: 'The calm centre of an enormous amount of nothing.' },

  // ---------------------------------------------------------------- sandals
  { id: 'mudSandals', name: 'Mud Sandals', slot: 'sandal', tier: 0, stats: { spd: 3, hp: 10 }, blurb: 'Squelch with every step.' },
  { id: 'reedTreads', name: 'Reed Treads', slot: 'sandal', tier: 2, stats: { spd: 7, def: 6 }, blurb: 'Grip the bank properly.' },
  { id: 'springSoles', name: 'Spring Soles', slot: 'sandal', tier: 4, stats: { spd: 14, hp: 48 }, bonus: { type: 'clickMult', value: 1.08 }, blurb: 'Every step is a small bounce.' },
  { id: 'cloudWalkers', name: 'Cloud Walkers', slot: 'sandal', tier: 7, stats: { spd: 28, def: 24, luck: 10 }, blurb: 'Rated for altitude. Not rated for landing.' },
  { id: 'tideSteppers', name: 'Tide Steppers', slot: 'sandal', tier: 7, stats: { spd: 33, atk: 26 }, blurb: 'Walk on it, not through it.' },
  { id: 'dreamStriders', name: 'Dream Striders', slot: 'sandal', tier: 10, stats: { spd: 56, hp: 200, luck: 20 }, bonus: { type: 'offlineCapHours', value: 3 }, blurb: 'Cover a lot of ground while stationary.' },
  { id: 'chonkTreads', name: 'Chonk Treads', slot: 'sandal', tier: 13, stats: { spd: 96, def: 90, hp: 420 }, bonus: { type: 'zpsMult', value: 1.2 }, blurb: 'Leave prints in stone.' },

  // ------------------------------------------------------------------- rods
  { id: 'stickRod', name: 'Just A Stick', slot: 'rod', tier: 0, stats: { atk: 6 }, blurb: 'It is, in fairness, a very good stick.' },
  { id: 'bambooRod', name: 'Bamboo Rod', slot: 'rod', tier: 2, stats: { atk: 13, crit: 0.01 }, blurb: 'Flexible where it counts.' },
  { id: 'snapperClaw', name: 'Snapper Claw', slot: 'rod', tier: 4, stats: { atk: 27, crit: 0.03 }, blurb: 'Still opens and closes. Do not test it.' },
  { id: 'emberBrand', name: 'Ember Brand', slot: 'rod', tier: 4, stats: { atk: 32, critDmg: 0.3 }, blurb: 'Lights the room. Ruins the mood.' },
  { id: 'tideBreaker', name: 'Tide Breaker', slot: 'rod', tier: 7, stats: { atk: 58, crit: 0.05, spd: 8 }, blurb: 'Parts water on the backswing.' },
  { id: 'moonlitStaff', name: 'Moonlit Staff', slot: 'rod', tier: 7, stats: { atk: 64, critDmg: 0.5, luck: 12 }, bonus: { type: 'clickMult', value: 1.15 }, blurb: 'Only works when someone is watching.' },
  { id: 'sunforgeHammer', name: 'Sunforge Hammer', slot: 'rod', tier: 10, stats: { atk: 120, crit: 0.08, critDmg: 0.9 }, blurb: 'Heavier than the arm holding it.' },
  { id: 'theLongNap', name: 'The Long Nap', slot: 'rod', tier: 16, stats: { atk: 260, crit: 0.16, critDmg: 1.8, spd: 30 }, bonus: { type: 'clickMult', value: 1.6 }, blurb: 'Ends fights by making everyone drowsy.' },

  // ---------------------------------------------------------------- buckets
  { id: 'woodBucket', name: 'Wooden Bucket', slot: 'bucket', tier: 0, stats: { hp: 20, def: 3 }, blurb: 'Holds water. Ambitions modest.' },
  { id: 'copperPail', name: 'Copper Pail', slot: 'bucket', tier: 2, stats: { hp: 44, def: 8, luck: 3 }, bonus: { type: 'zpsMult', value: 1.04 }, blurb: 'Rings when you knock it.' },
  { id: 'onsenBasinBucket', name: 'Onsen Basin', slot: 'bucket', tier: 4, stats: { hp: 96, def: 16 }, bonus: { type: 'zpsMult', value: 1.09 }, blurb: 'Regulation issue. Cedar lined.' },
  { id: 'crystalEwer', name: 'Crystal Ewer', slot: 'bucket', tier: 7, stats: { hp: 190, def: 34, luck: 12 }, bonus: { type: 'globalMult', value: 1.06 }, blurb: 'The water inside is a slightly better water.' },
  { id: 'moonWell', name: 'Moon Well', slot: 'bucket', tier: 10, stats: { hp: 340, def: 62, luck: 24 }, bonus: { type: 'offlineRate', value: 0.08 }, blurb: 'Deeper on the inside. Considerably.' },
  { id: 'endlessBath', name: 'The Endless Bath', slot: 'bucket', tier: 13, stats: { hp: 700, def: 130, luck: 45 }, bonus: { type: 'zpsMult', value: 1.35 }, blurb: 'Never cools. Never empties. Never asks.' },
];

export const GEAR_BY_ID = Object.fromEntries(GEAR.map((g) => [g.id, g]));

/**
 * How much one point of each stat is worth. gearScore and the stat derivation
 * below are exact inverses of each other through this table, which is what lets
 * a piece keep its authored proportions while landing on an exact budget.
 */
export const STAT_WEIGHTS = {
  atk: 3,
  def: 2.5,
  hp: 0.5,
  spd: 2,
  luck: 1.5,
  crit: 400,
  critDmg: 120,
};

export const STAT_KEYS = Object.keys(STAT_WEIGHTS);

/**
 * Stats split into the two kinds that scale differently.
 *
 * The linear ones are quantities: doubling ATK doubles the damage, so they take
 * the rung's whole budget between them. Crit chance and crit damage are *rates* —
 * chance is capped below certainty and damage is a small additive multiplier —
 * so handing them a share of an exponential budget would burn most of it on a
 * number the game clamps anyway. They grow on their own gentle curve instead,
 * which keeps a crit-shaped piece feeling like a crit piece all the way up
 * without it quietly becoming the only stat that matters.
 */
export const LINEAR_STATS = ['atk', 'def', 'hp', 'spd', 'luck'];
export const RATE_STATS = ['crit', 'critDmg'];

/** Per-rung growth for the rate stats. Rung 19 is worth about 2.1×. */
export const RATE_TIER_STEP = 0.06;

/**
 * A rough power score, so "is this new drop better?" has an answer the UI can
 * show without the player doing arithmetic.
 */
export function gearScore(stats) {
  let sum = 0;
  for (const key of STAT_KEYS) sum += (stats?.[key] || 0) * STAT_WEIGHTS[key];
  return sum;
}

function linearScore(stats) {
  let sum = 0;
  for (const key of LINEAR_STATS) sum += (stats?.[key] || 0) * STAT_WEIGHTS[key];
  return sum;
}

// Each definition's authored numbers are scored once at load. Dividing by that
// score turns them into pure proportions, so scaling to a rung's budget is a
// single multiply and the shape is preserved exactly.
const SHAPE_SCORE = Object.fromEntries(GEAR.map((g) => [g.id, linearScore(g.stats) || 1]));

/**
 * The real stats of a piece: its shape, scaled to the budget of the rung it is
 * on, the stars it carries and how far it has been enhanced.
 */
export function statsFor(def, { tier = def.tier, stars = 1, forge = 0 } = {}) {
  const stars_ = R.starMult(stars);
  const scale = (R.budget(tier) * stars_ * B.forgeMultiplier(forge)) / SHAPE_SCORE[def.id];
  const rateScale = (1 + R.clampTier(tier) * RATE_TIER_STEP) * stars_;

  const out = {};
  for (const key of LINEAR_STATS) {
    if (def.stats[key]) out[key] = def.stats[key] * scale;
  }
  for (const key of RATE_STATS) {
    if (def.stats[key]) out[key] = def.stats[key] * rateScale;
  }
  return out;
}

/** Everything that can drop in a given slot. */
export function gearForSlot(slot) {
  return GEAR.filter((g) => g.slot === slot);
}

/** Pieces whose usual rung is at or below a ceiling — the world-drop pool. */
export function gearUpToTier(tier) {
  return GEAR.filter((g) => g.tier <= tier);
}
