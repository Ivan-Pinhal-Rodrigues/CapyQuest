// A 27-node talent tree in three branches of nine. Points come from levels,
// and a respec is always free — a tree you are afraid to touch is not a choice,
// it is a trap.
//
// Chonk  survivability and idle income
// Zen    economy, cost reduction, offline
// Feral  taps, crits, combos
//
// tier   1..3, gated on points already spent in that branch
// max    how many times the node can be taken
// effect per-rank effect, in the systems/stats.js vocabulary

const BRANCHES = {
  chonk: { name: 'Chonk', color: '#c99560', blurb: 'Be large. Be unbothered.' },
  zen: { name: 'Zen', color: '#7fd0e6', blurb: 'Let the pond do the work.' },
  feral: { name: 'Feral', color: '#f0a63d', blurb: 'Tap like you mean it.' },
};

export const TALENT_BRANCHES = BRANCHES;

export const TALENTS = [
  // ------------------------------------------------------------- chonk
  { id: 'chonk1', branch: 'chonk', tier: 1, name: 'Broad Shoulders', max: 5,
    effect: { type: 'zpsMult', value: 1.04 }, blurb: '+4% idle income per rank.' },
  { id: 'chonk2', branch: 'chonk', tier: 1, name: 'Deep Reserves', max: 5,
    effect: { type: 'combatHp', value: 0.08 }, blurb: '+8% max HP per rank.' },
  { id: 'chonk3', branch: 'chonk', tier: 1, name: 'Thick Coat', max: 5,
    effect: { type: 'combatDef', value: 0.08 }, blurb: '+8% DEF per rank.' },
  { id: 'chonk4', branch: 'chonk', tier: 2, name: 'Slow Metabolism', max: 3,
    effect: { type: 'offlineRate', value: 0.05 }, blurb: '+5% offline rate per rank.' },
  { id: 'chonk5', branch: 'chonk', tier: 2, name: 'Long Sleeper', max: 3,
    effect: { type: 'offlineCapHours', value: 3 }, blurb: '+3h offline cap per rank.' },
  { id: 'chonk6', branch: 'chonk', tier: 2, name: 'Immovable', max: 3,
    effect: { type: 'combatDef', value: 0.18 }, blurb: '+18% DEF per rank.' },
  { id: 'chonk7', branch: 'chonk', tier: 3, name: 'Absolute Mass', max: 3,
    effect: { type: 'zpsMult', value: 1.15 }, blurb: '+15% idle income per rank.' },
  { id: 'chonk8', branch: 'chonk', tier: 3, name: 'Unbothered', max: 1,
    effect: { type: 'combatHp', value: 0.6 }, blurb: '+60% max HP.' },
  { id: 'chonk9', branch: 'chonk', tier: 3, name: 'The Chonk Within', max: 1,
    effect: { type: 'globalMult', value: 1.25 }, blurb: '+25% all income.' },

  // --------------------------------------------------------------- zen
  { id: 'zen1', branch: 'zen', tier: 1, name: 'Frugal', max: 5,
    effect: { type: 'costDiscount', value: 0.02 }, blurb: '−2% generator prices per rank.' },
  { id: 'zen2', branch: 'zen', tier: 1, name: 'Still Water', max: 5,
    effect: { type: 'globalMult', value: 1.03 }, blurb: '+3% all income per rank.' },
  { id: 'zen3', branch: 'zen', tier: 1, name: 'Patient', max: 5,
    effect: { type: 'goldenChance', value: 0.08 }, blurb: '+8% golden capybara rate per rank.' },
  { id: 'zen4', branch: 'zen', tier: 2, name: 'Deep Pockets', max: 3,
    effect: { type: 'costDiscount', value: 0.05 }, blurb: '−5% generator prices per rank.' },
  { id: 'zen5', branch: 'zen', tier: 2, name: 'Lingering Steam', max: 3,
    effect: { type: 'goldenDuration', value: 0.15 }, blurb: '+15% buff duration per rank.' },
  { id: 'zen6', branch: 'zen', tier: 2, name: 'Fortune', max: 3,
    effect: { type: 'combatLuck', value: 25 }, blurb: '+25 LUCK per rank.' },
  { id: 'zen7', branch: 'zen', tier: 3, name: 'The Long View', max: 3,
    effect: { type: 'globalMult', value: 1.12 }, blurb: '+12% all income per rank.' },
  { id: 'zen8', branch: 'zen', tier: 3, name: 'Endless Spring', max: 1,
    effect: { type: 'zpsMult', value: 1.5 }, blurb: '+50% idle income.' },
  { id: 'zen9', branch: 'zen', tier: 3, name: 'Perfect Stillness', max: 1,
    effect: { type: 'offlineRate', value: 0.25 }, blurb: '+25% offline rate.' },

  // ------------------------------------------------------------- feral
  { id: 'feral1', branch: 'feral', tier: 1, name: 'Quick Paws', max: 5,
    effect: { type: 'clickMult', value: 1.06 }, blurb: '+6% tap power per rank.' },
  { id: 'feral2', branch: 'feral', tier: 1, name: 'Keen Edge', max: 5,
    effect: { type: 'critChance', value: 0.02 }, blurb: '+2% crit chance per rank.' },
  { id: 'feral3', branch: 'feral', tier: 1, name: 'Momentum', max: 5,
    effect: { type: 'comboCap', value: 6 }, blurb: '+6 max combo per rank.' },
  { id: 'feral4', branch: 'feral', tier: 2, name: 'Savage', max: 3,
    effect: { type: 'critDamage', value: 0.4 }, blurb: '+0.4× crit damage per rank.' },
  { id: 'feral5', branch: 'feral', tier: 2, name: 'Relentless', max: 3,
    effect: { type: 'comboStep', value: 0.008 }, blurb: '+0.8% power per combo point per rank.' },
  { id: 'feral6', branch: 'feral', tier: 2, name: 'Predator', max: 3,
    effect: { type: 'combatAtk', value: 0.15 }, blurb: '+15% ATK per rank.' },
  { id: 'feral7', branch: 'feral', tier: 3, name: 'Osmosis', max: 3,
    effect: { type: 'zpsShare', value: 0.03 }, blurb: 'Taps also grant 3% of ZPS per rank.' },
  { id: 'feral8', branch: 'feral', tier: 3, name: 'Apex', max: 1,
    effect: { type: 'combatAtk', value: 0.5 }, blurb: '+50% ATK.' },
  { id: 'feral9', branch: 'feral', tier: 3, name: 'The Feral Within', max: 1,
    effect: { type: 'clickMult', value: 2 }, blurb: 'Double tap power.' },
];

export const TALENTS_BY_ID = Object.fromEntries(TALENTS.map((t) => [t.id, t]));

/** Points already spent in a branch before a tier opens. */
export const TIER_GATES = { 1: 0, 2: 5, 3: 15 };

/** Talent points granted per character level (levels 1..N). */
export const POINTS_PER_LEVEL = 1;

/** Extra points from prestige, so the tree keeps growing after a reset. */
export const POINTS_PER_PRESTIGE = 3;
