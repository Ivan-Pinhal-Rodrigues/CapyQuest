// 22 prestige relics (bought with Yuzu) and 12 ascension constellations
// (bought with Lotus). Both survive their own reset, which is the whole point
// of pressing the button.

export const RELICS = [
  { id: 'warmStone', name: 'Warm Stone', cost: 1, max: 1,
    effect: { type: 'globalMult', value: 1.1 }, blurb: 'Holds the heat all night. +10% all income.' },
  { id: 'firstYuzu', name: 'The First Yuzu', cost: 2, max: 1,
    effect: { type: 'clickMult', value: 1.5 }, blurb: 'You kept it. +50% tap power.' },
  { id: 'steadyHand', name: 'Steady Hand', cost: 3, max: 5,
    effect: { type: 'clickMult', value: 1.2 }, blurb: '+20% tap power per rank.' },
  { id: 'deepRoots', name: 'Deep Roots', cost: 3, max: 5,
    effect: { type: 'zpsMult', value: 1.2 }, blurb: '+20% idle income per rank.' },
  { id: 'goodMemory', name: 'Good Memory', cost: 5, max: 3,
    effect: { type: 'offlineCapHours', value: 6 }, blurb: '+6h offline cap per rank.' },
  { id: 'deepSleeper', name: 'Deep Sleeper', cost: 6, max: 4,
    effect: { type: 'offlineRate', value: 0.08 }, blurb: '+8% offline rate per rank.' },
  { id: 'thriftyPaws', name: 'Thrifty Paws', cost: 8, max: 5,
    effect: { type: 'costDiscount', value: 0.04 }, blurb: '−4% generator prices per rank.' },
  { id: 'luckyStreak', name: 'Lucky Streak', cost: 10, max: 4,
    effect: { type: 'critChance', value: 0.04 }, blurb: '+4% crit chance per rank.' },
  { id: 'heavyPaw', name: 'Heavy Paw', cost: 12, max: 4,
    effect: { type: 'critDamage', value: 0.75 }, blurb: '+0.75× crit damage per rank.' },
  { id: 'goldenTrail', name: 'Golden Trail', cost: 15, max: 4,
    effect: { type: 'goldenChance', value: 0.2 }, blurb: '+20% golden capybara rate per rank.' },
  { id: 'lingering', name: 'Lingering', cost: 18, max: 4,
    effect: { type: 'goldenDuration', value: 0.2 }, blurb: '+20% buff duration per rank.' },
  { id: 'unbrokenRhythm', name: 'Unbroken Rhythm', cost: 20, max: 4,
    effect: { type: 'comboCap', value: 15 }, blurb: '+15 max combo per rank.' },
  { id: 'flowState', name: 'Flow State', cost: 25, max: 3,
    effect: { type: 'comboStep', value: 0.01 }, blurb: '+1% power per combo point per rank.' },
  { id: 'osmoticSkin', name: 'Osmotic Skin', cost: 30, max: 3,
    effect: { type: 'zpsShare', value: 0.05 }, blurb: 'Taps grant 5% of ZPS per rank.' },
  { id: 'ironHide', name: 'Iron Hide', cost: 35, max: 4,
    effect: { type: 'combatDef', value: 0.25 }, blurb: '+25% DEF per rank.' },
  { id: 'sharpenedTeeth', name: 'Sharpened Teeth', cost: 40, max: 4,
    effect: { type: 'combatAtk', value: 0.25 }, blurb: '+25% ATK per rank.' },
  { id: 'wellFed', name: 'Well Fed', cost: 45, max: 4,
    effect: { type: 'combatHp', value: 0.3 }, blurb: '+30% max HP per rank.' },
  { id: 'foragersEye', name: "Forager's Eye", cost: 55, max: 4,
    effect: { type: 'combatLuck', value: 60 }, blurb: '+60 LUCK per rank.' },
  { id: 'openInvitation', name: 'Open Invitation', cost: 80, max: 3,
    effect: { type: 'ticketRate', value: 1 }, blurb: '+1 summon ticket per boss killed, per rank.' },
  { id: 'compoundInterest', name: 'Compound Interest', cost: 120, max: 5,
    effect: { type: 'globalMult', value: 1.25 }, blurb: '+25% all income per rank.' },
  { id: 'theLongBath', name: 'The Long Bath', cost: 200, max: 3,
    effect: { type: 'yuzuGain', value: 0.25 }, blurb: '+25% yuzu from prestiging per rank.' },
  { id: 'stillnessItself', name: 'Stillness Itself', cost: 400, max: 1,
    effect: { type: 'globalMult', value: 3 }, blurb: 'Triple all income. Permanently.' },
];

export const RELICS_BY_ID = Object.fromEntries(RELICS.map((r) => [r.id, r]));

// -------------------------------------------------------------- ascension

export const CONSTELLATIONS = [
  { id: 'theBather', name: 'The Bather', cost: 1, max: 3,
    effect: { type: 'globalMult', value: 2 }, blurb: 'Double all income per rank.' },
  { id: 'theFloater', name: 'The Floater', cost: 2, max: 3,
    effect: { type: 'zpsMult', value: 2.5 }, blurb: '×2.5 idle income per rank.' },
  { id: 'theTapper', name: 'The Tapper', cost: 2, max: 3,
    effect: { type: 'clickMult', value: 2.5 }, blurb: '×2.5 tap power per rank.' },
  { id: 'theHoarder', name: 'The Hoarder', cost: 3, max: 3,
    effect: { type: 'yuzuGain', value: 1 }, blurb: 'Double yuzu from prestiging per rank.' },
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

/** Cost of the Nth rank of a relic or constellation. */
export function rankCost(def, ownedRanks) {
  return Math.ceil(def.cost * Math.pow(1.6, ownedRanks));
}
