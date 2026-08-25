// 18 combat skills. Three can be slotted at once, so the interesting decision
// is which three, not whether to buy them.
//
// kind 'active'  fires on a cooldown during auto-battle
//      'passive' always on
//
// Actives declare an `effect` the combat system interprets; passives declare
// `stats` (combat) and/or `bonus` (idle-game, in the systems/stats.js vocabulary).

export const SKILLS = [
  // --------------------------------------------------------------- actives
  {
    id: 'chomp', name: 'Chomp', kind: 'active', cooldown: 4,
    req: { stage: 0 },
    effect: { type: 'strike', mult: 2.2 },
    blurb: 'A decisive bite. The classic opener.',
  },
  {
    id: 'splash', name: 'Splash', kind: 'active', cooldown: 6,
    req: { stage: 4 },
    effect: { type: 'strike', mult: 1.6, element: 'water' },
    blurb: 'Water everywhere. Some of it on purpose.',
  },
  {
    id: 'bellyFlop', name: 'Belly Flop', kind: 'active', cooldown: 9,
    req: { stage: 12 },
    effect: { type: 'strike', mult: 4.5, selfStun: 1.5 },
    blurb: 'Enormous damage. You do need a moment afterwards.',
  },
  {
    id: 'yuzuToss', name: 'Yuzu Toss', kind: 'active', cooldown: 7,
    req: { stage: 18 },
    effect: { type: 'strike', mult: 2, healPct: 0.08 },
    blurb: 'Throw the citrus. Feel better for having done it.',
  },
  {
    id: 'steamVent', name: 'Steam Vent', kind: 'active', cooldown: 11,
    req: { stage: 26 },
    effect: { type: 'strike', mult: 3.2, element: 'ember' },
    blurb: 'The springs cooperate, briefly.',
  },
  {
    id: 'napHeal', name: 'Power Nap', kind: 'active', cooldown: 14,
    req: { stage: 32 },
    effect: { type: 'heal', pct: 0.3 },
    blurb: 'Four seconds of sleep worth an hour of it.',
  },
  {
    id: 'moonlight', name: 'Moonlight', kind: 'active', cooldown: 13,
    req: { stage: 48 },
    effect: { type: 'strike', mult: 3.8, element: 'moon', ignoreDef: 0.5 },
    blurb: 'Goes straight through armour, and manners.',
  },
  {
    id: 'chonkSlam', name: 'Chonk Slam', kind: 'active', cooldown: 16,
    req: { stage: 70 },
    effect: { type: 'strike', mult: 7, scaleWithHp: true },
    blurb: 'Damage scales with how much capybara there is.',
  },
  {
    id: 'zenBurst', name: 'Zen Burst', kind: 'active', cooldown: 20,
    req: { stage: 95 },
    effect: { type: 'strike', mult: 12 },
    blurb: 'Everything the pond has, at once.',
  },

  // -------------------------------------------------------------- passives
  {
    id: 'thickHide', name: 'Thick Hide', kind: 'passive',
    req: { stage: 2 },
    stats: { def: 12, hp: 60 },
    blurb: 'Being round is a defensive strategy.',
  },
  {
    id: 'sharpTeeth', name: 'Sharp Teeth', kind: 'passive',
    req: { stage: 8 },
    stats: { atk: 18, crit: 0.03 },
    blurb: 'They never stop growing, so they never stop helping.',
  },
  {
    id: 'calmMind', name: 'Calm Mind', kind: 'passive',
    req: { stage: 15 },
    stats: { spd: 10 },
    bonus: { type: 'zpsMult', value: 1.08 },
    blurb: 'An unbothered capybara is a productive capybara.',
  },
  {
    id: 'scavenger', name: 'Scavenger', kind: 'passive',
    req: { stage: 22 },
    stats: { luck: 20 },
    blurb: 'Finds things. Frequently things nobody lost.',
  },
  {
    id: 'hotBlooded', name: 'Hot Blooded', kind: 'passive',
    req: { stage: 30 },
    stats: { atk: 45, critDmg: 0.5 },
    blurb: 'Runs warm. Hits warmer.',
  },
  {
    id: 'tidalFlow', name: 'Tidal Flow', kind: 'passive',
    req: { stage: 42 },
    stats: { spd: 25, def: 30 },
    blurb: 'Never quite where the hit was aimed.',
  },
  {
    id: 'dreamer', name: 'Dreamer', kind: 'passive',
    req: { stage: 55 },
    stats: { hp: 320, luck: 30 },
    bonus: { type: 'offlineRate', value: 0.08 },
    blurb: 'Fights better having recently been asleep.',
  },
  {
    id: 'sunTouched', name: 'Sun Touched', kind: 'passive',
    req: { stage: 80 },
    stats: { atk: 130, crit: 0.08 },
    bonus: { type: 'clickMult', value: 1.2 },
    blurb: 'Warmed through by something enormous.',
  },
  {
    id: 'absoluteCalm', name: 'Absolute Calm', kind: 'passive',
    req: { stage: 110 },
    stats: { atk: 260, def: 200, hp: 900, crit: 0.1, critDmg: 1 },
    bonus: { type: 'globalMult', value: 1.25 },
    blurb: 'Nothing is urgent. Nothing has ever been urgent.',
  },
];

export const SKILLS_BY_ID = Object.fromEntries(SKILLS.map((s) => [s.id, s]));

export const SKILL_SLOTS = 3;
