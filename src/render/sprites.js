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
 * Thirty 16×16 shapes, in ten families of three.
 *
 * A generator picks a *family* (see BUILDINGS in data/buildings.js) and gets
 * its colour from BUILDING_ART in palettes.js, which is why forty-eight lines
 * look distinct without forty-eight hand-drawn icons.
 *
 * The three within a family are one thing at three sizes of ambition: a pad, a
 * spread of pads, a whole field of them. Which one is drawn depends on how many
 * tier upgrades that line has bought — see `buildingStage`. That is the rule the
 * pond runs on: units make the thing bigger, an upgrade makes it a different
 * thing.
 *
 * The stage-one drawings are the original ten, unchanged. A save from 3.0 draws
 * exactly what it drew before until its first upgrade.
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

  // ------------------------------------------------------------- stage two
  // The same thing, having got somewhere. More of it, or better built.

  // Two small pads and one large one, rather than three lumps. The first
  // version of this drew overlapping blobs of slightly different sizes and read
  // as spilt paint — pads need their outlines to stay closed to read as pads.
  padSpread: sprite([
    '.ooooo..ooooo...',
    'o33333oo33333o..',
    'o32223oo32223o..',
    'o32223oo32223o..',
    'o33333oo33333o..',
    '.ooooo..ooooo...',
    '....oooooooo....',
    '..oo33333333oo..',
    '.o333333333333o.',
    'o33332222223333o',
    'o33222222222233o',
    'o33222222222233o',
    'o33332222223333o',
    '.o333333333333o.',
    '..oo33333333oo..',
    '....oooooooo....',
  ]),

  grove: sprite([
    '................',
    '...oo......oo...',
    '..o33o....o33o..',
    '.o3433o..o3343o.',
    'o333333oo333333o',
    'o334333oo333433o',
    'o333333oo333333o',
    '.o3333o..o3333o.',
    '..o11o....o11o..',
    '...11......11...',
    '...11......11...',
    '...11......11...',
    '..o11o....o11o..',
    '..oooo....oooo..',
    '................',
    '................',
  ]),

  // A jet with two droplets beside it. Three attempts: a pair of one-pixel
  // lines that vanished at any size the pond uses; a solid triangle that read
  // as a tent pitched on the basin; and a fanned spray whose converging
  // diagonals read, in the pond, as an arrow pointing down into the water.
  spring: sprite([
    '.....3.33.3.....',
    '......3333......',
    '.......33.......',
    '.......33.......',
    '.......33.......',
    '..oooooooooooo..',
    '.o111111111111o.',
    'o11444444444411o',
    'o14444333444441o',
    'o14443333344441o',
    'o14444333444441o',
    'o11444444444411o',
    '.o111111111111o.',
    '.o222222222222o.',
    '..oooooooooooo..',
    '................',
  ]),

  lodge: sprite([
    '................',
    '...oo......oo...',
    '..o22o....o22o..',
    '.o2222o..o2222o.',
    'o222222oo222222o',
    'oooooooooooooooo',
    '.o333333333333o.',
    '.o344333333443o.',
    '.o344333333443o.',
    '.o333333333333o.',
    '.o333333333333o.',
    '.o344333333443o.',
    '.o344333333443o.',
    '.o331111111133o.',
    '.oo1111111111oo.',
    '................',
  ]),

  spire: sprite([
    '.......oo.......',
    '......o44o......',
    '......o22o......',
    '.....o2222o.....',
    '.....o2222o.....',
    '....oo2222oo....',
    '....o333333o....',
    '....o343343o....',
    '....o333333o....',
    '...oo333333oo...',
    '...o33333333o...',
    '...o34333343o...',
    '...o33333333o...',
    '..o3333333333o..',
    '..o1111111111o..',
    '..oooooooooooo..',
  ]),

  shrine: sprite([
    '................',
    'oooooooooooooooo',
    'o44444444444444o',
    'oooooooooooooooo',
    '..oooooooooooo..',
    '..o4444444444o..',
    '..oooooooooooo..',
    '...o22o..o22o...',
    '...o22o..o22o...',
    '...o22o..o22o...',
    '...o22o..o22o...',
    '...o22o..o22o...',
    '..oo22oo.oo22oo.',
    '.o111111111111o.',
    'oooooooooooooooo',
    '................',
  ]),

  // Three orbs at eight pixels across, not six. At six the outline ate most of
  // the fill and the contact sheet showed four grey squares.
  orbCluster: sprite([
    '..oooo....oooo..',
    '.o4444o..o4444o.',
    'o433334oo433334o',
    'o433334oo433334o',
    'o444444oo444444o',
    'o444444oo444444o',
    '.o4444o..o4444o.',
    '..oooo....oooo..',
    '......oooo......',
    '.....o4444o.....',
    '....o433334o....',
    '....o433334o....',
    '....o444444o....',
    '....o444444o....',
    '.....o4444o.....',
    '......oooo......',
  ]),

  geode: sprite([
    '....oooooooo....',
    '..oo11111111oo..',
    '.o111111111111o.',
    'o11144444444111o',
    'o11443333444411o',
    'o14433333334441o',
    'o14333333333441o',
    'o14333443333441o',
    'o14334433333441o',
    'o14333333333441o',
    'o14433333334441o',
    'o11443333444411o',
    'o11144444444111o',
    '.o111111111111o.',
    '..oo11111111oo..',
    '....oooooooo....',
  ]),

  gate: sprite([
    '................',
    '..oooooooooooo..',
    '.o444444444444o.',
    '.o44oooooooo44o.',
    '.o44o333333o44o.',
    '.o4o33333333o4o.',
    '.o4o33111133o4o.',
    '.o4o33111133o4o.',
    '.o4o33111133o4o.',
    '.o4o33111133o4o.',
    '.o4o33111133o4o.',
    '.o44o333333o44o.',
    '.o444444444444o.',
    '.oo4444444444oo.',
    '..oooooooooooo..',
    '................',
  ]),

  nova: sprite([
    '.......44.......',
    '...4...44...4...',
    '....4o4444o4....',
    '.....o4444o.....',
    '..4..o4444o..4..',
    '...4.o4444o.4...',
    '...4444444444...',
    '4444o333333o4444',
    '4444o333333o4444',
    '...4444444444...',
    '...4.o4444o.4...',
    '..4..o4444o..4..',
    '.....o4444o.....',
    '....4o4444o4....',
    '...4...44...4...',
    '.......44.......',
  ]),

  // ----------------------------------------------------------- stage three
  // The full expression. Whole fields, whole cities, whole galaxies.

  padField: sprite([
    '................',
    '..oo..oo..oo....',
    '.o22oo22oo22o...',
    '.o22oo22oo22o...',
    '..oo..oo..oo....',
    '................',
    '.oooo.oooo.oooo.',
    'o3333o3333o3333o',
    'o3223o3223o3223o',
    'o3333o3333o3333o',
    '.oooo.oooo.oooo.',
    '................',
    '.ooooo...ooooo..',
    'o33333o.o33333o.',
    'o33333o.o33333o.',
    '.ooooo...ooooo..',
  ]),

  orchard: sprite([
    '................',
    '.ooo..ooo..ooo..',
    'o333oo333oo333o.',
    'o343oo343oo343o.',
    'o333oo333oo333o.',
    '.o1o..o1o..o1o..',
    '..1....1....1...',
    '.ooo..ooo..ooo..',
    '................',
    '.ooo..ooo..ooo..',
    'o333oo333oo333o.',
    'o343oo343oo343o.',
    'o333oo333oo333o.',
    '.o1o..o1o..o1o..',
    '..1....1....1...',
    '.oooooooooooooo.',
  ]),

  cascade: sprite([
    '....oooooooo....',
    '...o44444444o...',
    '...o43444434o...',
    '...oo444444oo...',
    '....o111111o....',
    '..oooooooooooo..',
    '.o444444444444o.',
    '.o443444444344o.',
    '.oo4444444444oo.',
    '..o1111111111o..',
    'oooooooooooooooo',
    'o44444444444444o',
    'o44344444444344o',
    'o44444444444444o',
    'o11111111111111o',
    'oooooooooooooooo',
  ]),

  village: sprite([
    '..o....o.....o..',
    '.o2o..o2o...o2o.',
    'o222oo222o.o222o',
    'oooooooooo.ooooo',
    'o333oo333o.o333o',
    'o343oo343o.o343o',
    'o111oo111o.o111o',
    'oooooooooo.ooooo',
    '................',
    '...o.......o....',
    '..o2o.....o2o...',
    '.o222o...o222o..',
    '.ooooo...ooooo..',
    '.o333o...o333o..',
    '.o111o...o111o..',
    '.ooooo...ooooo..',
  ]),

  citadel: sprite([
    '.......oo.......',
    '......o44o......',
    '......o33o......',
    '.....oo33oo.....',
    '..oo.o3333o.oo..',
    '.o44oo3333oo44o.',
    '.o33oo3443oo33o.',
    '.o33oo3333oo33o.',
    '.o33oo3333oo33o.',
    '.o333333333333o.',
    '.o344333333443o.',
    '.o333333333333o.',
    'o33333333333333o',
    'o34433333333443o',
    'o11111111111111o',
    'oooooooooooooooo',
  ]),

  temple: sprite([
    '....oooooooo....',
    '..oo44444444oo..',
    '.o444444444444o.',
    'oooooooooooooooo',
    '..o4444444444o..',
    '.oooooooooooooo.',
    '.o22o.o22o.o22o.',
    '.o22o.o22o.o22o.',
    '.o22o.o22o.o22o.',
    '.o22o.o22o.o22o.',
    '.o22o.o22o.o22o.',
    '.o22o.o22o.o22o.',
    '.oooo.oooo.oooo.',
    'oooooooooooooooo',
    'o11111111111111o',
    'oooooooooooooooo',
  ]),

  // A system: one large body with four satellites. The first draft drew a ring
  // of orbs joined by single-pixel lines and rendered as an empty necklace —
  // the lines were invisible and the orbs were hollow.
  constellation: sprite([
    '.oo......oo.....',
    'o44o....o44o....',
    '.oo......oo.....',
    '......oooo......',
    '.....o4444o.....',
    '....o433334o....',
    '....o433334o....',
    '....o444444o....',
    '....o444444o....',
    '.....o4444o.....',
    '......oooo......',
    '.....oo....oo...',
    '....o44o..o44o..',
    '....o44o..o44o..',
    '.....oo....oo...',
    '................',
  ]),

  monolith: sprite([
    '......oooo......',
    '......o44o......',
    '.....o4444o.....',
    '.....o4334o.....',
    '.....o4334o.....',
    '.....o4334o.....',
    '.....o4334o.....',
    '.....o4334o.....',
    '.....o4334o.....',
    '.....o4334o.....',
    '.....o4334o.....',
    '....o433334o....',
    '...o44333344o...',
    '..o1111111111o..',
    '.oo1111111111oo.',
    '.oooooooooooooo.',
  ]),

  nexus: sprite([
    '...4.......4....',
    '....4.....4.....',
    '.....oooooo.....',
    '...oo444444oo...',
    '..o4444444444o..',
    '.o4444oooo4444o.',
    '4o444o3333o444o4',
    '4o444o3113o444o4',
    '4o444o3113o444o4',
    '4o444o3333o444o4',
    '.o4444oooo4444o.',
    '..o4444444444o..',
    '...oo444444oo...',
    '.....oooooo.....',
    '....4.....4.....',
    '...4.......4....',
  ]),

  // Tilted and asymmetric, with a bar across the core. The symmetric version
  // this replaces was a perfect ellipse and read as an eye — or, worse, as the
  // orb three rows above it on the contact sheet.
  galaxy: sprite([
    '................',
    '.....444444.....',
    '...4444444444...',
    '..44444444444...',
    '.4444oooo4444...',
    '.444o333333o44..',
    '..44o33333333o4.',
    '..4o3334433333o4',
    '4o33334433333o4.',
    '.4o33333333o44..',
    '..44o333333o444.',
    '...4444oooo4444.',
    '...444444444444.',
    '....4444444444..',
    '.....444444.....',
    '................',
  ]),
};

/**
 * The ten families, stage one to stage three.
 *
 * A generator names a family; which of the three it draws depends on how many
 * of its tier upgrades are bought. Kept here rather than in the data, so adding
 * a drawing and wiring it up is one edit in one file.
 */
export const SHAPE_FAMILIES = {
  pad: ['pad', 'padSpread', 'padField'],
  tree: ['tree', 'grove', 'orchard'],
  pool: ['pool', 'spring', 'cascade'],
  hut: ['hut', 'lodge', 'village'],
  tower: ['tower', 'spire', 'citadel'],
  arch: ['arch', 'shrine', 'temple'],
  orb: ['orb', 'orbCluster', 'constellation'],
  crystal: ['crystal', 'geode', 'monolith'],
  portal: ['portal', 'gate', 'nexus'],
  star: ['star', 'nova', 'galaxy'],
};

/**
 * The drawing for a family at a stage.
 *
 * The single place shape is decided, deliberately. BUILDING_ART used to carry
 * its own `shape` alongside the generator's `family`, which is two facts that
 * have to agree and no way to notice when they stop — a palette saying `tree`
 * for a generator whose family is `pad` would render happily and wrongly. The
 * palette table is colour now, and this is shape.
 *
 * Out-of-range stages clamp rather than throwing. A save carrying a tier
 * upgrade for a generator that has since lost one should draw the last stage it
 * has art for, not take the pond down with it.
 */
export function familyShape(family, stage = 0) {
  const stages = SHAPE_FAMILIES[family];
  if (!stages) return null;
  const at = Math.min(Math.max(Math.floor(stage) || 0, 0), stages.length - 1);
  return stages[at];
}

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
