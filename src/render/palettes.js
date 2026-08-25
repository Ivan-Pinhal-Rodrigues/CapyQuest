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
  // Season-pass exclusive: steam-flushed, like it has been in the water too long.
  seasonal: { ...CAPY_PALETTE, d: '#a8543f', m: '#d1795c', l: '#f0a88c', n: '#7d3a2b' },
  // Event exclusive: Yuzu Harvest.
  harvest: { ...CAPY_PALETTE, d: '#b8902b', m: '#e3c04a', l: '#f7e08a', n: '#8a681a' },
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

// Generator icons all share the same 10 hand-drawn shapes; the palette is what
// makes a Lily Pad read differently from a Capy Singularity.
export const ICON_BASE = { '.': null, o: '#2c1e2f' };

export function iconPalette(dark, mid, light, accent) {
  return { ...ICON_BASE, 1: dark, 2: mid, 3: light, 4: accent };
}

export const BUILDING_ART = {
  lilypad: { shape: 'pad', palette: iconPalette('#2f5d2a', '#3f7a36', '#5fa348', '#8fd06a') },
  yuzuSapling: { shape: 'tree', palette: iconPalette('#6b4a24', '#8a6330', '#5fa348', '#f7c948') },
  mudPuddle: { shape: 'pool', palette: iconPalette('#4a3320', '#6b4a2c', '#8a6330', '#9c7a4d') },
  onsenBasin: { shape: 'pool', palette: iconPalette('#7a4a2c', '#a3663a', '#d99a5e', '#7fd0e6') },
  bambooGrove: { shape: 'tree', palette: iconPalette('#3d6b2a', '#54913a', '#7cc255', '#c9e08a') },
  riverbankDen: { shape: 'hut', palette: iconPalette('#3a2a1e', '#5c4230', '#7d5c42', '#c99560') },
  capyCafe: { shape: 'hut', palette: iconPalette('#5c2f2a', '#8a4a3c', '#c47a5e', '#f7c948') },
  springResort: { shape: 'hut', palette: iconPalette('#2f4a5c', '#456d87', '#6b9ab5', '#fdf6e8') },
  zenGarden: { shape: 'arch', palette: iconPalette('#4a3a2c', '#6b5540', '#a38763', '#c0392b') },
  floatingMarket: { shape: 'arch', palette: iconPalette('#5c3a1e', '#87582c', '#c98f4d', '#e8734a') },
  moonBathhouse: { shape: 'tower', palette: iconPalette('#2a2a45', '#3f3f66', '#6b6b9c', '#f2e8b0') },
  crystalSprings: { shape: 'crystal', palette: iconPalette('#2a5c6b', '#3f87a3', '#6bc2d9', '#c9f2ff') },
  skyTerrace: { shape: 'tower', palette: iconPalette('#4a5c6b', '#6d87a3', '#9cb8cc', '#ffe08a') },
  dreamLagoon: { shape: 'pool', palette: iconPalette('#3a2a5c', '#573f87', '#8f6bc2', '#d9b8ff') },
  timeOnsen: { shape: 'portal', palette: iconPalette('#5c4a1e', '#8a7030', '#c9a94d', '#fff0a8') },
  astralPond: { shape: 'orb', palette: iconPalette('#1e2a5c', '#2f4287', '#4d6bc9', '#a8c4ff') },
  yuzuDimension: { shape: 'portal', palette: iconPalette('#6b5c1e', '#a38a2f', '#e0c14d', '#fff7c0') },
  capySingularity: { shape: 'star', palette: iconPalette('#2a1e3a', '#4a2f6b', '#7d4dc9', '#f0d9ff') },
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
