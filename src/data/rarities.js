// The rarity ladder: 20 rungs, each piece 1–5 stars.
//
// v1 put rarity on the *definition* — a Straw Hat was common and could never be
// anything else, and the ladder ran out after seven rungs. That is why the wall
// arrived early: past a certain depth there was simply no better gear to find.
//
// Here rarity belongs to the *instance*. A definition supplies the item's stat
// shape, its bonus and its flavour; the rung it sits on and how many stars it
// carries live on the inventory entry, and both can be raised at the forge.
// A Straw Hat you have carried since the first pond can be pushed all the way
// to Capybaric, which is the point.
//
//   power = budget(tier) · starMult(stars) · forgeMultiplier(forge)
//
// `budget` is a single curve every item shares, so two pieces on the same rung
// are worth the same and differ only in how they spend it. That is what stops a
// twentieth-rung Straw Hat from quietly out-scaling a twentieth-rung Sun Diadem
// just because their hand-authored numbers were written against a flatter
// curve.

/**
 * Rung-to-rung power step. Worn 1★ to Capybaric 5★ is about ×2,800 — strong
 * enough to be worth chasing across many rebirths, not so strong that a lucky
 * fuse skips the game. The figure is not a free parameter: gear is a large
 * share of the stat block, so the ladder's slope moves where the rebirth wall
 * lands, and tests/stages.test.js asserts that it still lands in the intended
 * band.
 */
export const RARITY_MULT = 1.45;

/**
 * Total gear score of a 1★ +0 piece on the first rung. Chosen so a piece at the
 * rung its depth allows is worth roughly what the same piece was worth before
 * the ladder existed — the ladder changes the ceiling, not the opening hour.
 */
export const BASE_BUDGET = 30;

export const MAX_STARS = 5;

/** Each star past the first adds 35%. A 5★ is worth 2.4 of a 1★. */
export const STAR_STEP = 0.35;

export const RARITIES = [
  { tier: 0, name: 'Worn', color: '#6f6a63', glow: 'rgba(111,106,99,0.3)' },
  { tier: 1, name: 'Common', color: '#9aa5b1', glow: 'rgba(154,165,177,0.35)' },
  { tier: 2, name: 'Sturdy', color: '#7e8f78', glow: 'rgba(126,143,120,0.35)' },
  { tier: 3, name: 'Uncommon', color: '#5fa348', glow: 'rgba(95,163,72,0.35)' },
  { tier: 4, name: 'Polished', color: '#49b07a', glow: 'rgba(73,176,122,0.38)' },
  { tier: 5, name: 'Rare', color: '#4d8fd9', glow: 'rgba(77,143,217,0.4)' },
  { tier: 6, name: 'Fine', color: '#4f6fd0', glow: 'rgba(79,111,208,0.4)' },
  { tier: 7, name: 'Epic', color: '#a45fd9', glow: 'rgba(164,95,217,0.45)' },
  { tier: 8, name: 'Pristine', color: '#c06fe0', glow: 'rgba(192,111,224,0.45)' },
  { tier: 9, name: 'Legendary', color: '#f0a63d', glow: 'rgba(240,166,61,0.5)' },
  { tier: 10, name: 'Mythic', color: '#e8556d', glow: 'rgba(232,85,109,0.5)' },
  { tier: 11, name: 'Ancient', color: '#d4763a', glow: 'rgba(212,118,58,0.5)' },
  { tier: 12, name: 'Ethereal', color: '#7fd0e6', glow: 'rgba(127,208,230,0.5)' },
  { tier: 13, name: 'Astral', color: '#8f7ce8', glow: 'rgba(143,124,232,0.52)' },
  { tier: 14, name: 'Celestial', color: '#f2e6a0', glow: 'rgba(242,230,160,0.55)' },
  { tier: 15, name: 'Void', color: '#6b5a92', glow: 'rgba(107,90,146,0.55)' },
  { tier: 16, name: 'Primordial', color: '#c25a33', glow: 'rgba(194,90,51,0.55)' },
  { tier: 17, name: 'Eternal', color: '#e0c14d', glow: 'rgba(224,193,77,0.58)' },
  { tier: 18, name: 'Transcendent', color: '#ff8ad4', glow: 'rgba(255,138,212,0.6)' },
  { tier: 19, name: 'Capybaric', color: '#4de0c0', glow: 'rgba(77,224,192,0.62)' },
];

export const MAX_TIER = RARITIES.length - 1;

export function clampTier(tier) {
  const n = Math.floor(Number(tier));
  if (!Number.isFinite(n)) return 0;
  return Math.min(MAX_TIER, Math.max(0, n));
}

export function clampStars(stars) {
  const n = Math.floor(Number(stars));
  if (!Number.isFinite(n)) return 1;
  return Math.min(MAX_STARS, Math.max(1, n));
}

/** The descriptor for a rung. Always returns one — a bad tier clamps. */
export function rarityFor(tier) {
  return RARITIES[clampTier(tier)];
}

export function rarityName(tier) {
  return rarityFor(tier).name;
}

/** Total gear score a 1★ +0 piece is worth on a rung. */
export function budget(tier) {
  return BASE_BUDGET * Math.pow(RARITY_MULT, clampTier(tier));
}

export function starMult(stars) {
  return 1 + (clampStars(stars) - 1) * STAR_STEP;
}

/**
 * The odds of a refine adding a star, by the star count you already hold.
 * Shown on the button — an unstated roll is a slot machine, a stated one is a
 * decision.
 */
export const REFINE_ODDS = [0.55, 0.35, 0.2, 0.09];

/** Failures on one piece before the next refine is guaranteed. */
export const REFINE_PITY = 4;

export function refineChance(stars) {
  return REFINE_ODDS[clampStars(stars) - 1] ?? 0;
}

/** Unequipped pieces of the same slot and rung consumed by one fuse. */
export const FUSE_COST = 3;
