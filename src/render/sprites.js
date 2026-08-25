// Pixel art, hand-drawn as text.
//
// One character per pixel; `.` is transparent. Colour comes from a palette in
// palettes.js, which is what lets ten shapes cover eighteen generators.
// Keeping the art as source means it diffs, reviews, and edits like code —
// and the repo ships with zero binary assets.
//
// Every grid must be perfectly rectangular. tests/sprites.test.js enforces it.

/** Sprite factory. `rows` must all be the same length. */
function sprite(rows) {
  return { w: rows[0].length, h: rows.length, rows };
}

// ---------------------------------------------------------------- the star

/** The capybara you tap. 32×32, chest-deep in the onsen. */
export const CAPY = sprite([
  '................................',
  '..........oo........oo..........',
  '.........oddo......oddo.........',
  '.......oooddooooooooddooo.......',
  '......odlllllllllllllllldo......',
  '......odmlllllllllllllmmdo......',
  '......odmmmoommmmmmoommmdo......',
  '......odmmmewmmmmmmewmmmdo......',
  '......odmmmmmmmmmmmmmmmmdo......',
  '......odmmmmllllllllmmmmdo......',
  '......odmmmmllnnnnllmmmmdo......',
  '......odmmmmllonnollmmmmdo......',
  '......odmmmmmmlkklmmmmmmdo......',
  '......oddmmmmmmmmmmmmmmddo......',
  '.....odmmmmmmmmmmmmmmmmmmdo.....',
  '....odmmmmmmmmmmmmmmmmmmmmdo....',
  '...odmmmmmmmmmmmmmmmmmmmmmmdo...',
  '...odmmmmmmmllllllllmmmmmmmdo...',
  '...odmmmmmmllllllllllmmmmmmdo...',
  '...odmmmmmllllllllllllmmmmmdo...',
  '...odmmmmmllllllllllllmmmmmdo...',
  '...odmmmmmmllllllllllmmmmmmdo...',
  '...odmmmmmmmllllllllmmmmmmmdo...',
  '....odmmmmmmmmmmmmmmmmmmmmdo....',
  '....oddddddddddddddddddddddo....',
  '..aaaaaaaaaaaaaaaaaaaaaaaaaaaa..',
  '.aaaabbbbbbbbbbbbbbbbbbbbbbaaaa.',
  '.abbbbbbbbbbbbbbbbbbbbbbbbbbbba.',
  '..bbbbbbbbbbbbbbbbbbbbbbbbbbbb..',
  '....bbbbbbbbbbbbbbbbbbbbbbbb....',
  '........bbbbbbbbbbbbbbbb........',
  '................................',
]);

// Expressions are patches, not whole frames — a 14×3 overlay stamped at (10, 6)
// over the eye band. Cheap to add moods without redrawing 32×32 each time.
export const EYE_OVERLAY_ORIGIN = { x: 10, y: 6 };

export const EYES = {
  open: sprite([
    '.oo......oo...',
    '.ew......ew...',
    '..............',
  ]),
  blink: sprite([
    '..............',
    '.oo......oo...',
    '..............',
  ]),
  happy: sprite([
    '..o......o....',
    '.o.o....o.o...',
    '..............',
  ]),
  star: sprite([
    '.ww......ww...',
    '.ww......ww...',
    '..............',
  ]),
};

/** The roaming bonus capybara. Small, so it reads as "catch me". */
export const GOLDEN_CAPY = sprite([
  '................',
  '....oo....oo....',
  '...odo....odo...',
  '..oooooooooooo..',
  '.ollllllllllllo.',
  '.ommmeemmeemmmo.',
  '.ommmmmmmmmmmmo.',
  '.ommmmnnnnmmmmo.',
  '.ommmmnnnnmmmmo.',
  '.ommmmmmmmmmmmo.',
  'ommmmmmmmmmmmmmo',
  'ommllllllllllmmo',
  'ommllllllllllmmo',
  '.ommllllllllmmo.',
  '..oommmmmmmmoo..',
  '....oooooooo....',
]);

// -------------------------------------------------------------------- props

/** Floating yuzu. Bobs in the water; the whole aesthetic in eight pixels. */
export const YUZU = sprite([
  '....g...',
  '..ooog..',
  '.oyyyyo.',
  'oyywyyyo',
  'oyyyyyyo',
  'oyyyyyyo',
  '.oyyyyo.',
  '..oooo..',
]);

export const STEAM = sprite([
  '..ssss..',
  '.ssssss.',
  'ssssssss',
  'ssssssss',
  '.ssssss.',
  '..ssss..',
  '........',
  '........',
]);

export const SPARKLE = sprite([
  '..y..',
  '..w..',
  'ywwwy',
  '..w..',
  '..y..',
]);

// ---------------------------------------------------------- generator icons

/**
 * Ten 16×16 shapes. Each generator picks one and recolours it (see
 * BUILDING_ART in palettes.js), which is why eighteen lines look distinct
 * without eighteen hand-drawn icons.
 *
 * Palette slots: o outline, 1 dark, 2 mid, 3 light, 4 accent.
 */
export const ICONS = {
  pad: sprite([
    '................',
    '................',
    '.....oooooo.....',
    '...oo333333oo...',
    '..o3333333333o..',
    '.o333322223333o.',
    'o33322222222333o',
    'o33222222222233o',
    'o33222222222233o',
    'o33322222222333o',
    '.o333322223333o.',
    '..o3333333333o..',
    '...oo333333oo...',
    '.....oooooo.....',
    '................',
    '................',
  ]),

  tree: sprite([
    '................',
    '......oooo......',
    '....oo3333oo....',
    '..oo33333333oo..',
    '.o333433334333o.',
    '.o333322223333o.',
    '.o334333333433o.',
    '..o3333333333o..',
    '...oo333333oo...',
    '.....oo11oo.....',
    '.......11.......',
    '.......11.......',
    '......o11o......',
    '.....o1111o.....',
    '....oo2222oo....',
    '................',
  ]),

  pool: sprite([
    '................',
    '................',
    '..oooooooooooo..',
    '.o111111111111o.',
    'o11444444444411o',
    'o14444444444441o',
    'o14444344444441o',
    'o14444444344441o',
    'o14444444444441o',
    'o14434444444441o',
    'o14444444444441o',
    'o11444444444411o',
    '.o111111111111o.',
    '.o222222222222o.',
    '..oooooooooooo..',
    '................',
  ]),

  hut: sprite([
    '................',
    '.......oo.......',
    '......o22o......',
    '.....o2222o.....',
    '....o222222o....',
    '...o22222222o...',
    '..o2222222222o..',
    '.o222222222222o.',
    'oooooooooooooooo',
    '.o333333333333o.',
    '.o344333333443o.',
    '.o344333333443o.',
    '.o333333333333o.',
    '.o331111111133o.',
    '.oo1111111111oo.',
    '................',
  ]),

  tower: sprite([
    '......oooo......',
    '.....o2222o.....',
    '....o222222o....',
    '...oo222222oo...',
    '...o33333333o...',
    '...o34333343o...',
    '...o33333333o...',
    '...oo333333oo...',
    '..o3333333333o..',
    '..o3444444443o..',
    '..o3333333333o..',
    '..o3444444443o..',
    '..o3333333333o..',
    '.o333333333333o.',
    '.o111111111111o.',
    '.oooooooooooooo.',
  ]),

  arch: sprite([
    '................',
    '.oooooooooooooo.',
    '.o444444444444o.',
    '.oooooooooooooo.',
    '...o22222222o...',
    '..oooooooooooo..',
    '..o22o....o22o..',
    '..o22o....o22o..',
    '..o22o....o22o..',
    '..o22o....o22o..',
    '..o22o....o22o..',
    '..o22o....o22o..',
    '..o22o....o22o..',
    '.oo22oo..oo22oo.',
    '.o1111o..o1111o.',
    '.oooooo..oooooo.',
  ]),

  orb: sprite([
    '................',
    '.....oooooo.....',
    '...oo444444oo...',
    '..o4444444444o..',
    '.o444333344444o.',
    'o44433333344444o',
    'o44433333344444o',
    'o44443333444444o',
    'o44444444444444o',
    'o44444444444444o',
    '.o444444444444o.',
    '..o4444444444o..',
    '...oo444444oo...',
    '.....oooooo.....',
    '................',
    '................',
  ]),

  crystal: sprite([
    '.......oo.......',
    '......o44o......',
    '......o44o......',
    '.....o4444o.....',
    '..oo.o4444o.oo..',
    '.o44oo4444oo44o.',
    '.o444o4444o444o.',
    '.o444o4334o444o.',
    '.o444o4334o444o.',
    '.o444o4444o444o.',
    '.o444o4444o444o.',
    '..o44o4444o44o..',
    '..oo1o4444o1oo..',
    '....o111111o....',
    '...oo111111oo...',
    '...oooooooooo...',
  ]),

  portal: sprite([
    '................',
    '.....oooooo.....',
    '...oo444444oo...',
    '..o4444444444o..',
    '.o4444oooo4444o.',
    '.o444o3333o444o.',
    'o4444o3333o4444o',
    'o4444o3113o4444o',
    'o4444o3113o4444o',
    'o4444o3333o4444o',
    '.o444o3333o444o.',
    '.o4444oooo4444o.',
    '..o4444444444o..',
    '...oo444444oo...',
    '.....oooooo.....',
    '................',
  ]),

  star: sprite([
    '.......44.......',
    '.......44.......',
    '.....o4444o.....',
    '......4444......',
    '..4...4444...4..',
    '...4.o4444o.4...',
    '...4444444444...',
    '4444o333333o4444',
    '4444o333333o4444',
    '...4444444444...',
    '...4.o4444o.4...',
    '..4...4444...4..',
    '......4444......',
    '.....o4444o.....',
    '.......44.......',
    '.......44.......',
  ]),
};

// ------------------------------------------------------------------ helpers

/** All sprites in one bag, for the dimension test and the preloader. */
export const ALL_SPRITES = {
  CAPY,
  GOLDEN_CAPY,
  YUZU,
  STEAM,
  SPARKLE,
  ...Object.fromEntries(Object.entries(EYES).map(([k, v]) => [`EYES_${k}`, v])),
  ...Object.fromEntries(Object.entries(ICONS).map(([k, v]) => [`ICON_${k}`, v])),
};

/** Returns a list of problems; empty means the grid is well-formed. */
export function validateSprite(name, spr) {
  const problems = [];
  if (!spr || !Array.isArray(spr.rows) || spr.rows.length === 0) {
    problems.push(`${name}: no rows`);
    return problems;
  }
  if (spr.h !== spr.rows.length) {
    problems.push(`${name}: h=${spr.h} but has ${spr.rows.length} rows`);
  }
  spr.rows.forEach((row, y) => {
    if (row.length !== spr.w) {
      problems.push(`${name}: row ${y} is ${row.length} wide, expected ${spr.w}`);
    }
  });
  return problems;
}

/** Every distinct character used by a sprite — handy for palette coverage tests. */
export function spriteChars(spr) {
  const set = new Set();
  for (const row of spr.rows) for (const ch of row) set.add(ch);
  return set;
}
