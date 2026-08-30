// What the capybara wears.
//
// Hats, outfits and accessories, drawn the way everything else in this project
// is drawn: hand-made character grids resolved through a palette map. Nineteen
// shapes cover fifty-two items between them, which is the same trick that lets
// ten shapes cover eighteen generators — draw the silhouette once, and let the
// colours do the rest of the work.
//
// ## The uppercase rule
//
// The capybara's own grid uses lowercase characters: `o d m l n e w k a b`.
// Every grid in this file uses **uppercase only**. That is not a style choice —
// canvas.js merges the palettes rather than keeping them per-layer, so a hat
// that used `m` would repaint the whole body and read as a renderer bug several
// screens away from its cause. tests/wearables.test.js refuses a lowercase
// character in any grid here.
//
// The five slots every palette fills:
//
//   O  outline      A  main       B  shade
//   C  highlight    D  accent
//
// ## Where things sit on the 32×32 capybara
//
//   rows 0–5    ears and the top of the head        hats live here
//   rows 6–8    the eye band                         glasses
//   rows 9–12   muzzle and chin                      neckwear
//   rows 13–23  chest and body                       outfits
//   rows 24–30  the waterline and the pool           floating things
//
// An outfit stops at row 23 on purpose: row 24 is the bottom outline and
// everything below it is water. A shirt painted onto the pool is the kind of
// mistake that looks fine in one pose and wrong in every other.

function sprite(rows) {
  return { w: rows[0].length, h: rows.length, rows };
}

/** Five colours, in the order a palette is easiest to read. */
export function wearPalette(outline, main, shade, highlight, accent) {
  return { O: outline, A: main, B: shade, C: highlight, D: accent };
}

// ---------------------------------------------------------------------- hats
//
// 24 wide × 6 tall, stamped at (4, 0) — so grid x 0 is capybara x 4, and the
// ears (capybara x 10–11 and 19–20) fall at grid x 6–7 and 15–16. A hat that
// wants to leave the ears out simply leaves those columns transparent.

export const HAT_ORIGIN = { x: 4, y: 0 };

export const HAT_SHAPES = {
  /** Wide brim, low dome. The one that reads as "hat" from furthest away. */
  straw: sprite([
    '........................',
    '........................',
    '.......OOOOOOOOOO.......',
    '......OAAAAAAAAAAO......',
    '..OOOOOOOOOOOOOOOOOOOO..',
    '..OBBBBBBBBBBBBBBBBBBO..',
  ]),

  /** Snug, pulled down over the ears. */
  beanie: sprite([
    '........................',
    '.....OOOOOOOOOOOOOO.....',
    '....OAAAAAAAAAAAAAAO....',
    '...OAAAAAAAAAAAAAAAAO...',
    '...OCCCCCCCCCCCCCCCCO...',
    '...OOOOOOOOOOOOOOOOOO...',
  ]),

  /** Points, and a band with three stones in it. */
  crown: sprite([
    '.....O..O..OO..O..O.....',
    '.....OOOOOOOOOOOOOO.....',
    '.....OAAAAAAAAAAAAO.....',
    '.....OADAAAADAAAADO.....',
    '.....OOOOOOOOOOOOOO.....',
    '........................',
  ]),

  /** A thin band. Sits on the head rather than over it, so ears stay out. */
  band: sprite([
    '........................',
    '........................',
    '........................',
    '........................',
    '...OOOOOOOOOOOOOOOOOO...',
    '...OAAAADAAAAAADAAAAO...',
  ]),

  /** Tall, with a brim. Absurd on a capybara, which is the point. */
  top: sprite([
    '.......OOOOOOOOOO.......',
    '.......OAAAAAAAAO.......',
    '.......OAAAAAAAAO.......',
    '.......OCCCCCCCCO.......',
    '....OOOOOOOOOOOOOOOO....',
    '....OBBBBBBBBBBBBBBO....',
  ]),

  /** Tucked behind one ear. Small, off-centre, deliberately asymmetric. */
  flower: sprite([
    '........................',
    '........................',
    '................OO......',
    '...............OAAO.....',
    '...............OADAO....',
    '................OO......',
  ]),

  /** Two of them, short and blunt. */
  horns: sprite([
    '......OO..........OO....',
    '.....OAAO........OAAO...',
    '.....OAAO........OAAO...',
    '.....OOOO........OOOO...',
    '........................',
    '........................',
  ]),

  /** Framing the face, open at the front. */
  hood: sprite([
    '........................',
    '....OOOOOOOOOOOOOOOO....',
    '...OAAAAAAAAAAAAAAAAO...',
    '..OAAAAAAAAAAAAAAAAAAO..',
    '..OA................AO..',
    '..OB................BO..',
  ]),

  /**
   * Loose waves, styled to read as hair rather than headwear. Notched at the
   * ear columns (grid x 6–7 and 15–16, same as `crown` and `band`) so the ears
   * still show through, then falls wide past them.
   */
  wig: sprite([
    '........................',
    '.......OAAAAAAAAO.......',
    '.....OAAAAAAAAAAAAO.....',
    '...OAA..AAAAAAA..AAAO...',
    '.OAAAAAAAAAAAAAAAAAAAAO.',
    '.OOOOOOOOOOOOOOOOOOOOOO.',
  ]),
};

// ------------------------------------------------------------------- outfits
//
// 26 wide × 11 tall at (3, 13) — capybara rows 13 through 23, which is the
// chest and body and nothing below the waterline.

export const OUTFIT_ORIGIN = { x: 3, y: 13 };

export const OUTFIT_SHAPES = {
  /** Wound round the neck, hanging at the front. */
  scarf: sprite([
    '...OOOOOOOOOOOOOOOOOOOO...',
    '..OAAAAAAAAAAAAAAAAAAAAO..',
    '..OBBBBBBBBBBBBBBBBBBBBO..',
    '.........OAAAO............',
    '.........OAAAO............',
    '.........OBBBO............',
    '.........OOOOO............',
    '..........................',
    '..........................',
    '..........................',
    '..........................',
  ]),

  /** A front panel with two ties. */
  apron: sprite([
    '..........................',
    '..........................',
    '..........................',
    '..........................',
    '......OOOOOOOOOOOOOO......',
    '......OAAAAAAAAAAAAO......',
    '.....OAAAAAAAAAAAAAAO.....',
    '.....OAAAAAAAAAAAAAAO.....',
    '.....OABAAAAAAAABAAAO.....',
    '......OAAAAAAAAAAAAO......',
    '.......OOOOOOOOOOOO.......',
  ]),

  /** Two panels down the sides, open at the middle. */
  vest: sprite([
    '..........................',
    '..........................',
    '..........................',
    '....OOOO..........OOOO....',
    '....OAAO..........OAAO....',
    '....OAAO..........OAAO....',
    '....OAAO..........OAAO....',
    '....OAAO..........OAAO....',
    '....OABO..........OBAO....',
    '.....OO............OO.....',
    '..........................',
  ]),

  /** A wide band across the middle, with a stripe. */
  towel: sprite([
    '..........................',
    '..........................',
    '..........................',
    '..........................',
    '..........................',
    '..........................',
    '...OOOOOOOOOOOOOOOOOOOO...',
    '..OAAAAAAAAAAAAAAAAAAAAO..',
    '..OACAAAAAAAAAAAAAAACAAO..',
    '..OBBBBBBBBBBBBBBBBBBBBO..',
    '...OOOOOOOOOOOOOOOOOOOO...',
  ]),

  /** Over the shoulders and out to the sides, open down the front. */
  cloak: sprite([
    '...OOOOOOOOOOOOOOOOOOOO...',
    '..OAAAAAAAAAAAAAAAAAAAAO..',
    '.OAAAAAAAAAAAAAAAAAAAAAAO.',
    'OAAAAAAAA........AAAAAAAAO',
    'OAAAAAAA..........AAAAAAAO',
    'OAAAAAA............AAAAAAO',
    'OAAAAA..............AAAAAO',
    'OBBBB................BBBBO',
    '.OBB................BBO...',
    '..........................',
    '..........................',
  ]),

  /** A band at the throat with a tag hanging off it. */
  collar: sprite([
    '.....OOOOOOOOOOOOOOOO.....',
    '.....OAAAAAAAAAAAAAAO.....',
    '.....OOOOOOODOOOOOOOO.....',
    '...........ODO............',
    '...........OOO............',
    '..........................',
    '..........................',
    '..........................',
    '..........................',
    '..........................',
    '..........................',
  ]),

  /**
   * A bodice narrowing to a sash at the waist, then an A-line flare to the
   * hem. The fourth outfit family — full-body coverage, same footprint as
   * `towel`/`cloak`, so it fits the same three-palette-swap treatment
   * everything else in this file gets.
   */
  dress: sprite([
    '..........................',
    '.......OAAAAAAAAAAO.......',
    '.......OAAAAAAAAAAO.......',
    '........OAAAAAAAAO........',
    '........OBBBBBBBBO........',
    '.......OAAAAAAAAAAO.......',
    '.....OAAAAAAAAAAAAAAO.....',
    '...OAAAAAAAAAAAAAAAAAAO...',
    '.OAAAAAAAAAAAAAAAAAAAAAAO.',
    '.OOOOOOOOOOOOOOOOOOOOOOOO.',
    '..........................',
  ]),
};

// --------------------------------------------------------------- accessories
//
// Small patches, each with its own origin — a pair of glasses belongs on the
// eye band and a floating duck belongs in the water, and forcing both into one
// bounding box would mean most of every grid was empty.

export const ACCESSORY_SHAPES = {
  /** Over the eye band, at exactly the origin the expressions use. */
  glasses: {
    origin: { x: 10, y: 6 },
    sprite: sprite([
      'OOOO....OOOO..',
      'OCCO.OO.OCCO..',
      'OOOO....OOOO..',
    ]),
  },

  /** Round the throat, just under the muzzle. */
  bandana: {
    origin: { x: 5, y: 12 },
    sprite: sprite([
      'OOOOOOOOOOOOOOOOOOOOOO',
      'OAAAAAAAAAAAAAAAAAAAAO',
      '.OOOOOOOOOOOOOOOOOOOO.',
    ]),
  },

  /** Hanging in the air beside the head. */
  float: {
    origin: { x: 23, y: 3 },
    sprite: sprite([
      '........',
      '...OOO..',
      '..OAAAO.',
      '..OACAO.',
      '..OAAAO.',
      '...OOO..',
      '........',
      '........',
    ]),
  },

  /** Bobbing in the pool on the near side. */
  duck: {
    origin: { x: 2, y: 22 },
    sprite: sprite([
      '........',
      '..OO....',
      '.OAAO...',
      'OAADAO..',
      '.OAAAAO.',
      '..OOOO..',
    ]),
  },

  /** Two marks on the cheeks. No outline — it sits on the fur. */
  cheeks: {
    origin: { x: 6, y: 9 },
    sprite: sprite([
      'AA................AA',
      '.A................A.',
    ]),
  },

  /** Pinned in beside the right ear — a knot with two loops. */
  bow: {
    origin: { x: 17, y: 1 },
    sprite: sprite([
      'OOO...OOO',
      'OAAO.OAAO',
      '.OAADAAO.',
      '..OADAO..',
      '...OOO...',
    ]),
  },
};

// ------------------------------------------------------------------- the art
//
// `kind:id` -> what to draw. Same shape as BUILDING_ART in palettes.js: the
// catalogue in data/cosmetics.js says what exists and what it costs, and this
// says what it looks like. A test asserts the two agree in both directions.

function hat(shape, palette) {
  return { sprite: HAT_SHAPES[shape], origin: HAT_ORIGIN, palette };
}

function outfit(shape, palette) {
  return { sprite: OUTFIT_SHAPES[shape], origin: OUTFIT_ORIGIN, palette };
}

function accessory(shape, palette) {
  const art = ACCESSORY_SHAPES[shape];
  return { sprite: art.sprite, origin: art.origin, palette };
}

const INK = '#2c1e2f';

export const WEARABLE_ART = {
  // --- hats: straw
  'hat:strawBoater': hat('straw', wearPalette(INK, '#d9b871', '#a8874a', '#f0dcae', '#7a5334')),
  'hat:sunHat': hat('straw', wearPalette(INK, '#fdf6e8', '#d6ccb4', '#ffffff', '#f7c948')),
  'hat:paperParasol': hat('straw', wearPalette(INK, '#e08fa4', '#b8697f', '#f7c0cd', '#fdf6e8')),

  // --- hats: beanie
  'hat:woollyHat': hat('beanie', wearPalette(INK, '#c4413f', '#8f2c2b', '#e8706d', '#fdf6e8')),
  'hat:nightCap': hat('beanie', wearPalette(INK, '#3d3a5c', '#272444', '#575383', '#f7c948')),
  'hat:mossCap': hat('beanie', wearPalette(INK, '#5f7a3a', '#42551f', '#87a353', '#b4cc80')),

  // --- hats: crown
  'hat:reedCrown': hat('crown', wearPalette(INK, '#7cc255', '#4b8a30', '#b4cc80', '#f7c948')),
  'hat:goldCrown': hat('crown', wearPalette(INK, '#f0a63d', '#b8862b', '#ffe08a', '#7fd0e6')),
  'hat:iceCrown': hat('crown', wearPalette(INK, '#c9e2ed', '#96b8c9', '#ffffff', '#7fd0e6')),

  // --- hats: band
  'hat:headband': hat('band', wearPalette(INK, '#fdf6e8', '#d6ccb4', '#ffffff', '#c4413f')),
  'hat:sweatband': hat('band', wearPalette(INK, '#8b93a8', '#5e6577', '#b6bdcc', '#e8556d')),
  'hat:laurel': hat('band', wearPalette(INK, '#5f9a3a', '#3d6b2a', '#8fd06a', '#f0d97a')),

  // --- hats: top
  'hat:topHat': hat('top', wearPalette(INK, '#241c33', '#160f22', '#5c4b7d', '#c4413f')),
  'hat:chimney': hat('top', wearPalette(INK, '#6b4a24', '#463014', '#8a6330', '#c99560')),
  'hat:conjurer': hat('top', wearPalette(INK, '#5c4b7d', '#3b2f52', '#8f77bd', '#f0d97a')),

  // --- hats: flower
  'hat:yuzuBlossom': hat('flower', wearPalette(INK, '#fdf6e8', '#d6ccb4', '#ffffff', '#f7c948')),
  'hat:sakuraSprig': hat('flower', wearPalette(INK, '#f7c0cd', '#d68fa4', '#ffffff', '#c4413f')),
  'hat:lotusBud': hat('flower', wearPalette(INK, '#ffe4ef', '#e0a8c0', '#ffffff', '#7cc255')),

  // --- hats: horns
  'hat:littleHorns': hat('horns', wearPalette(INK, '#4a3a52', '#2f2436', '#6b5875', '#e8556d')),
  'hat:antlers': hat('horns', wearPalette(INK, '#8a6330', '#5c4230', '#c99560', '#fdf6e8')),
  'hat:emberHorns': hat('horns', wearPalette(INK, '#e0653f', '#a83f22', '#ffa070', '#f7c948')),

  // --- hats: hood
  'hat:towelHood': hat('hood', wearPalette(INK, '#fdf6e8', '#d6ccb4', '#ffffff', '#7fd0e6')),

  // --- hats: wig
  'hat:looseWaves': hat('wig', wearPalette(INK, '#6b4a24', '#463014', '#8a6330', '#c99560')),
  'hat:braid': hat('wig', wearPalette(INK, '#3a2a1e', '#241a12', '#5c4230', '#c99560')),
  'hat:updo': hat('wig', wearPalette(INK, '#c4413f', '#8f2c2b', '#e8706d', '#f0d97a')),

  // --- hats: crown, again — a fourth palette on the shape three already
  // share, for a milestone earned by rebirthing rather than by winning.
  'hat:crownOfTen': hat('crown', wearPalette(INK, '#2f2444', '#1c1530', '#5c4b7d', '#f7c948')),

  // --- outfits: scarf
  'outfit:redScarf': outfit('scarf', wearPalette(INK, '#c4413f', '#8f2c2b', '#e8706d', '#fdf6e8')),
  'outfit:stripedScarf': outfit('scarf', wearPalette(INK, '#f0d97a', '#b8862b', '#fff7d6', '#4a3a52')),
  'outfit:silkScarf': outfit('scarf', wearPalette(INK, '#8f77bd', '#5c4b7d', '#c0aee0', '#f7c948')),

  // --- outfits: apron
  'outfit:bathAttendant': outfit('apron', wearPalette(INK, '#7fd0e6', '#3f8fb0', '#c9f2ff', '#fdf6e8')),
  'outfit:chefApron': outfit('apron', wearPalette(INK, '#fdf6e8', '#c9bfa8', '#ffffff', '#c4413f')),
  'outfit:gardenApron': outfit('apron', wearPalette(INK, '#8a6330', '#5c4230', '#c99560', '#7cc255')),

  // --- outfits: vest
  'outfit:reedVest': outfit('vest', wearPalette(INK, '#5f9a3a', '#3d6b2a', '#8fd06a', '#f0d97a')),
  'outfit:leatherVest': outfit('vest', wearPalette(INK, '#7d5c42', '#4a3527', '#a8815f', '#f0a63d')),
  'outfit:lifeVest': outfit('vest', wearPalette(INK, '#f0a63d', '#b8722b', '#ffd08a', '#fdf6e8')),

  // --- outfits: towel
  'outfit:onsenTowel': outfit('towel', wearPalette(INK, '#fdf6e8', '#cfc4ae', '#ffffff', '#7fd0e6')),
  'outfit:yuzuTowel': outfit('towel', wearPalette(INK, '#f7c948', '#b8862b', '#fff7d6', '#5f9a3a')),
  'outfit:mossTowel': outfit('towel', wearPalette(INK, '#87a353', '#5f7a3a', '#b4cc80', '#fdf6e8')),

  // --- outfits: cloak
  'outfit:nightCloak': outfit('cloak', wearPalette(INK, '#3d3a5c', '#272444', '#575383', '#f0d97a')),
  'outfit:emberCloak': outfit('cloak', wearPalette(INK, '#a83f22', '#6d2612', '#e0653f', '#f7c948')),
  'outfit:frostCloak': outfit('cloak', wearPalette(INK, '#96b8c9', '#6b8fa3', '#c9e2ed', '#ffffff')),
  // A fourth cloak palette, darker and stiller than the other three — for the
  // ascension that stops the floor from rising any further.
  'outfit:noFurtherFloor': outfit('cloak', wearPalette(INK, '#241c33', '#150f1f', '#4a3a5c', '#f7c948')),

  // --- outfits: collar
  'outfit:bellCollar': outfit('collar', wearPalette(INK, '#c4413f', '#8f2c2b', '#e8706d', '#f7c948')),
  'outfit:leafCollar': outfit('collar', wearPalette(INK, '#5f9a3a', '#3d6b2a', '#8fd06a', '#7cc255')),
  'outfit:starCollar': outfit('collar', wearPalette(INK, '#3b2f52', '#241c33', '#5c4b7d', '#fdf6e8')),

  // --- outfits: dress
  'outfit:sunDress': outfit('dress', wearPalette(INK, '#f0d97a', '#b8862b', '#fff7d6', '#5f9a3a')),
  'outfit:pondGown': outfit('dress', wearPalette(INK, '#7fd0e6', '#3f8fb0', '#c9f2ff', '#f0d97a')),
  'outfit:festivalKimono': outfit('dress', wearPalette(INK, '#c4413f', '#8f2c2b', '#e8706d', '#f7c948')),

  // --- accessories
  'accessory:roundGlasses': accessory('glasses', wearPalette(INK, '#8b93a8', '#5e6577', '#c9f2ff', '#fdf6e8')),
  'accessory:sunglasses': accessory('glasses', wearPalette(INK, '#241c33', '#160f22', '#3b2f52', '#8b93a8')),
  'accessory:readingGlasses': accessory('glasses', wearPalette(INK, '#b8862b', '#8a5f18', '#fff7d6', '#f7c948')),

  'accessory:redBandana': accessory('bandana', wearPalette(INK, '#c4413f', '#8f2c2b', '#e8706d', '#fdf6e8')),
  'accessory:blueBandana': accessory('bandana', wearPalette(INK, '#3f8fb0', '#2b6480', '#7fd0e6', '#fdf6e8')),

  'accessory:soapBubble': accessory('float', wearPalette(INK, '#c9f2ff', '#7fd0e6', '#ffffff', '#ffffff')),
  'accessory:yuzuFloat': accessory('float', wearPalette(INK, '#f7c948', '#b8862b', '#fff7d6', '#5f9a3a')),
  'accessory:paperLantern': accessory('float', wearPalette(INK, '#e8706d', '#a83f22', '#ffd08a', '#f7c948')),

  'accessory:rubberDuck': accessory('duck', wearPalette(INK, '#f7c948', '#b8862b', '#fff7d6', '#e0653f')),
  'accessory:toyBoat': accessory('duck', wearPalette(INK, '#fdf6e8', '#c9bfa8', '#ffffff', '#c4413f')),

  'accessory:blush': accessory('cheeks', wearPalette(INK, '#e8706d', '#c4413f', '#f7c0cd', '#f7c0cd')),
  'accessory:warPaint': accessory('cheeks', wearPalette(INK, '#4de0c0', '#2aa88e', '#a8f5e6', '#a8f5e6')),

  'accessory:hairRibbon': accessory('bow', wearPalette(INK, '#e08fa4', '#b8697f', '#f7c0cd', '#f0d97a')),
};

/** The layers a dressed capybara needs, in stamping order. Skips "bare". */
export function wornLayers({ hat: hatId, outfit: outfitId, accessory: accessoryId } = {}) {
  const layers = [];
  // Outfit first, then hat, then accessory: an accessory is the small thing
  // that should sit on top of whatever else is being worn.
  for (const key of [`outfit:${outfitId}`, `hat:${hatId}`, `accessory:${accessoryId}`]) {
    const art = WEARABLE_ART[key];
    if (art) layers.push(art);
  }
  return layers;
}

/** A cache key that changes when — and only when — the outfit does. */
export function wornKey({ hat: hatId = 'none', outfit: outfitId = 'none', accessory: accessoryId = 'none' } = {}) {
  return `${hatId}/${outfitId}/${accessoryId}`;
}

export const WEARABLE_SHAPES = { HAT_SHAPES, OUTFIT_SHAPES, ACCESSORY_SHAPES };
