// The season pass: 100 levels, two tracks.
//
// The free track is a complete pass on its own — it pays every level, it gives
// leafs, and it hands out two cosmetics nobody has to spend anything for. The
// premium track pays more of the same and adds two looks of its own. It does
// not gate the free rewards behind itself, and it does not sell power the free
// track cannot reach; everything premium gives, the free track gives less of.
//
// Rewards are generated from the level rather than typed out a hundred times,
// so the two tracks stay in proportion instead of drifting as they were edited.

/** Simulated. See systems/store.js for the whole of what that means. */
export const PREMIUM_PRICE = '£8.99';

/** The other way in, for anyone who would rather not press a price tag. */
export const PREMIUM_LEAFS = 1200;

export const PASS_LEVELS = 100;
export const PASS_XP_PER_LEVEL = 120;

/** Pass XP for clearing a stage, so the pass moves while you play, not only while you quest. */
export const PASS_XP_PER_CLEAR = 1;
export const PASS_XP_PER_BOSS = 12;

/**
 * The free track. Every level pays something; the round numbers pay properly.
 * Level 100 is a title, because the last thing a season gives you should be
 * something you can still show off next season.
 */
export function freeReward(level) {
  if (level === 100) return { cosmetic: 'title:seasoned', text: 'Title: Seasoned' };
  if (level === 40) return { cosmetic: 'pond:lantern', text: 'Pond: Lantern' };
  if (level % 25 === 0) return { leafs: 100 + level, text: `${100 + level} leafs` };
  if (level % 10 === 0) return { tickets: 3, shards: 400 + level * 12, text: `3 tickets · ${400 + level * 12} shards` };
  if (level % 5 === 0) return { tickets: 1, shards: 150 + level * 6, text: `1 ticket · ${150 + level * 6} shards` };
  if (level % 2 === 0) return { shards: 90 + level * 4, text: `${90 + level * 4} shards` };
  return { zenMult: 240 + level * 8, text: 'A pile of zen' };
}

/**
 * The premium track. Level 1 pays immediately and pays a skin, so unlocking it
 * is worth something the moment you do rather than forty levels later.
 */
export function premiumReward(level) {
  if (level === 1) return { cosmetic: 'skin:seasonal', text: 'Skin: Hot Spring' };
  if (level === 100) return { cosmetic: 'title:patronOfSeasons', text: 'Title: Of Every Season' };
  if (level % 10 === 0) return { leafs: 60 + level, tickets: 3, text: `${60 + level} leafs · 3 tickets` };
  if (level % 5 === 0) return { tickets: 2, shards: 300 + level * 12, text: `2 tickets · ${300 + level * 12} shards` };
  if (level % 3 === 0) return { shards: 180 + level * 8, text: `${180 + level * 8} shards` };
  return { zenMult: 480 + level * 16, text: 'A bigger pile of zen' };
}

export function passReward(level, track = 'free') {
  return track === 'premium' ? premiumReward(level) : freeReward(level);
}

export const TRACKS = ['free', 'premium'];
