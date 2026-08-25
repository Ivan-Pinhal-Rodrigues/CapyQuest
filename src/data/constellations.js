// The 12 ascension constellations, bought with Lotus.
//
// This file used to also hold 22 prestige relics. Those were folded into the
// rebirth tree's Legacy branch (see data/rebirthTree.js) — same ids, same
// effects, one screen instead of two.

export const CONSTELLATIONS = [
  { id: 'theBather', name: 'The Bather', cost: 1, max: 3,
    effect: { type: 'globalMult', value: 2 }, blurb: 'Double all income per rank.' },
  { id: 'theFloater', name: 'The Floater', cost: 2, max: 3,
    effect: { type: 'zpsMult', value: 2.5 }, blurb: '×2.5 idle income per rank.' },
  { id: 'theTapper', name: 'The Tapper', cost: 2, max: 3,
    effect: { type: 'clickMult', value: 2.5 }, blurb: '×2.5 tap power per rank.' },
  { id: 'theHoarder', name: 'The Hoarder', cost: 3, max: 3,
    effect: { type: 'essenceGain', value: 1 }, blurb: 'Double essence from rebirthing per rank.' },
  { id: 'theDreamer', name: 'The Dreamer', cost: 4, max: 2,
    effect: { type: 'offlineCapHours', value: 24 }, blurb: '+24h offline cap per rank.' },
  { id: 'theWatcher', name: 'The Watcher', cost: 5, max: 3,
    effect: { type: 'goldenChance', value: 0.5 }, blurb: '+50% golden rate per rank.' },
  { id: 'theHunter', name: 'The Hunter', cost: 6, max: 3,
    effect: { type: 'combatAtk', value: 1 }, blurb: 'Double ATK per rank.' },
  { id: 'theWall', name: 'The Wall', cost: 6, max: 3,
    effect: { type: 'combatDef', value: 1 }, blurb: 'Double DEF per rank.' },
  { id: 'theGenerous', name: 'The Generous', cost: 8, max: 3,
    effect: { type: 'ticketRate', value: 3 }, blurb: '+3 summon tickets per boss, per rank.' },
  { id: 'theFrugal', name: 'The Frugal', cost: 10, max: 3,
    effect: { type: 'costDiscount', value: 0.1 }, blurb: '−10% generator prices per rank.' },
  { id: 'theEndless', name: 'The Endless', cost: 15, max: 5,
    effect: { type: 'globalMult', value: 5 }, blurb: '×5 all income per rank.' },
  { id: 'theStillPoint', name: 'The Still Point', cost: 40, max: 1,
    effect: { type: 'globalMult', value: 50 }, blurb: '×50 all income. The end of wanting.' },
];

export const CONSTELLATIONS_BY_ID = Object.fromEntries(CONSTELLATIONS.map((c) => [c.id, c]));

/** Cost of the Nth rank of a constellation. */
export function rankCost(def, ownedRanks) {
  return Math.ceil(def.cost * Math.pow(1.6, ownedRanks));
}
