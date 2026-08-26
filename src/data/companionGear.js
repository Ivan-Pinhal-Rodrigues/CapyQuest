// Gear for the crew.
//
// Twenty-four companions, three of them in the water with you, and until now
// the only thing you could do about a companion was pull duplicates until it
// levelled. This gives them something to wear that matters.
//
// It is deliberately *not* a second copy of the player's gear system:
//
//   NEVER SOLD. Player gear can be bought in cases; companion gear cannot be
//   bought at all. It drops from bosses, at a lower rate. The crew improves as
//   a consequence of playing rather than as a second grind to schedule.
//
//   THREE SLOTS, NOT SIX. charm / collar / trinket. Nine slots to think about
//   across the party rather than seventy-two across the roster.
//
//   NO FORGE, NO FUSE, NO REFINE. The rung and the stars a piece drops with are
//   the rung and the stars it keeps. One upgrade path in the game is enough;
//   two would make the Kit tab a second job.
//
// What it *does* share is the ladder. `data/rarities.js` decides what a rung is
// worth and `data/gear.js` holds the stat weights, so a companion piece on rung
// 9 and a player piece on rung 9 are worth the same — they simply spend it on
// different capybaras.

import { LINEAR_STATS, RATE_STATS, STAT_WEIGHTS } from './gear.js';
import * as R from './rarities.js';

export const COMPANION_SLOTS = [
  { id: 'charm', name: 'Charm', blurb: 'Something small they carry.' },
  { id: 'collar', name: 'Collar', blurb: 'Worn round the neck, usually with a bell.' },
  { id: 'trinket', name: 'Trinket', blurb: 'A found object of no practical use.' },
];

export const COMPANION_SLOT_IDS = COMPANION_SLOTS.map((s) => s.id);

/**
 * A companion piece is worth this share of a player piece on the same rung.
 *
 * Companions already contribute their own stats scaled by level, so gear here
 * is a bonus on a bonus. At parity the crew would out-scale the capybara
 * wearing it, which is the wrong shape for a game about one capybara.
 */
export const COMPANION_BUDGET_SHARE = 0.45;

export const COMPANION_GEAR = [
  // ----------------------------------------------------------------- charms
  { id: 'pebblePouch', name: 'Pebble Pouch', slot: 'charm', tier: 0, stats: { atk: 4, hp: 14 }, blurb: 'Six pebbles. All favourites.' },
  { id: 'reedKnot', name: 'Reed Knot', slot: 'charm', tier: 2, stats: { atk: 9, luck: 4 }, blurb: 'Tied by somebody with no thumbs.' },
  { id: 'warmStone', name: 'Warm Stone', slot: 'charm', tier: 3, stats: { hp: 60, def: 7 }, blurb: 'Has not been cold since the spring opened.' },
  { id: 'yuzuPeel', name: 'Dried Yuzu Peel', slot: 'charm', tier: 5, stats: { luck: 14, crit: 0.02 }, blurb: 'Still smells of it. Somehow.' },
  { id: 'snapperTooth', name: 'Snapper Tooth', slot: 'charm', tier: 7, stats: { atk: 32, critDmg: 0.3 }, blurb: 'Not theirs. They are clear about that.' },
  { id: 'emberCoal', name: 'Ember Coal', slot: 'charm', tier: 9, stats: { atk: 48, crit: 0.04 }, blurb: 'Banked, never out.' },
  { id: 'moonSliver', name: 'Moon Sliver', slot: 'charm', tier: 11, stats: { luck: 44, crit: 0.06, critDmg: 0.5 }, blurb: 'Came off something much larger.' },
  { id: 'quietBead', name: 'The Quiet Bead', slot: 'charm', tier: 14, stats: { atk: 110, luck: 60, critDmg: 0.8 }, blurb: 'It does not rattle. Nothing inside moves.' },

  // ---------------------------------------------------------------- collars
  { id: 'twineCollar', name: 'Twine Collar', slot: 'collar', tier: 0, stats: { def: 5, hp: 18 }, blurb: 'Frays constantly. Gets retied constantly.' },
  { id: 'bellCollarGear', name: 'Bell Collar', slot: 'collar', tier: 2, stats: { def: 10, hp: 36, spd: 3 }, blurb: 'You always know where they are.' },
  { id: 'mossBand', name: 'Moss Band', slot: 'collar', tier: 4, stats: { hp: 84, def: 14 }, blurb: 'Growing. Nobody has mentioned it.' },
  { id: 'copperRing', name: 'Copper Ring', slot: 'collar', tier: 6, stats: { def: 28, hp: 120, luck: 8 }, blurb: 'Green at the edges and proud of it.' },
  { id: 'tideCord', name: 'Tide Cord', slot: 'collar', tier: 8, stats: { def: 44, spd: 18, hp: 160 }, blurb: 'Pulls very slightly towards water.' },
  { id: 'lanternCollar', name: 'Lantern Collar', slot: 'collar', tier: 10, stats: { hp: 300, def: 62, luck: 16 }, blurb: 'Lit from somewhere inside it.' },
  { id: 'frostChain', name: 'Frost Chain', slot: 'collar', tier: 13, stats: { def: 120, hp: 460, spd: 24 }, blurb: 'Cold enough to be a decision.' },
  { id: 'stillCollar', name: 'The Still Collar', slot: 'collar', tier: 16, stats: { def: 240, hp: 900, luck: 50 }, blurb: 'Whatever is wearing it stops worrying.' },

  // --------------------------------------------------------------- trinkets
  { id: 'chewedStick', name: 'Chewed Stick', slot: 'trinket', tier: 0, stats: { spd: 4, atk: 3 }, blurb: 'Theirs. Absolutely theirs.' },
  { id: 'shinyShell', name: 'Shiny Shell', slot: 'trinket', tier: 2, stats: { luck: 8, spd: 5 }, blurb: 'Found. Kept. Guarded.' },
  { id: 'paperFan', name: 'Paper Fan', slot: 'trinket', tier: 4, stats: { spd: 16, atk: 14 }, blurb: 'Moves air. Moves the capybara less.' },
  { id: 'brassWhistle', name: 'Brass Whistle', slot: 'trinket', tier: 6, stats: { spd: 26, crit: 0.03, luck: 10 }, blurb: 'Nobody has heard it. Everyone respects it.' },
  { id: 'glassFloat', name: 'Glass Float', slot: 'trinket', tier: 8, stats: { hp: 200, spd: 20 }, blurb: 'Bobs whether or not there is water.' },
  { id: 'starMap', name: 'Star Map', slot: 'trinket', tier: 11, stats: { luck: 50, spd: 40, crit: 0.05 }, blurb: 'Out of date by an unknown amount.' },
  { id: 'suncatcher', name: 'Suncatcher', slot: 'trinket', tier: 13, stats: { atk: 130, crit: 0.08, critDmg: 0.7 }, blurb: 'Holds about four seconds of afternoon.' },
  { id: 'firstPebble', name: 'The First Pebble', slot: 'trinket', tier: 17, stats: { atk: 260, spd: 90, luck: 90, critDmg: 1.2 }, blurb: 'Every other pebble is a copy of this one.' },
];

export const COMPANION_GEAR_BY_ID = Object.fromEntries(COMPANION_GEAR.map((g) => [g.id, g]));

// Each definition's authored numbers are scored once at load, so scaling them
// to a rung's budget is one multiply and the shape is preserved exactly. Same
// trick as data/gear.js — see the note there for why it is worth doing.
function linearScore(stats) {
  let sum = 0;
  for (const key of LINEAR_STATS) sum += (stats?.[key] || 0) * STAT_WEIGHTS[key];
  return sum;
}

const SHAPE_SCORE = Object.fromEntries(
  COMPANION_GEAR.map((g) => [g.id, linearScore(g.stats) || 1]),
);

/** Per-rung growth for the rate stats, matching data/gear.js. */
export const RATE_TIER_STEP = 0.06;

/** The real stats of a companion piece on a rung, with its stars. */
export function companionStatsFor(def, { tier = def.tier, stars = 1 } = {}) {
  const stars_ = R.starMult(stars);
  const scale = (R.budget(tier) * stars_ * COMPANION_BUDGET_SHARE) / SHAPE_SCORE[def.id];
  const rateScale = (1 + R.clampTier(tier) * RATE_TIER_STEP) * stars_ * COMPANION_BUDGET_SHARE;

  const out = {};
  for (const key of LINEAR_STATS) {
    if (def.stats[key]) out[key] = def.stats[key] * scale;
  }
  for (const key of RATE_STATS) {
    if (def.stats[key]) out[key] = def.stats[key] * rateScale;
  }
  return out;
}

/** Everything that can drop in a slot. */
export function companionGearForSlot(slot) {
  return COMPANION_GEAR.filter((g) => g.slot === slot);
}

/** Pieces whose usual rung is at or below a ceiling — the drop pool. */
export function companionGearUpToTier(tier) {
  return COMPANION_GEAR.filter((g) => g.tier <= tier);
}
