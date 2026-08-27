// Gear sets.
//
// THE PROBLEM THIS ANSWERS, in the postmortem's own words: "gear is still the
// only system with a real tradeoff, and it collapses late. Any piece can be
// carried to rung 20, so eventually there is one correct answer per slot."
//
// That is true and it is the ladder working as designed — the whole point of
// moving rarity onto the piece was that a Straw Hat can be carried the whole
// way up. What it costs is the decision: once every slot has a best answer,
// the Kit panel stops being a place you think and becomes a place you tidy.
//
// Sets put the decision back one level up. The question is no longer "which
// hat" — it is "which set", and the six of them want different things from
// you. Wearing four of one means passing over pieces that are individually
// better, which is the trade.
//
// HOW MEMBERSHIP IS STORED. Here, as lists of ids, rather than as a `set`
// field on all thirty-six pieces in data/gear.js. One file to read when you
// want to know what a set is, and gear.js keeps saying only what a piece is
// worth. A test asserts every id exists, that nothing is in two sets, and that
// no set holds two pieces for the same slot — which would quietly cap it at
// five wearable.
//
// SIX SETLESS PIECES survive on purpose: Bamboo Helm, Ember Seal, Ember Brand,
// Market Silk, Cloud Walkers, Moonlit Staff. They are the raw-stat answer, and
// a set bonus has to beat them to be worth wearing. Without something to lose
// by committing, a set is not a choice.

/**
 * Thresholds are on EQUIPPED pieces, counted per set.
 *
 * Two and four rather than two/four/six: six would mean the last two slots are
 * spoken for by definition, which is the collapse this is meant to fix. At
 * four you still have two slots to argue about.
 */
export const SET_THRESHOLDS = [2, 4];

export const GEAR_SETS = [
  {
    id: 'reedwater',
    name: 'Reedwater',
    blurb: 'The kit you started in. It still fits.',
    // The starter pieces. Keeping them is a real option because the forge can
    // carry any piece to the top of the ladder — so this set is a reward for
    // sentiment that happens to also pay.
    pieces: ['strawHat', 'ragScarf', 'riverPebble', 'mudSandals', 'stickRod', 'woodBucket'],
    bonuses: {
      2: [{ type: 'zpsMult', value: 1.35 }],
      4: [{ type: 'costDiscount', value: 0.12 }, { type: 'zpsMult', value: 3.0 }],
    },
    // What the set is FOR, in one line, shown on the card.
    identity: 'The pond pays more and costs less.',
  },
  {
    id: 'yuzuGrove',
    name: 'Yuzu Grove',
    blurb: 'Citrus, rope and good rope-adjacent decisions.',
    pieces: ['lilyCrown', 'reedWrap', 'yuzuCharm', 'reedTreads', 'bambooRod', 'copperPail'],
    bonuses: {
      2: [{ type: 'combatLuck', value: 18 }, { type: 'goldenChance', value: 0.3 }],
      4: [{ type: 'goldenChance', value: 1.6 }, { type: 'ticketRate', value: 2 }, { type: 'zpsMult', value: 2.4 }, { type: 'combatLuck', value: 40 }],
    },
    identity: 'Luck, golden capybaras and an extra ticket per boss.',
  },
  {
    id: 'bathhouse',
    name: 'Bathhouse',
    blurb: 'Hot water solves most things. Everything else is towels.',
    // The Endless Bath sits here rather than in The Still Point, and that is a
    // balance decision as much as a thematic one — see the note on stillPoint.
    pieces: ['towelTurban', 'steamShawl', 'luckyWhiskerCharm', 'springSoles', 'snapperClaw', 'endlessBath'],
    bonuses: {
      2: [{ type: 'combatHp', value: 0.4 }, { type: 'combatDef', value: 0.3 }],
      // DEF and HP alone are a trap here, and that is measured rather than
      // felt: neither `power` nor reachableStage() can see them — the first
      // ignores crit, the second is pure DPS against boss HP. A set nothing
      // in the game can measure is a set nobody can tell is working, so this
      // one carries real attack alongside the bulk.
      4: [{ type: 'combatDef', value: 1.1 }, { type: 'combatHp', value: 0.9 }, { type: 'combatAtk', value: 0.95 }],
    },
    identity: 'Very hard to kill. Not in a hurry.',
  },
  {
    id: 'tideglass',
    name: 'Tideglass',
    blurb: 'Sharp water. It goes through things.',
    pieces: ['moonCirclet', 'tidalMantle', 'moonMirror', 'tideSteppers', 'tideBreaker', 'crystalEwer'],
    bonuses: {
      2: [{ type: 'critChance', value: 0.12 }],
      4: [{ type: 'critChance', value: 0.3 }, { type: 'critDamage', value: 6.0 }],
    },
    identity: 'Crits often, and they hurt.',
  },
  {
    id: 'dreamlight',
    name: 'Dreamlight',
    blurb: 'Progress made entirely while asleep.',
    pieces: ['geodeCrown', 'dreamStole', 'shardHeart', 'dreamStriders', 'sunforgeHammer', 'moonWell'],
    bonuses: {
      2: [{ type: 'offlineRate', value: 0.25 }, { type: 'offlineCapHours', value: 4 }],
      4: [{ type: 'offlineCapHours', value: 12 }, { type: 'zpsMult', value: 2.4 }],
    },
    identity: 'The cache fills faster, holds longer, and pays more.',
  },
  {
    id: 'stillPoint',
    name: 'The Still Point',
    blurb: 'Where the water stops moving and starts deciding.',
    // NOT the six strongest pieces. Measured, the first draft of this set
    // scored exactly 0.0% against a best-in-slot baseline — because it WAS
    // the best-in-slot baseline, so committing to it cost nothing and
    // decided nothing. The Endless Bath moved to Bathhouse, where it reads
    // better anyway, and this set carries a weaker bucket as the price of
    // the largest raw-power bonus in the game.
    pieces: ['sunDiadem', 'voidCollar', 'stillPoint', 'chonkTreads', 'theLongNap', 'onsenBasinBucket'],
    bonuses: {
      2: [{ type: 'combatAtk', value: 0.5 }],
      4: [{ type: 'combatAtk', value: 1.45 }, { type: 'globalMult', value: 1.35 }],
    },
    identity: 'Raw force, on both sides of the game.',
  },
];

export const GEAR_SETS_BY_ID = Object.fromEntries(GEAR_SETS.map((s) => [s.id, s]));

/** set id, by piece id — built once so a lookup is not a scan of six arrays. */
export const SET_OF_PIECE = Object.fromEntries(
  GEAR_SETS.flatMap((set) => set.pieces.map((id) => [id, set.id])),
);

/** Which set a gear definition belongs to, or null. */
export function setOf(defId) {
  return GEAR_SETS_BY_ID[SET_OF_PIECE[defId]] || null;
}

/**
 * The bonuses a set grants at `count` equipped pieces.
 *
 * Cumulative: four pieces gets you the two-piece bonus as well. The alternative
 * — thresholds replacing each other — reads as a downgrade at the moment you
 * complete the set, which is the wrong feeling for the thing you worked for.
 */
export function bonusesAt(set, count) {
  const out = [];
  for (const threshold of SET_THRESHOLDS) {
    if (count >= threshold) out.push(...(set.bonuses[threshold] || []));
  }
  return out;
}
