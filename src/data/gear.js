// 42 gear pieces across 6 slots. Every piece can be enhanced +0 → +15 at the
// forge, so the roster stays useful long past the zone it dropped in.
//
// slot     hat | scarf | charm | sandal | rod | bucket
// rarity   common → uncommon → rare → epic → legendary → mythic → capybaric
// stats    flat contributions; forge level multiplies them (balance.forgeMultiplier)
// bonus    optional idle-game effect, in the systems/stats.js vocabulary

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
  { id: 'strawHat', name: 'Straw Hat', slot: 'hat', rarity: 'common', stats: { atk: 3, hp: 12 }, blurb: 'Keeps the sun off. Mostly.' },
  { id: 'lilyCrown', name: 'Lily Crown', slot: 'hat', rarity: 'uncommon', stats: { atk: 7, hp: 26, luck: 2 }, blurb: 'Worn by whoever naps in the middle.' },
  { id: 'bambooHelm', name: 'Bamboo Helm', slot: 'hat', rarity: 'rare', stats: { atk: 14, def: 12, hp: 55 }, blurb: 'Surprisingly good at its job.' },
  { id: 'towelTurban', name: 'Towel Turban', slot: 'hat', rarity: 'rare', stats: { hp: 90, def: 8 }, bonus: { type: 'zpsMult', value: 1.05 }, blurb: 'Straight from the hot cabinet.' },
  { id: 'moonCirclet', name: 'Moon Circlet', slot: 'hat', rarity: 'epic', stats: { atk: 30, crit: 0.05, luck: 6 }, blurb: 'Only visible at certain angles.' },
  { id: 'geodeCrown', name: 'Geode Crown', slot: 'hat', rarity: 'legendary', stats: { atk: 58, def: 40, hp: 210 }, bonus: { type: 'globalMult', value: 1.08 }, blurb: 'Hums the note the springs hum back.' },
  { id: 'sunDiadem', name: 'Sun Diadem', slot: 'hat', rarity: 'mythic', stats: { atk: 110, crit: 0.1, critDmg: 0.5 }, bonus: { type: 'clickMult', value: 1.25 }, blurb: 'Forged where the light gets made.' },

  // ---------------------------------------------------------------- scarves
  { id: 'ragScarf', name: 'Rag Scarf', slot: 'scarf', rarity: 'common', stats: { def: 4, hp: 15 }, blurb: 'It was a towel once.' },
  { id: 'reedWrap', name: 'Reed Wrap', slot: 'scarf', rarity: 'uncommon', stats: { def: 9, hp: 32, spd: 2 }, blurb: 'Woven tight enough to keep the wind out.' },
  { id: 'steamShawl', name: 'Steam Shawl', slot: 'scarf', rarity: 'rare', stats: { def: 18, hp: 68 }, bonus: { type: 'zpsMult', value: 1.06 }, blurb: 'Permanently, pleasantly damp.' },
  { id: 'marketSilk', name: 'Market Silk', slot: 'scarf', rarity: 'epic', stats: { def: 34, hp: 130, luck: 8 }, bonus: { type: 'costDiscount', value: 0.03 }, blurb: 'Cost more than it should have.' },
  { id: 'tidalMantle', name: 'Tidal Mantle', slot: 'scarf', rarity: 'epic', stats: { def: 42, hp: 155, spd: 5 }, blurb: 'Moves a half-second before you do.' },
  { id: 'dreamStole', name: 'Dream Stole', slot: 'scarf', rarity: 'legendary', stats: { def: 70, hp: 260, luck: 14 }, bonus: { type: 'offlineRate', value: 0.06 }, blurb: 'Works best while you are elsewhere.' },
  { id: 'voidCollar', name: 'Void Collar', slot: 'scarf', rarity: 'mythic', stats: { def: 128, hp: 480, crit: 0.06 }, bonus: { type: 'globalMult', value: 1.15 }, blurb: 'Nothing gets through. Nothing at all.' },

  // ----------------------------------------------------------------- charms
  { id: 'riverPebble', name: 'River Pebble', slot: 'charm', rarity: 'common', stats: { luck: 3, crit: 0.01 }, blurb: 'Smooth. Reassuring. Free.' },
  { id: 'yuzuCharm', name: 'Yuzu Charm', slot: 'charm', rarity: 'uncommon', stats: { luck: 6, crit: 0.02 }, bonus: { type: 'goldenChance', value: 0.06 }, blurb: 'Smells faintly of citrus forever.' },
  { id: 'luckyWhiskerCharm', name: 'Lucky Whisker', slot: 'charm', rarity: 'rare', stats: { luck: 12, crit: 0.04, critDmg: 0.2 }, blurb: 'Came off on its own. Allegedly.' },
  { id: 'emberSeal', name: 'Ember Seal', slot: 'charm', rarity: 'rare', stats: { atk: 22, crit: 0.03 }, blurb: 'Still warm from something.' },
  { id: 'moonMirror', name: 'Moon Mirror', slot: 'charm', rarity: 'epic', stats: { luck: 22, crit: 0.07, critDmg: 0.4 }, bonus: { type: 'critChance', value: 0.03 }, blurb: 'The reflection blinks a beat late.' },
  { id: 'shardHeart', name: 'Shard Heart', slot: 'charm', rarity: 'legendary', stats: { atk: 62, crit: 0.1, critDmg: 0.8, luck: 30 }, blurb: 'It beats. Nobody has asked why.' },
  { id: 'stillPoint', name: 'The Still Point', slot: 'charm', rarity: 'capybaric', stats: { atk: 160, crit: 0.15, critDmg: 1.5, luck: 60 }, bonus: { type: 'globalMult', value: 1.3 }, blurb: 'The calm centre of an enormous amount of nothing.' },

  // ---------------------------------------------------------------- sandals
  { id: 'mudSandals', name: 'Mud Sandals', slot: 'sandal', rarity: 'common', stats: { spd: 3, hp: 10 }, blurb: 'Squelch with every step.' },
  { id: 'reedTreads', name: 'Reed Treads', slot: 'sandal', rarity: 'uncommon', stats: { spd: 7, def: 6 }, blurb: 'Grip the bank properly.' },
  { id: 'springSoles', name: 'Spring Soles', slot: 'sandal', rarity: 'rare', stats: { spd: 14, hp: 48 }, bonus: { type: 'clickMult', value: 1.08 }, blurb: 'Every step is a small bounce.' },
  { id: 'cloudWalkers', name: 'Cloud Walkers', slot: 'sandal', rarity: 'epic', stats: { spd: 28, def: 24, luck: 10 }, blurb: 'Rated for altitude. Not rated for landing.' },
  { id: 'tideSteppers', name: 'Tide Steppers', slot: 'sandal', rarity: 'epic', stats: { spd: 33, atk: 26 }, blurb: 'Walk on it, not through it.' },
  { id: 'dreamStriders', name: 'Dream Striders', slot: 'sandal', rarity: 'legendary', stats: { spd: 56, hp: 200, luck: 20 }, bonus: { type: 'offlineCapHours', value: 3 }, blurb: 'Cover a lot of ground while stationary.' },
  { id: 'chonkTreads', name: 'Chonk Treads', slot: 'sandal', rarity: 'mythic', stats: { spd: 96, def: 90, hp: 420 }, bonus: { type: 'zpsMult', value: 1.2 }, blurb: 'Leave prints in stone.' },

  // ------------------------------------------------------------------- rods
  { id: 'stickRod', name: 'Just A Stick', slot: 'rod', rarity: 'common', stats: { atk: 6 }, blurb: 'It is, in fairness, a very good stick.' },
  { id: 'bambooRod', name: 'Bamboo Rod', slot: 'rod', rarity: 'uncommon', stats: { atk: 13, crit: 0.01 }, blurb: 'Flexible where it counts.' },
  { id: 'snapperClaw', name: 'Snapper Claw', slot: 'rod', rarity: 'rare', stats: { atk: 27, crit: 0.03 }, blurb: 'Still opens and closes. Do not test it.' },
  { id: 'emberBrand', name: 'Ember Brand', slot: 'rod', rarity: 'rare', stats: { atk: 32, critDmg: 0.3 }, blurb: 'Lights the room. Ruins the mood.' },
  { id: 'tideBreaker', name: 'Tide Breaker', slot: 'rod', rarity: 'epic', stats: { atk: 58, crit: 0.05, spd: 8 }, blurb: 'Parts water on the backswing.' },
  { id: 'moonlitStaff', name: 'Moonlit Staff', slot: 'rod', rarity: 'epic', stats: { atk: 64, critDmg: 0.5, luck: 12 }, bonus: { type: 'clickMult', value: 1.15 }, blurb: 'Only works when someone is watching.' },
  { id: 'sunforgeHammer', name: 'Sunforge Hammer', slot: 'rod', rarity: 'legendary', stats: { atk: 120, crit: 0.08, critDmg: 0.9 }, blurb: 'Heavier than the arm holding it.' },
  { id: 'theLongNap', name: 'The Long Nap', slot: 'rod', rarity: 'capybaric', stats: { atk: 260, crit: 0.16, critDmg: 1.8, spd: 30 }, bonus: { type: 'clickMult', value: 1.6 }, blurb: 'Ends fights by making everyone drowsy.' },

  // ---------------------------------------------------------------- buckets
  { id: 'woodBucket', name: 'Wooden Bucket', slot: 'bucket', rarity: 'common', stats: { hp: 20, def: 3 }, blurb: 'Holds water. Ambitions modest.' },
  { id: 'copperPail', name: 'Copper Pail', slot: 'bucket', rarity: 'uncommon', stats: { hp: 44, def: 8, luck: 3 }, bonus: { type: 'zpsMult', value: 1.04 }, blurb: 'Rings when you knock it.' },
  { id: 'onsenBasinBucket', name: 'Onsen Basin', slot: 'bucket', rarity: 'rare', stats: { hp: 96, def: 16 }, bonus: { type: 'zpsMult', value: 1.09 }, blurb: 'Regulation issue. Cedar lined.' },
  { id: 'crystalEwer', name: 'Crystal Ewer', slot: 'bucket', rarity: 'epic', stats: { hp: 190, def: 34, luck: 12 }, bonus: { type: 'globalMult', value: 1.06 }, blurb: 'The water inside is a slightly better water.' },
  { id: 'moonWell', name: 'Moon Well', slot: 'bucket', rarity: 'legendary', stats: { hp: 340, def: 62, luck: 24 }, bonus: { type: 'offlineRate', value: 0.08 }, blurb: 'Deeper on the inside. Considerably.' },
  { id: 'endlessBath', name: 'The Endless Bath', slot: 'bucket', rarity: 'mythic', stats: { hp: 700, def: 130, luck: 45 }, bonus: { type: 'zpsMult', value: 1.35 }, blurb: 'Never cools. Never empties. Never asks.' },
];

export const GEAR_BY_ID = Object.fromEntries(GEAR.map((g) => [g.id, g]));

/** Rarity ordering, used for sorting and for loot-table weighting. */
export const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'capybaric'];

export function rarityRank(rarity) {
  return RARITY_ORDER.indexOf(rarity);
}

/** Everything that can drop in a given slot. */
export function gearForSlot(slot) {
  return GEAR.filter((g) => g.slot === slot);
}

/**
 * A rough power score, so "is this new drop better?" has an answer the UI can
 * show without the player doing arithmetic.
 */
export function gearScore(item, forgeMult = 1) {
  const s = item.stats;
  const raw =
    (s.atk || 0) * 3 +
    (s.def || 0) * 2.5 +
    (s.hp || 0) * 0.5 +
    (s.spd || 0) * 2 +
    (s.luck || 0) * 1.5 +
    (s.crit || 0) * 400 +
    (s.critDmg || 0) * 120;
  return raw * forgeMult;
}
