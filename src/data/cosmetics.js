// Cosmetics: how the capybara looks, what the pond looks like, and what the
// game calls you.
//
// Everything here is earned *or* bought. Nothing in this file affects a single
// number in the simulation — that is the promise, and it is what makes buying
// one of these an aesthetic choice rather than a power one.
//
// Six kinds, all of which actually render. There is no seventh kind listed as
// "coming soon" and no option that does nothing when you pick it.
//
//   skin       the capybara's palette      render/palettes.js CAPY_SKINS
//   pond       the page and water colours  a data-pond attribute on <body>
//   title      a line under your zen count the HUD
//   hat        a layer over the ears       render/wearables.js
//   outfit     a layer over the body       render/wearables.js
//   accessory  a small patch anywhere      render/wearables.js
//
// The three wearable kinds each open with a "bare" entry, free from the start.
// That is not a placeholder: taking a hat *off* has to be as available as
// putting one on, and every kind needs a free default anyway.
//
// Prices come from five bands rather than being picked per item, so a mythic
// hat and a mythic outfit cost the same and the ladder stays legible from
// inside the shop.

import { CAPY_SKINS } from '../render/palettes.js';

/** The price ladder, in leafs. A band is the whole of what a look costs. */
export const BANDS = {
  common: 120,
  rare: 260,
  epic: 480,
  legendary: 850,
  mythic: 1400,
};

/** A store row: the band sets the price and labels the card. */
function sold(band) {
  return { source: 'store', band, cost: BANDS[band] };
}

/** An earned row. The counters are the ones systems/cosmetics.js gathers. */
function earned(need) {
  return { source: 'play', need };
}

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

  { id: 'ember', name: 'Ember', ...earned({ bossKills: 400 }), blurb: 'Beat four hundred bosses.' },
  { id: 'cocoa', name: 'Cocoa', ...earned({ logins: 30 }), blurb: 'Log in thirty days.' },
  { id: 'slate', name: 'Slate', ...sold('rare'), blurb: 'Grey, and unbothered about it.' },
  { id: 'mint', name: 'Mint', ...sold('rare'), blurb: 'Suspiciously fresh for something that never leaves the water.' },
  { id: 'plum', name: 'Plum', ...sold('epic'), blurb: 'The exact colour of the hour after sunset.' },
  { id: 'sand', name: 'Sand', source: 'pass', blurb: 'Free pass, level 37. Warm from the bank.' },
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

  { id: 'mist', name: 'Mist', ...earned({ drops: 400 }), blurb: 'Find four hundred pieces of gear.' },
  { id: 'bamboo', name: 'Bamboo', ...sold('rare'), blurb: 'Somebody planted a screen. It worked.' },
  { id: 'glacier', name: 'Glacier', ...sold('epic'), blurb: 'Cold at the edges, warm in the middle.' },
  { id: 'starlight', name: 'Starlight', source: 'pass', blurb: 'Premium pass, level 61. The sky came down for a look.' },
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


// ----------------------------------------------------------------- wearables
//
// Eight hat shapes, six outfit shapes and five accessory shapes, wearing
// different palettes — see render/wearables.js for the grids and for why the
// colours are the cheap part. Every id here must have art there and vice versa;
// tests/wearables.test.js checks both directions, because a look in the shop
// that draws nothing is worse than a look that does not exist.

export const HATS = [
  { id: 'none', name: 'Bare', source: 'start', blurb: 'No hat. A perfectly good look.' },

  // straw — the shape that reads as "hat" from furthest away
  { id: 'strawBoater', name: 'Straw Boater', ...sold('common'), blurb: 'For a capybara with somewhere to be.' },
  { id: 'sunHat', name: 'Sun Hat', ...earned({ logins: 5 }), blurb: 'Log in five days.' },
  { id: 'paperParasol', name: 'Paper Parasol', ...sold('rare'), blurb: 'Shade, carried on the head, at all times.' },

  // beanie
  { id: 'woollyHat', name: 'Woolly Hat', ...sold('common'), blurb: 'Warm. Redundant. Worn anyway.' },
  { id: 'nightCap', name: 'Night Cap', ...earned({ logins: 14 }), blurb: 'Log in fourteen days.' },
  { id: 'mossCap', name: 'Moss Cap', ...earned({ drops: 50 }), blurb: 'Find fifty pieces of gear.' },

  // crown
  { id: 'reedCrown', name: 'Reed Crown', ...earned({ bossKills: 25 }), blurb: 'Beat twenty-five bosses.' },
  { id: 'goldCrown', name: 'Gold Crown', ...sold('legendary'), blurb: 'Nobody voted. Nobody objected either.' },
  { id: 'iceCrown', name: 'Ice Crown', ...earned({ bossKills: 250 }), blurb: 'Beat two hundred and fifty bosses.' },

  // band
  { id: 'headband', name: 'Headband', ...sold('common'), blurb: 'Signals an intention to exert oneself.' },
  { id: 'sweatband', name: 'Sweatband', ...earned({ bestDepth: 100 }), blurb: 'Reach stage 10.' },
  { id: 'laurel', name: 'Laurel', source: 'pass', blurb: 'Free pass, level 11. Awarded for something.' },

  // top
  { id: 'topHat', name: 'Top Hat', ...sold('epic'), blurb: 'Absurd on a capybara. That is the appeal.' },
  { id: 'chimney', name: 'The Chimney', ...sold('rare'), blurb: 'Taller than strictly necessary.' },
  { id: 'conjurer', name: "Conjurer's Hat", source: 'pass', blurb: 'Premium pass, level 31. Something may be inside.' },

  // flower
  { id: 'yuzuBlossom', name: 'Yuzu Blossom', ...earned({ goldens: 10 }), blurb: 'Catch ten golden capybaras.' },
  { id: 'sakuraSprig', name: 'Sakura Sprig', ...sold('common'), blurb: 'It fell there. It stayed.' },
  { id: 'lotusBud', name: 'Lotus Bud', ...earned({ rebirths: 3 }), blurb: 'Rebirth three times.' },

  // horns
  { id: 'littleHorns', name: 'Little Horns', ...sold('rare'), blurb: 'Entirely decorative. Probably.' },
  { id: 'antlers', name: 'Antlers', ...earned({ bestStars: 3 }), blurb: 'Refine a piece to three stars.' },
  { id: 'emberHorns', name: 'Ember Horns', source: 'pass', blurb: 'Premium pass, level 77. Warm to the touch.' },

  // hood
  { id: 'towelHood', name: 'Towel Hood', ...earned({ logins: 3 }), blurb: 'Log in three days.' },

  // wig
  { id: 'looseWaves', name: 'Loose Waves', ...sold('common'), blurb: 'Down, and entirely unbothered by the water.' },
  { id: 'braid', name: 'Braid', ...earned({ bestStars: 3 }), blurb: 'Refine a piece to three stars.' },
  { id: 'updo', name: 'Updo', ...sold('epic'), blurb: 'Held with what is, on inspection, a chopstick.' },
];

export const OUTFITS = [
  { id: 'none', name: 'Bare', source: 'start', blurb: 'Fur, and the water. The original arrangement.' },

  // scarf
  { id: 'redScarf', name: 'Red Scarf', ...sold('common'), blurb: 'The classic. Slightly damp at all times.' },
  { id: 'stripedScarf', name: 'Striped Scarf', ...earned({ logins: 10 }), blurb: 'Log in ten days.' },
  { id: 'silkScarf', name: 'Silk Scarf', ...sold('epic'), blurb: 'Far too good for a hot spring.' },

  // apron
  { id: 'bathAttendant', name: 'Bath Attendant', ...earned({ bossKills: 10 }), blurb: 'Beat ten bosses.' },
  { id: 'chefApron', name: "Cook's Apron", ...sold('rare'), blurb: 'Has never been near a kitchen.' },
  { id: 'gardenApron', name: 'Garden Apron', ...earned({ drops: 150 }), blurb: 'Find a hundred and fifty pieces of gear.' },

  // vest
  { id: 'reedVest', name: 'Reed Vest', ...sold('common'), blurb: 'Woven from the bank, more or less.' },
  { id: 'leatherVest', name: 'Leather Vest', ...earned({ bestStars: 2 }), blurb: 'Refine a piece to two stars.' },
  { id: 'lifeVest', name: 'Life Vest', ...sold('rare'), blurb: 'The water is forty centimetres deep.' },

  // towel
  { id: 'onsenTowel', name: 'Onsen Towel', ...earned({ goldens: 25 }), blurb: 'Catch twenty-five golden capybaras.' },
  { id: 'yuzuTowel', name: 'Yuzu Towel', source: 'pass', blurb: 'Free pass, level 23. Smells of citrus.' },
  { id: 'mossTowel', name: 'Moss Towel', ...sold('common'), blurb: 'Left out one season too many.' },

  // cloak
  { id: 'nightCloak', name: 'Night Cloak', ...earned({ rebirths: 5 }), blurb: 'Rebirth five times.' },
  { id: 'emberCloak', name: 'Ember Cloak', source: 'pass', blurb: 'Premium pass, level 47. Steams gently.' },
  { id: 'frostCloak', name: 'Frost Cloak', ...sold('legendary'), blurb: 'Colder than the pond it is worn in.' },

  // collar
  { id: 'bellCollar', name: 'Bell Collar', ...sold('common'), blurb: 'You will always know where it is.' },
  { id: 'leafCollar', name: 'Leaf Collar', ...earned({ bestDepth: 50 }), blurb: 'Reach stage 5.' },
  { id: 'starCollar', name: 'Star Collar', ...sold('mythic'), blurb: 'Somebody made this at enormous expense.' },

  // dress
  { id: 'sunDress', name: 'Sun Dress', ...sold('common'), blurb: 'Practical. Occasionally gets wet on purpose.' },
  { id: 'pondGown', name: 'Pond Gown', ...earned({ bestDepth: 150 }), blurb: 'Reach stage 15.' },
  { id: 'festivalKimono', name: 'Festival Kimono', ...sold('legendary'), blurb: 'Too good for the water. Worn in it anyway.' },
];

export const ACCESSORIES = [
  { id: 'none', name: 'Bare', source: 'start', blurb: 'Nothing extra. Restful.' },

  { id: 'roundGlasses', name: 'Round Glasses', ...sold('common'), blurb: 'The prescription is zero.' },
  { id: 'sunglasses', name: 'Sunglasses', ...earned({ goldens: 100 }), blurb: 'Catch a hundred golden capybaras.' },
  { id: 'readingGlasses', name: 'Reading Glasses', ...sold('rare'), blurb: 'For the small print on the upgrades.' },

  { id: 'redBandana', name: 'Red Bandana', ...sold('common'), blurb: 'Suggests a plan.' },
  { id: 'blueBandana', name: 'Blue Bandana', ...earned({ bestDepth: 200 }), blurb: 'Reach stage 20.' },

  { id: 'soapBubble', name: 'Soap Bubble', ...earned({ goldens: 5 }), blurb: 'Catch five golden capybaras.' },
  { id: 'yuzuFloat', name: 'Yuzu Float', source: 'pass', blurb: 'Free pass, level 57. One more, hovering.' },
  { id: 'paperLantern', name: 'Paper Lantern', ...sold('epic'), blurb: 'Nobody is holding it up.' },

  { id: 'rubberDuck', name: 'Rubber Duck', ...earned({ bestStars: 4 }), blurb: 'Refine a piece to four stars.' },
  { id: 'toyBoat', name: 'Toy Boat', source: 'pass', blurb: 'Premium pass, level 17. Making very slow progress.' },

  { id: 'blush', name: 'Blush', ...sold('common'), blurb: 'The water is warm and it shows.' },
  { id: 'warPaint', name: 'War Paint', ...earned({ bossKills: 60 }), blurb: 'Beat sixty bosses.' },

  { id: 'hairRibbon', name: 'Hair Ribbon', ...sold('rare'), blurb: 'Pinned in beside one ear. Stays, somehow.' },
];

/** kind -> the table, so the panel and the systems agree on what exists. */
export const COSMETIC_KINDS = [
  { id: 'skin', name: 'Skins', items: SKINS, defaultId: 'classic' },
  { id: 'pond', name: 'Ponds', items: PONDS, defaultId: 'dusk' },
  { id: 'title', name: 'Titles', items: TITLES, defaultId: 'bather' },
  { id: 'hat', name: 'Hats', items: HATS, defaultId: 'none' },
  { id: 'outfit', name: 'Outfits', items: OUTFITS, defaultId: 'none' },
  { id: 'accessory', name: 'Extras', items: ACCESSORIES, defaultId: 'none' },
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
