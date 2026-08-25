// 24 capybaras to summon. Three at a time join your party.
//
// star   3 | 4 | 5 — drives the gacha rate and the stat budget
// stats  contributed to the player's combat block, scaled by companion level
// bonus  optional idle-game effect (systems/stats.js vocabulary), NOT scaled
//        by level — a flat bonus you either have or do not
//
// All 24 reuse the capybara sprite with a palette swap, which is the whole
// point of drawing the capybara as data in the first place.

export const COMPANIONS = [
  // ------------------------------------------------------------------ 3★
  { id: 'pip', name: 'Pip', star: 3, element: 'leaf', skin: 'classic',
    stats: { atk: 6, hp: 40 }, blurb: 'Small. Enthusiastic. Frequently damp.' },
  { id: 'moss', name: 'Moss', star: 3, element: 'leaf', skin: 'matcha',
    stats: { def: 8, hp: 55 }, blurb: 'Has not moved in some time. Is fine.' },
  { id: 'ripple', name: 'Ripple', star: 3, element: 'water', skin: 'frost',
    stats: { spd: 7, hp: 35 }, blurb: 'Prefers to arrive by current.' },
  { id: 'cinder', name: 'Cinder', star: 3, element: 'ember', skin: 'sakura',
    stats: { atk: 9, hp: 30 }, blurb: 'Runs warm. Sleeps warmer.' },
  { id: 'dusk', name: 'Dusk', star: 3, element: 'moon', skin: 'midnight',
    stats: { atk: 5, def: 6, hp: 42 }, blurb: 'Only really wakes up after seven.' },
  { id: 'sunny', name: 'Sunny', star: 3, element: 'sun', skin: 'golden',
    stats: { atk: 8, luck: 4 }, blurb: 'Relentlessly, exhaustingly pleased.' },
  { id: 'pebble', name: 'Pebble', star: 3, element: 'water', skin: 'classic',
    stats: { def: 10, hp: 60 }, blurb: 'Dense in the physical sense.' },
  { id: 'fern', name: 'Fern', star: 3, element: 'leaf', skin: 'matcha',
    stats: { spd: 6, luck: 6 }, blurb: 'Unfurls slowly. Everything does here.' },

  // ------------------------------------------------------------------ 4★
  { id: 'yuzu', name: 'Yuzu', star: 4, element: 'sun', skin: 'golden',
    stats: { atk: 22, luck: 12 }, bonus: { type: 'goldenChance', value: 0.12 },
    blurb: 'Named after the fruit. Behaves like it too.' },
  { id: 'brine', name: 'Brine', star: 4, element: 'water', skin: 'frost',
    stats: { atk: 26, spd: 14 }, blurb: 'Tastes of the sea. Nobody asked.' },
  { id: 'ash', name: 'Ash', star: 4, element: 'ember', skin: 'sakura',
    stats: { atk: 32, crit: 0.03 }, blurb: 'Whatever was there before, is not now.' },
  { id: 'willow', name: 'Willow', star: 4, element: 'leaf', skin: 'matcha',
    stats: { def: 28, hp: 180 }, bonus: { type: 'zpsMult', value: 1.08 },
    blurb: 'Bends. Does not break. Naps throughout.' },
  { id: 'lumen', name: 'Lumen', star: 4, element: 'moon', skin: 'midnight',
    stats: { atk: 24, luck: 20 }, blurb: 'Faintly luminous. Slightly unnerving.' },
  { id: 'kettle', name: 'Kettle', star: 4, element: 'ember', skin: 'classic',
    stats: { hp: 220, def: 22 }, bonus: { type: 'offlineRate', value: 0.05 },
    blurb: 'Always exactly at temperature.' },
  { id: 'quill', name: 'Quill', star: 4, element: 'sun', skin: 'golden',
    stats: { atk: 30, spd: 18 }, blurb: 'Keeps notes. Will not show them to you.' },
  { id: 'gale', name: 'Gale', star: 4, element: 'sun', skin: 'frost',
    stats: { spd: 34, crit: 0.04 }, blurb: 'Arrives before it is announced.' },

  // ------------------------------------------------------------------ 5★
  { id: 'onsenMaster', name: 'The Onsen Master', star: 5, element: 'ember', skin: 'golden',
    stats: { atk: 80, def: 60, hp: 500 }, bonus: { type: 'zpsMult', value: 1.25 },
    blurb: 'Has run the springs since before there were springs.' },
  { id: 'moonBather', name: 'The Moon Bather', star: 5, element: 'moon', skin: 'midnight',
    stats: { atk: 95, luck: 55, crit: 0.06 }, bonus: { type: 'goldenChance', value: 0.35 },
    blurb: 'Bathes only when nobody is counting.' },
  { id: 'tideKeeper', name: 'Tide Keeper', star: 5, element: 'water', skin: 'frost',
    stats: { def: 110, hp: 900, spd: 30 }, bonus: { type: 'offlineCapHours', value: 6 },
    blurb: 'Keeps the water where the water should be.' },
  { id: 'grovekeeper', name: 'The Grovekeeper', star: 5, element: 'leaf', skin: 'matcha',
    stats: { atk: 70, def: 90, hp: 700 }, bonus: { type: 'globalMult', value: 1.15 },
    blurb: 'Every stalk of bamboo, personally accounted for.' },
  { id: 'emberSage', name: 'Ember Sage', star: 5, element: 'ember', skin: 'sakura',
    stats: { atk: 140, crit: 0.1, critDmg: 0.8 }, bonus: { type: 'clickMult', value: 1.35 },
    blurb: 'Understands fire. Declines to explain it.' },
  { id: 'sunHerald', name: 'Herald of the Sun', star: 5, element: 'sun', skin: 'golden',
    stats: { atk: 125, spd: 55, luck: 40 }, bonus: { type: 'globalMult', value: 1.18 },
    blurb: 'Turns up at dawn whether invited or not.' },
  { id: 'theQuietOne', name: 'The Quiet One', star: 5, element: 'moon', skin: 'void',
    stats: { atk: 105, def: 105, hp: 800, luck: 70 }, bonus: { type: 'costDiscount', value: 0.08 },
    blurb: 'Has never said anything. Is clearly listening.' },
  { id: 'capybaraPrime', name: 'CAPYBARA PRIME', star: 5, element: 'moon', skin: 'void',
    stats: { atk: 200, def: 160, hp: 1600, crit: 0.12, critDmg: 1.2, luck: 100 },
    bonus: { type: 'globalMult', value: 1.4 },
    blurb: 'The original. Every other capybara is a rumour about this one.' },
];

export const COMPANIONS_BY_ID = Object.fromEntries(COMPANIONS.map((c) => [c.id, c]));

export const PARTY_SIZE = 3;

export const STAR_POOLS = {
  3: COMPANIONS.filter((c) => c.star === 3),
  4: COMPANIONS.filter((c) => c.star === 4),
  5: COMPANIONS.filter((c) => c.star === 5),
};

/** Duplicate pulls become shards; this many promote a companion a level. */
export const SHARDS_PER_LEVEL = { 3: 2, 4: 5, 5: 12 };

/** A companion's stat multiplier at a given level. */
export function companionMultiplier(level) {
  return 1 + Math.max(0, level - 1) * 0.22;
}

export const MAX_COMPANION_LEVEL = 30;
