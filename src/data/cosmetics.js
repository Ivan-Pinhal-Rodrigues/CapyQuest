// Cosmetics: how the capybara looks, what the pond looks like, and what the
// game calls you.
//
// Everything here is earned *or* bought. Nothing in this file affects a single
// number in the simulation — that is the promise, and it is what makes buying
// one of these an aesthetic choice rather than a power one.
//
// Three kinds, all of which actually render. There is no fourth kind listed as
// "coming soon" and no option that does nothing when you pick it.
//
//   skin   the capybara's palette          render/palettes.js CAPY_SKINS
//   pond   the page and water colours      a data-pond attribute on <body>
//   title  a line under your zen count     the HUD

import { CAPY_SKINS } from '../render/palettes.js';

/** How a cosmetic is come by, for the label on its card. */
export const SOURCES = {
  start: 'Yours from the start',
  play: 'Earned',
  store: 'Store',
  pass: 'Season pass',
  event: 'Event',
};

export const SKINS = [
  { id: 'classic', name: 'Classic', source: 'start', blurb: 'A capybara. The default state of things.' },
  { id: 'golden', name: 'Golden', source: 'play', need: { goldens: 50 }, blurb: 'Catch fifty golden capybaras.' },
  { id: 'matcha', name: 'Matcha', source: 'play', need: { rebirths: 1 }, blurb: 'Rebirth once.' },
  { id: 'frost', name: 'Frost', source: 'play', need: { bossKills: 100 }, blurb: 'Beat a hundred bosses.' },
  { id: 'midnight', name: 'Midnight', source: 'store', cost: 250, blurb: 'Awake at the wrong hours.' },
  { id: 'sakura', name: 'Sakura', source: 'store', cost: 250, blurb: 'Petals in the water, all year.' },
  { id: 'void', name: 'Void', source: 'store', cost: 600, blurb: 'Something looked back.' },
  { id: 'seasonal', name: 'Hot Spring', source: 'pass', blurb: 'Premium pass, level 1. In the water too long.' },
  { id: 'harvest', name: 'Harvest', source: 'event', blurb: 'Yuzu Harvest exchange. Citrus all the way through.' },
];

export const PONDS = [
  { id: 'dusk', name: 'Dusk', source: 'start', blurb: 'The hour the steam looks best.' },
  { id: 'dawn', name: 'Dawn', source: 'play', need: { logins: 7 }, blurb: 'Log in seven days.' },
  { id: 'moonlit', name: 'Moonlit', source: 'play', need: { rebirths: 3 }, blurb: 'Rebirth three times.' },
  { id: 'ember', name: 'Ember', source: 'store', cost: 300, blurb: 'Somebody put the fire too close.' },
  { id: 'deep', name: 'Deep', source: 'store', cost: 300, blurb: 'The water goes further down than it should.' },
  { id: 'aurora', name: 'Aurora', source: 'store', cost: 750, blurb: 'The sky, showing off.' },
  { id: 'lantern', name: 'Lantern', source: 'pass', blurb: 'Free pass, level 40. Somebody hung lights.' },
  { id: 'bathhouse', name: 'Bathhouse', source: 'event', blurb: 'Moonlit Bathhouse exchange. The night shift.' },
];

export const TITLES = [
  { id: 'bather', name: 'Bather', source: 'start', blurb: 'You are, at minimum, in the water.' },
  { id: 'forager', name: 'Forager', source: 'play', need: { drops: 100 }, blurb: 'Find a hundred pieces of gear.' },
  { id: 'reborn', name: 'The Reborn', source: 'play', need: { rebirths: 5 }, blurb: 'Rebirth five times.' },
  { id: 'unbothered', name: 'Unbothered', source: 'play', need: { bestStars: 5 }, blurb: 'Refine a piece to five stars.' },
  { id: 'deepDweller', name: 'Deep Dweller', source: 'play', need: { bestDepth: 200 }, blurb: 'Reach stage 20.' },
  { id: 'patron', name: 'Patron of the Onsen', source: 'store', cost: 400, blurb: 'Somebody has to keep the lights on.' },
  { id: 'stillPoint', name: 'Of The Still Point', source: 'store', cost: 900, blurb: 'The calm centre of an enormous amount of nothing.' },
  { id: 'seasoned', name: 'Seasoned', source: 'pass', blurb: 'Free pass, level 100. You saw it through.' },
  { id: 'patronOfSeasons', name: 'Of Every Season', source: 'pass', blurb: 'Premium pass, level 100.' },
  { id: 'swift', name: 'Swift', source: 'event', blurb: 'Reed Rush exchange. You did run.' },
];

/** kind -> the table, so the panel and the systems agree on what exists. */
export const COSMETIC_KINDS = [
  { id: 'skin', name: 'Skins', items: SKINS, defaultId: 'classic' },
  { id: 'pond', name: 'Ponds', items: PONDS, defaultId: 'dusk' },
  { id: 'title', name: 'Titles', items: TITLES, defaultId: 'bather' },
];

/** Just the ids, for validating a content pack without importing the tables. */
export const COSMETIC_KIND_IDS = COSMETIC_KINDS.map((k) => k.id);

export const COSMETICS = COSMETIC_KINDS.flatMap((k) => k.items.map((item) => ({ ...item, kind: k.id })));

export const COSMETICS_BY_ID = Object.fromEntries(COSMETICS.map((c) => [`${c.kind}:${c.id}`, c]));

export function cosmeticKey(kind, id) {
  return `${kind}:${id}`;
}

export function cosmeticsOfKind(kind) {
  return COSMETIC_KINDS.find((k) => k.id === kind)?.items ?? [];
}

/** Every skin named here must be a palette the renderer actually has. */
export function skinPaletteExists(id) {
  return Boolean(CAPY_SKINS[id]);
}
