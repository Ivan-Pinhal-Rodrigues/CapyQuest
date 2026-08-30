// Colour ramps. Sprites are drawn once as character grids (sprites.js) and get
// their colour from here, so one hand-drawn shape becomes dozens of distinct
// objects by swapping the palette underneath it.
//
// `null` means transparent.

// The capybara sprite includes the water it is sitting in, so this palette has
// to cover the water characters too — a missing entry renders as a hole.
export const CAPY_PALETTE = {
  '.': null,
  o: '#2c1e2f', // outline
  d: '#7a5334', // fur shadow
  m: '#a67243', // fur mid
  l: '#c99560', // fur highlight
  n: '#5a3b2b', // muzzle
  e: '#1b1016', // eye
  w: '#fdf6e8', // glint
  k: '#5a3b2b', // mouth
  a: '#63b8d1', // water surface
  b: '#33769a', // water depth
};

export const CAPY_SKINS = {
  classic: CAPY_PALETTE,
  golden: { ...CAPY_PALETTE, d: '#b8862b', m: '#e6b13d', l: '#ffe08a', n: '#8a5f18' },
  midnight: { ...CAPY_PALETTE, d: '#3d3a5c', m: '#575383', l: '#7d78ad', n: '#2a2742' },
  sakura: { ...CAPY_PALETTE, d: '#b8697f', m: '#e08fa4', l: '#f7c0cd', n: '#8f4b5e' },
  matcha: { ...CAPY_PALETTE, d: '#5f7a3a', m: '#87a353', l: '#b4cc80', n: '#42551f' },
  frost: { ...CAPY_PALETTE, d: '#6b8fa3', m: '#96b8c9', l: '#c9e2ed', n: '#4a6675' },
  void: { ...CAPY_PALETTE, d: '#241c33', m: '#3b2f52', l: '#5c4b7d', n: '#160f22' },
  ember: { ...CAPY_PALETTE, d: '#a83f22', m: '#d4602f', l: '#f09060', n: '#7a2a14' },
  cocoa: { ...CAPY_PALETTE, d: '#4a3527', m: '#6d4c36', l: '#966c4e', n: '#332419' },
  slate: { ...CAPY_PALETTE, d: '#4a5163', m: '#6b7387', l: '#98a1b5', n: '#343a49' },
  mint: { ...CAPY_PALETTE, d: '#4a8f7a', m: '#6fb89e', l: '#a3ddc8', n: '#33685a' },
  plum: { ...CAPY_PALETTE, d: '#5a2f52', m: '#824674', l: '#b06fa0', n: '#3f1e39' },
  sand: { ...CAPY_PALETTE, d: '#a8874a', m: '#cdac72', l: '#ecd3a3', n: '#7d6334' },
  // Season-pass exclusive: steam-flushed, like it has been in the water too long.
  seasonal: { ...CAPY_PALETTE, d: '#a8543f', m: '#d1795c', l: '#f0a88c', n: '#7d3a2b' },
  // Event exclusive: Yuzu Harvest.
  harvest: { ...CAPY_PALETTE, d: '#b8902b', m: '#e3c04a', l: '#f7e08a', n: '#8a681a' },
  // Ascend once. Pale and cool rather than warm like every fur colour above
  // it — the point is that it reads as apart from the rest of the palette,
  // not as one more colour in it.
  ascendant: { ...CAPY_PALETTE, d: '#6b6b78', m: '#9a9aa8', l: '#e8e8f0', n: '#454550' },

  // The five NPCs. Portraits only — these are not in the cosmetics table and
  // cannot be worn, because a capybara wearing another capybara is a different
  // kind of game.
  npcElder: { ...CAPY_PALETTE, d: '#8e8378', m: '#b5a99b', l: '#ded4c6', n: '#665d54' },
  npcKeeper: { ...CAPY_PALETTE, d: '#8a5a3c', m: '#b57b54', l: '#d9a37b', n: '#5f3c26' },
  npcYoung: { ...CAPY_PALETTE, d: '#a3763f', m: '#d19f5c', l: '#f0c78e', n: '#78542a' },
  npcQuiet: { ...CAPY_PALETTE, d: '#3b3550', m: '#544c70', l: '#7b7199', n: '#26213a' },
  npcTanuki: { ...CAPY_PALETTE, d: '#4a3a2f', m: '#6e5544', l: '#96775f', n: '#2e231b' },
};

export const PROP_PALETTE = {
  '.': null,
  o: '#2c1e2f',
  y: '#f7c948', // yuzu flesh
  w: '#fff7d6', // highlight
  g: '#6aa84f', // leaf
  s: '#dff0f5', // steam
  a: '#7fd0e6', // water light
  b: '#3f8fb0', // water dark
};

// Generator icons come from ten hand-drawn families of three (SHAPE_FAMILIES in
// sprites.js); the palette is what makes a Lily Pad read differently from a
// Capy Singularity when they share a shape.
export const ICON_BASE = { '.': null, o: '#2c1e2f' };

export function iconPalette(dark, mid, light, accent) {
  return { ...ICON_BASE, 1: dark, 2: mid, 3: light, 4: accent };
}

export const BUILDING_ART = {
  lilypad: { palette: iconPalette('#2f5d2a', '#3f7a36', '#5fa348', '#8fd06a') },
  yuzuSapling: { palette: iconPalette('#6b4a24', '#8a6330', '#5fa348', '#f7c948') },
  mudPuddle: { palette: iconPalette('#4a3320', '#6b4a2c', '#8a6330', '#9c7a4d') },
  onsenBasin: { palette: iconPalette('#7a4a2c', '#a3663a', '#d99a5e', '#7fd0e6') },
  bambooGrove: { palette: iconPalette('#3d6b2a', '#54913a', '#7cc255', '#c9e08a') },
  riverbankDen: { palette: iconPalette('#3a2a1e', '#5c4230', '#7d5c42', '#c99560') },
  capyCafe: { palette: iconPalette('#5c2f2a', '#8a4a3c', '#c47a5e', '#f7c948') },
  springResort: { palette: iconPalette('#2f4a5c', '#456d87', '#6b9ab5', '#fdf6e8') },
  zenGarden: { palette: iconPalette('#4a3a2c', '#6b5540', '#a38763', '#c0392b') },
  floatingMarket: { palette: iconPalette('#5c3a1e', '#87582c', '#c98f4d', '#e8734a') },
  moonBathhouse: { palette: iconPalette('#2a2a45', '#3f3f66', '#6b6b9c', '#f2e8b0') },
  crystalSprings: { palette: iconPalette('#2a5c6b', '#3f87a3', '#6bc2d9', '#c9f2ff') },
  skyTerrace: { palette: iconPalette('#4a5c6b', '#6d87a3', '#9cb8cc', '#ffe08a') },
  dreamLagoon: { palette: iconPalette('#3a2a5c', '#573f87', '#8f6bc2', '#d9b8ff') },
  timeOnsen: { palette: iconPalette('#5c4a1e', '#8a7030', '#c9a94d', '#fff0a8') },
  astralPond: { palette: iconPalette('#1e2a5c', '#2f4287', '#4d6bc9', '#a8c4ff') },
  yuzuDimension: { palette: iconPalette('#6b5c1e', '#a38a2f', '#e0c14d', '#fff7c0') },
  capySingularity: { palette: iconPalette('#2a1e3a', '#4a2f6b', '#7d4dc9', '#f0d9ff') },

  // Past the horizon. Ten families cover thirty more generators, so the palette
  // is doing most of the work of telling them apart — each ramp is picked for
  // the thing it is rather than for its neighbours, and the contact sheet in
  // `tests/pond.test.js` is what stops two of them landing on the same colour.
  steamCathedral: { palette: iconPalette('#4a4a5c', '#6b6b82', '#9c9cb5', '#f0f0ff') },
  fogArchive: { palette: iconPalette('#3a4250', '#556070', '#8892a3', '#e8dfc8') },
  tidepoolChoir: { palette: iconPalette('#1e5c5c', '#2f8787', '#4dc2c2', '#b8f0f0') },
  ninetailSpring: { palette: iconPalette('#7a3320', '#a84f2c', '#d9855c', '#fce8c0') },
  lanternFlotilla: { palette: iconPalette('#2a2a45', '#3f3f66', '#5c5c8a', '#ffcf5c') },
  auroraBasin: { palette: iconPalette('#1e4a3a', '#2f7a54', '#4dc98a', '#c48fff') },
  whaleRoadFerry: { palette: iconPalette('#1e3a52', '#2f5a7a', '#4d87b5', '#cfe8f5') },
  cloudOrchard: { palette: iconPalette('#6b7a8a', '#93a5b5', '#ccdae5', '#8fd06a') },
  mirrorDeep: { palette: iconPalette('#3a4250', '#5c6878', '#9aa8b8', '#e8f2ff') },
  obsidianSauna: { palette: iconPalette('#161018', '#2a1e2c', '#4a3a4d', '#e8622f') },
  longWeekend: { palette: iconPalette('#7a5a24', '#a8802f', '#d9b04d', '#ffe08a') },
  gravityWellSpa: { palette: iconPalette('#241c33', '#3b2f52', '#6b56a3', '#c9a8ff') },
  chrysalisReef: { palette: iconPalette('#7a2f52', '#a84f7a', '#d98fb0', '#6fd0a3') },
  cometBathhouse: { palette: iconPalette('#2a3a6b', '#3f56a3', '#6b87d9', '#ffffff') },
  rootOfTheWorld: { palette: iconPalette('#3a2a1a', '#5c4227', '#7d5c38', '#6aa84f') },
  ashfallSprings: { palette: iconPalette('#3a3530', '#5c554d', '#8a8175', '#e8703a') },
  quietLibrary: { palette: iconPalette('#33241a', '#52402f', '#7a6249', '#e8dcc0') },
  nebulaTrough: { palette: iconPalette('#3a1e5c', '#5c2f8a', '#8f4dc9', '#ffb8f0') },
  leviathanBasin: { palette: iconPalette('#12303a', '#1e5266', '#2f87a3', '#7fd0c2') },
  solsticeEngine: { palette: iconPalette('#6b4a1e', '#a8752f', '#d9a84d', '#fff0a8') },
  hollowMoon: { palette: iconPalette('#3f4252', '#5f6478', '#9399b0', '#f5f0e0') },
  firstWater: { palette: iconPalette('#2a5c7a', '#3f87b5', '#6bc2e0', '#f0fbff') },
  slowContinent: { palette: iconPalette('#3a4a24', '#5c702f', '#87a34d', '#c9b88a') },
  yuzuBelt: { palette: iconPalette('#5c4a1e', '#8a7530', '#d9bb4d', '#fff7c0') },
  dreamingKiln: { palette: iconPalette('#5c1e1e', '#8a2f2f', '#c94d4d', '#ffb060') },
  undertowCourt: { palette: iconPalette('#12333a', '#1e5a66', '#2f8f9c', '#e0f5f0') },
  entropyGardens: { palette: iconPalette('#4a4a3a', '#6b6b52', '#9c9c7d', '#d9c99c') },
  lastLightOnsen: { palette: iconPalette('#5c2a3a', '#8a4252', '#c96b7a', '#ffc08a') },
  unbotheredAxiom: { palette: iconPalette('#5c5c52', '#8a8a7d', '#c2c2b5', '#ffe8a8') },
  capybaraAbsolute: { palette: iconPalette('#5c3f24', '#8a6338', '#c99560', '#fff0d0') },
};

// Rarity ramps — used by gear and gacha in later commits, defined here so the
// whole game shares one source of truth for "what does legendary look like".
export const RARITY = {
  common: { name: 'Common', color: '#9aa5b1', glow: 'rgba(154,165,177,0.35)' },
  uncommon: { name: 'Uncommon', color: '#5fa348', glow: 'rgba(95,163,72,0.35)' },
  rare: { name: 'Rare', color: '#4d8fd9', glow: 'rgba(77,143,217,0.4)' },
  epic: { name: 'Epic', color: '#a45fd9', glow: 'rgba(164,95,217,0.45)' },
  legendary: { name: 'Legendary', color: '#f0a63d', glow: 'rgba(240,166,61,0.5)' },
  mythic: { name: 'Mythic', color: '#e8556d', glow: 'rgba(232,85,109,0.5)' },
  capybaric: { name: 'Capybaric', color: '#4de0c0', glow: 'rgba(77,224,192,0.55)' },
};
