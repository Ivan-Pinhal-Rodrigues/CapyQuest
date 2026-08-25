// Keystones: the nodes that make the tree a build instead of a shopping list.
//
// The 210-node tree has one structural problem. Every node is a linear "+x% per
// rank", respec is free, and Essence keeps arriving — so given enough rebirths
// you buy all of it, and nothing you did along the way was a decision. Seven
// branches turn out to be the same node wearing different colours.
//
// A keystone is the opposite shape:
//
//   * one rank, ever — there is no "a bit of it"
//   * a large gain and a real cost, both in the same package
//   * at most KEYSTONE_MAX active at once
//
// The cap is what forces the choice. Without it a player eventually owns every
// keystone and the drawbacks average out into a wash, which is exactly the
// shopping list again with extra steps.
//
// Every drawback is expressed in the ordinary effect vocabulary — a multiplier
// below 1, or a negative addition — rather than as a special rule. That matters
// for a boring reason: a bespoke "golden capybaras stop spawning" flag is a
// thing that can silently stop being read, whereas `goldenChance: -1` flows
// through the same accumulator as everything else and cannot be forgotten.
// systems/stats.js gained floors on the affected values in the same change,
// because before keystones nothing in the game had ever produced a negative.

/** How many keystones can be active at once. The whole point of the system. */
export const KEYSTONE_MAX = 3;

/** Branch ranks required before a branch's keystones are offered at all. */
export const KEYSTONE_GATE = 70;

/** Essence for a keystone. Deliberately steep — this is a commitment. */
export const KEYSTONE_COST = 24000;

/**
 * Two per branch, fourteen in total.
 *
 * `gain` and `cost` are both plain effect lists. Splitting them is presentation
 * only — the engine concatenates them — but keeping them apart in the data
 * means a keystone cannot be written without someone typing out what it takes
 * away from you.
 */
export const KEYSTONES = [
  // ------------------------------------------------------------------ might
  {
    id: 'glassCannon',
    branch: 'might',
    name: 'Glass Cannon',
    line: 'Everything you have, in the swing. Nothing left over for being hit.',
    gain: [{ type: 'critDamage', value: 2.5 }],
    cost: [{ type: 'combatHp', value: -0.7 }],
  },
  {
    id: 'allIn',
    branch: 'might',
    name: 'All In',
    line: 'A capybara that has stopped considering the return journey.',
    gain: [{ type: 'combatAtk', value: 1.6 }],
    cost: [{ type: 'combatDef', value: -0.8 }],
  },

  // ------------------------------------------------------------------- hide
  {
    id: 'immovable',
    branch: 'hide',
    name: 'Immovable',
    line: 'It is not that you win. It is that you do not leave.',
    gain: [{ type: 'combatHp', value: 2.2 }],
    cost: [{ type: 'combatSpd', value: -0.6 }],
  },
  {
    id: 'stoneSkin',
    branch: 'hide',
    name: 'Stone Skin',
    line: 'Thick enough that precision stops being relevant.',
    gain: [{ type: 'combatDef', value: 2.2 }],
    cost: [{ type: 'critChance', value: -0.5 }],
  },

  // ---------------------------------------------------------------- fortune
  {
    id: 'bornLucky',
    branch: 'fortune',
    name: 'Born Lucky',
    line: 'Good things land on you. You are not otherwise productive.',
    gain: [{ type: 'combatLuck', value: 700 }],
    cost: [{ type: 'globalMult', value: 0.65 }],
  },
  {
    id: 'goldenAge',
    branch: 'fortune',
    name: 'Golden Age',
    line: 'The pond fills with golden capybaras and forgets how to work.',
    gain: [{ type: 'goldenChance', value: 2.5 }, { type: 'goldenDuration', value: 1 }],
    cost: [{ type: 'zpsMult', value: 0.45 }],
  },

  // ------------------------------------------------------------------- flow
  {
    id: 'blur',
    branch: 'flow',
    name: 'Blur',
    line: 'Twice as many hits, each one considerably less convincing.',
    gain: [{ type: 'combatSpd', value: 1.8 }],
    cost: [{ type: 'combatAtk', value: -0.5 }],
  },
  {
    id: 'unbroken',
    branch: 'flow',
    name: 'Unbroken',
    line: 'A shorter chain that matters much more.',
    gain: [{ type: 'comboStep', value: 0.07 }],
    cost: [{ type: 'comboCap', value: -18 }],
  },

  // --------------------------------------------------------------- commerce
  {
    id: 'hermit',
    branch: 'commerce',
    name: 'Hermit',
    line: 'The pond does better when nobody is watching it. Golden capybaras stop coming.',
    gain: [{ type: 'offlineRate', value: 0.5 }, { type: 'offlineCapHours', value: 24 }],
    cost: [{ type: 'goldenChance', value: -1 }],
  },
  {
    id: 'absentee',
    branch: 'commerce',
    name: 'The Absentee',
    line: 'Ownership without labour. Tapping becomes almost ceremonial.',
    gain: [{ type: 'zpsMult', value: 2.6 }],
    // Both halves of what a tap is worth. clickMult alone is not a drawback
    // here: tap value is (base+flat)*mult + zps*zpsShare, and with a real pond
    // that second term dwarfs the first — so cutting `mult` while *raising*
    // zps made The Absentee a tapping buff, which is the opposite of its name.
    cost: [{ type: 'clickMult', value: 0.12 }, { type: 'zpsShare', value: -1 }],
  },

  // --------------------------------------------------------------- instinct
  {
    id: 'handsOn',
    branch: 'instinct',
    name: 'Hands On',
    line: 'If you want it done, do it yourself. The pond will not cover for you.',
    gain: [{ type: 'clickMult', value: 3.2 }],
    // The cost is deliberately on income *while away* rather than on live zps.
    // Cutting live zps also cuts the zps*zpsShare term inside tap value, so the
    // first version of this keystone tripled your tap multiplier and left you
    // tapping for less than before.
    cost: [{ type: 'offlineRate', value: -0.5 }, { type: 'offlineCapHours', value: -8 }],
  },
  {
    id: 'restless',
    branch: 'instinct',
    name: 'Restless',
    line: 'Every tap pays like the pond does. You have stopped sleeping well.',
    gain: [{ type: 'zpsShare', value: 0.45 }],
    cost: [{ type: 'offlineRate', value: -0.45 }],
  },

  // ----------------------------------------------------------------- legacy
  {
    id: 'theLongGame',
    branch: 'legacy',
    name: 'The Long Game',
    line: 'This run is a down payment. It will not feel like one.',
    gain: [{ type: 'essenceGain', value: 1.6 }],
    cost: [{ type: 'globalMult', value: 0.55 }],
  },
  {
    id: 'oneMoreLife',
    branch: 'legacy',
    name: 'One More Life',
    line: 'Richer than you have ever been, and nobody turns up to help.',
    gain: [{ type: 'globalMult', value: 1.9 }],
    cost: [{ type: 'ticketRate', value: -0.6 }],
  },
];

export const KEYSTONES_BY_ID = Object.fromEntries(KEYSTONES.map((k) => [k.id, k]));

/** The keystones offered by one branch. */
export function keystonesFor(branch) {
  return KEYSTONES.filter((k) => k.branch === branch);
}

/** Every effect a keystone applies, gain and cost together. */
export function keystoneEffects(keystone) {
  return [...keystone.gain, ...keystone.cost];
}
