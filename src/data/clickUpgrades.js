// 16 one-time "Paw path" upgrades. These are the spine of active play:
// flat power early, multipliers mid, then crit/combo/osmosis scaling that makes
// tapping stay relevant next to a huge idle income.
//
// Effect vocabulary is documented in systems/stats.js.

export const CLICK_UPGRADES = [
  {
    id: 'firmerPaw',
    name: 'Firmer Paw',
    cost: 100,
    req: { clicks: 25 },
    effects: [{ type: 'clickFlat', value: 1 }],
    blurb: 'Commit to the tap. The pond can tell when you are half-hearted.',
  },
  {
    id: 'twoPaws',
    name: 'Two Paws',
    cost: 500,
    req: { clicks: 100 },
    effects: [{ type: 'clickFlat', value: 4 }],
    blurb: 'Revolutionary technique: use the other one as well.',
  },
  {
    id: 'callusedToes',
    name: 'Callused Toes',
    cost: 3e3,
    req: { clicks: 300 },
    effects: [{ type: 'clickMult', value: 2 }],
    blurb: 'Years of pond-bottom walking, finally paying rent.',
  },
  {
    id: 'luckyWhisker',
    name: 'Lucky Whisker',
    cost: 15e3,
    req: { clicks: 600 },
    effects: [{ type: 'critChance', value: 0.05 }],
    blurb: 'One whisker points slightly wrong. That is the lucky one.',
  },
  {
    id: 'sharpIncisors',
    name: 'Sharp Incisors',
    cost: 80e3,
    req: { clicks: 1200 },
    effects: [{ type: 'critDamage', value: 0.5 }],
    blurb: 'Never stop growing. Neither does the damage.',
  },
  {
    id: 'bathRhythm',
    name: 'Rhythm of the Bath',
    cost: 400e3,
    req: { clicks: 2500 },
    effects: [{ type: 'comboCap', value: 15 }],
    blurb: 'Find the tempo of the dripping tap. Match it. Ascend.',
  },
  {
    id: 'chonkMomentum',
    name: 'Chonk Momentum',
    cost: 2e6,
    req: { clicks: 5e3 },
    effects: [{ type: 'comboStep', value: 0.01 }],
    blurb: 'An object in motion stays in motion, if the object is round enough.',
  },
  {
    id: 'zenOsmosis',
    name: 'Zen Osmosis',
    cost: 12e6,
    req: { clicks: 8e3, zps: 500 },
    effects: [{ type: 'zpsShare', value: 0.01 }],
    blurb: 'Your taps start skimming 1% of everything the pond makes.',
  },
  {
    id: 'ironPaw',
    name: 'Iron Paw',
    cost: 60e6,
    req: { clicks: 12e3 },
    effects: [{ type: 'clickMult', value: 3 }],
    blurb: 'Heavier than it looks. Much heavier than it looks.',
  },
  {
    id: 'goldenWhisker',
    name: 'Golden Whisker',
    cost: 350e6,
    req: { clicks: 18e3 },
    effects: [{ type: 'critChance', value: 0.08 }],
    blurb: 'Grew in overnight after a particularly good nap.',
  },
  {
    id: 'thunderTap',
    name: 'Thunder Tap',
    cost: 2e9,
    req: { clicks: 25e3 },
    effects: [{ type: 'critDamage', value: 1.5 }],
    blurb: 'The pond flashes. Distant capybaras look up, briefly.',
  },
  {
    id: 'endlessRhythm',
    name: 'Endless Rhythm',
    cost: 15e9,
    req: { clicks: 35e3, upgrade: 'bathRhythm' },
    effects: [{ type: 'comboCap', value: 30 }],
    blurb: 'There is no top of the beat. There is only more beat.',
  },
  {
    id: 'deepOsmosis',
    name: 'Deep Osmosis',
    cost: 100e9,
    req: { clicks: 50e3, upgrade: 'zenOsmosis' },
    effects: [{ type: 'zpsShare', value: 0.04 }],
    blurb: 'The membrane between tapping and idling gets thin here.',
  },
  {
    id: 'ancientPaw',
    name: 'Paw of the Ancients',
    cost: 800e9,
    req: { clicks: 75e3 },
    effects: [{ type: 'clickMult', value: 5 }],
    blurb: 'Pressed into wet clay a very long time ago. Still warm.',
  },
  {
    id: 'perfectForm',
    name: 'Perfect Form',
    cost: 8e12,
    req: { clicks: 120e3 },
    effects: [
      { type: 'critChance', value: 0.12 },
      { type: 'critDamage', value: 2 },
    ],
    blurb: 'Elbow relaxed, wrist loose, mind entirely empty. Textbook.',
  },
  {
    id: 'capyAscendant',
    name: 'Capybara Ascendant',
    cost: 100e15,
    req: { clicks: 200e3, upgrade: 'deepOsmosis' },
    effects: [
      { type: 'clickMult', value: 10 },
      { type: 'zpsShare', value: 0.1 },
    ],
    blurb: 'You are no longer tapping the capybara. You are tapping *as* it.',
  },
];

export const CLICK_UPGRADES_BY_ID = Object.fromEntries(CLICK_UPGRADES.map((u) => [u.id, u]));
