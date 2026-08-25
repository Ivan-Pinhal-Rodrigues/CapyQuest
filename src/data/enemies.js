// The enemy registry: 53 regulars and 18 bosses, built from twelve 24×24 shapes
// in render/enemySprites.js and two hostile-capybara poses in capySprites.js,
// all by palette swap.
//
// statMod scales the base curve from balance.js: hp/atk/def are multipliers, so
// a Turtle-shaped enemy can be a wall without needing its own formula.

import { HOSTILE_CAPYBARAS } from './capybaras.js';

const EYE = { e: '#141018', w: '#fdf6e8' };

function palette(dark, mid, light, accent) {
  return { '.': null, o: '#1c1420', 1: dark, 2: mid, 3: light, 4: accent, ...EYE };
}

export const ENEMIES = {
  // ------------------------------------------------------------- regulars
  nibbler: {
    name: 'Reed Nibbler', shape: 'FROG', element: 'leaf',
    palette: palette('#3d6b2a', '#54913a', '#7cc255', '#c9e08a'),
    statMod: { hp: 0.85, atk: 0.9, def: 0.8 },
    blurb: 'Small, green, relentlessly hungry.',
  },
  snapper: {
    name: 'Mud Snapper', shape: 'CRAB', element: 'water',
    palette: palette('#6b3a2a', '#9c5540', '#c47a5e', '#f0a63d'),
    statMod: { hp: 1, atk: 1.1, def: 1.2 },
    blurb: 'Two claws, no patience.',
  },
  hopper: {
    name: 'Bank Hopper', shape: 'FROG', element: 'water',
    palette: palette('#2a5c6b', '#3f87a3', '#6bc2d9', '#c9f2ff'),
    statMod: { hp: 0.9, atk: 1.05, def: 0.85 },
    blurb: 'Never where it was a second ago.',
  },
  wallower: {
    name: 'Silt Wallower', shape: 'BLOB', element: 'leaf',
    palette: palette('#4a3320', '#6b4a2c', '#8a6330', '#9c7a4d'),
    statMod: { hp: 1.5, atk: 0.8, def: 1.1 },
    blurb: 'Mostly mud. Aggressively so.',
  },
  ember: {
    name: 'Ember Sprite', shape: 'BLOB', element: 'ember',
    palette: palette('#8a2f1e', '#c94a2a', '#f0824a', '#ffd08a'),
    statMod: { hp: 0.8, atk: 1.35, def: 0.7 },
    blurb: 'Warm to be near. Warmer to be hit by.',
  },
  steamwisp: {
    name: 'Steam Wisp', shape: 'GHOST', element: 'ember',
    palette: palette('#8a8090', '#b3aabc', '#dfd6e6', '#fff7d6'),
    statMod: { hp: 0.7, atk: 1.2, def: 0.6 },
    blurb: 'Barely there, and yet.',
  },
  gulper: {
    name: 'Deep Gulper', shape: 'FISH', element: 'water',
    palette: palette('#1e3a5c', '#2f5c87', '#4d8fc9', '#a8d4ff'),
    statMod: { hp: 1.2, atk: 1.1, def: 1 },
    blurb: 'Opens wider than it should be able to.',
  },
  drifter: {
    name: 'Pale Drifter', shape: 'GHOST', element: 'moon',
    palette: palette('#3a2a5c', '#573f87', '#8f6bc2', '#d9b8ff'),
    statMod: { hp: 0.95, atk: 1.15, def: 0.9 },
    blurb: 'Goes where it likes. Slowly.',
  },
  haggler: {
    name: 'Night Haggler', shape: 'CRAB', element: 'moon',
    palette: palette('#4a2f5c', '#6d4487', '#9c6bc2', '#f0a63d'),
    statMod: { hp: 1.1, atk: 1, def: 1.25 },
    blurb: 'Wants your zen. Will not take no.',
  },
  shrieker: {
    name: 'Grove Shrieker', shape: 'BIRD', element: 'leaf',
    palette: palette('#2f5c2a', '#44873a', '#6bc255', '#f7c948'),
    statMod: { hp: 0.85, atk: 1.3, def: 0.75 },
    blurb: 'You hear it long before you see it.',
  },
  mirrorling: {
    name: 'Mirrorling', shape: 'GHOST', element: 'moon',
    palette: palette('#2a4a5c', '#3f6d87', '#6b9cb8', '#e0f4ff'),
    statMod: { hp: 1, atk: 1.2, def: 1.1 },
    blurb: 'It copies you, badly, and resents it.',
  },
  shardling: {
    name: 'Shardling', shape: 'GOLEM', element: 'water',
    palette: palette('#2a5c6b', '#3f87a3', '#6bc2d9', '#c9f2ff'),
    statMod: { hp: 1.6, atk: 0.95, def: 1.5 },
    blurb: 'Sharp on every axis at once.',
  },
  gustling: {
    name: 'Gustling', shape: 'BIRD', element: 'sun',
    palette: palette('#5c4a1e', '#8a7030', '#c9a94d', '#fff0a8'),
    statMod: { hp: 0.8, atk: 1.4, def: 0.7 },
    blurb: 'Arrives before the wind that carried it.',
  },

  // ---------------------------------------------------------------- bosses
  reedKing: {
    name: 'The Reed King', shape: 'BEAST', element: 'leaf', boss: true,
    palette: palette('#2f5c2a', '#44873a', '#7cc255', '#f7c948'),
    statMod: { hp: 1, atk: 1.1, def: 1 },
    blurb: 'Crowned in reeds by nobody in particular.',
  },
  mireLord: {
    name: 'Lord of the Mire', shape: 'BLOB', element: 'leaf', boss: true,
    palette: palette('#3a2a14', '#5c4420', '#8a6a30', '#c9a94d'),
    statMod: { hp: 1.6, atk: 0.9, def: 1.3 },
    blurb: 'Has been settling into that spot for centuries.',
  },
  boilerBeast: {
    name: 'The Boiler Beast', shape: 'BEAST', element: 'ember', boss: true,
    palette: palette('#7a2414', '#b83f24', '#e8734a', '#ffd08a'),
    statMod: { hp: 1.1, atk: 1.4, def: 0.9 },
    blurb: 'Runs the springs. Does not take requests.',
  },
  groveWarden: {
    name: 'Grove Warden', shape: 'GOLEM', element: 'leaf', boss: true,
    palette: palette('#2a4a1e', '#3f702f', '#63a34d', '#c9e08a'),
    statMod: { hp: 1.5, atk: 1, def: 1.6 },
    blurb: 'Made of bamboo that stopped being bamboo.',
  },
  riverElder: {
    name: 'The River Elder', shape: 'FISH', element: 'water', boss: true,
    palette: palette('#14304a', '#245070', '#3f87b8', '#a8d4ff'),
    statMod: { hp: 1.3, atk: 1.2, def: 1.1 },
    blurb: 'Older than the river. It waited for one.',
  },
  marketQueen: {
    name: 'The Market Queen', shape: 'CRAB', element: 'moon', boss: true,
    palette: palette('#4a1e4a', '#702f70', '#a34da3', '#f0a63d'),
    statMod: { hp: 1.2, atk: 1.25, def: 1.3 },
    blurb: 'Sets the prices. Sets them again if you look away.',
  },
  palePrince: {
    name: 'The Pale Prince', shape: 'GHOST', element: 'moon', boss: true,
    palette: palette('#2a2444', '#443a6b', '#6b5ca3', '#e0d4ff'),
    statMod: { hp: 1.1, atk: 1.45, def: 1 },
    blurb: 'Reflected in the pool long before he arrives.',
  },
  geodeTitan: {
    name: 'Geode Titan', shape: 'GOLEM', element: 'water', boss: true,
    palette: palette('#1e4450', '#2f6d80', '#4da3c2', '#c9f2ff'),
    statMod: { hp: 2, atk: 1, def: 1.9 },
    blurb: 'Hollow, and something inside is humming.',
  },
  stormHerald: {
    name: 'Storm Herald', shape: 'BIRD', element: 'sun', boss: true,
    palette: palette('#3a3a5c', '#575787', '#8f8fc2', '#fff0a8'),
    statMod: { hp: 1.1, atk: 1.5, def: 0.95 },
    blurb: 'Announces weather that has not agreed to happen.',
  },
  lucidWarden: {
    name: 'The Lucid Warden', shape: 'BEAST', element: 'moon', boss: true,
    palette: palette('#3a2454', '#573a80', '#8f63c2', '#e0c4ff'),
    statMod: { hp: 1.4, atk: 1.3, def: 1.2 },
    blurb: 'Guards the part of the dream you keep forgetting.',
  },
  forgeSovereign: {
    name: 'Forge Sovereign', shape: 'GOLEM', element: 'sun', boss: true,
    palette: palette('#5c3414', '#8a5424', '#c9843f', '#fff0a8'),
    statMod: { hp: 1.7, atk: 1.35, def: 1.6 },
    blurb: 'Where the light gets hammered into shape.',
  },
  theChonk: {
    name: 'THE CHONK', shape: 'BEAST', element: 'moon', boss: true,
    palette: palette('#241c33', '#3b2f52', '#7d5cad', '#4de0c0'),
    statMod: { hp: 2.5, atk: 1.6, def: 1.5 },
    blurb: 'The capybara at the end of everything. It is very relaxed.',
  },
};

// ---------------------------------------------------------- terrain natives
//
// The creatures the infinite-stage terrains introduced, from the four new
// templates: serpent, moth, turtle, spirit.

const NATIVES = {
  // --- serpents
  riversnake: {
    name: 'River Snake', shape: 'SERPENT', element: 'water',
    palette: palette('#1e3a5c', '#2f5c87', '#4d8fc9', '#a8d4ff'),
    statMod: { hp: 1, atk: 1.3, def: 0.85 },
    blurb: 'Moves with the current, strikes against it.',
  },
  brinesnake: {
    name: 'Brine Serpent', shape: 'SERPENT', element: 'water',
    palette: palette('#2a4442', '#3f6d68', '#63a39a', '#c9f0e0'),
    statMod: { hp: 1.15, atk: 1.35, def: 0.95 },
    blurb: 'Tastes the salt in the water and follows it to you.',
  },
  ventsnake: {
    name: 'Vent Coil', shape: 'SERPENT', element: 'ember',
    palette: palette('#4a2a3a', '#754458', '#c46b84', '#ffb8c9'),
    statMod: { hp: 1.2, atk: 1.5, def: 1 },
    blurb: 'Lives in the hot exhale. Comes out on the inhale.',
  },
  abyssnake: {
    name: 'Abyss Coil', shape: 'SERPENT', element: 'water',
    palette: palette('#101c2c', '#1e3448', '#385a78', '#8fc4e0'),
    statMod: { hp: 1.4, atk: 1.7, def: 1.2 },
    blurb: 'Longer than the light goes.',
  },

  // --- moths
  grovemoth: {
    name: 'Grove Moth', shape: 'MOTH', element: 'leaf',
    palette: palette('#2f4a1e', '#44702f', '#7cc255', '#e0f0a8'),
    statMod: { hp: 0.8, atk: 1.2, def: 0.7 },
    blurb: 'Eats bamboo shoots. Resents being interrupted.',
  },
  palemoth: {
    name: 'Pale Moth', shape: 'MOTH', element: 'moon',
    palette: palette('#2a2444', '#443a6b', '#8f7cc2', '#e0d4ff'),
    statMod: { hp: 0.85, atk: 1.3, def: 0.75 },
    blurb: 'Drawn to the pool, not to you. You are simply in the way.',
  },
  lucidmoth: {
    name: 'Lucid Moth', shape: 'MOTH', element: 'moon',
    palette: palette('#3a2454', '#573a80', '#9f7cd4', '#ecd9ff'),
    statMod: { hp: 0.95, atk: 1.4, def: 0.8 },
    blurb: 'You are fairly sure you dreamt this one first.',
  },
  cindermoth: {
    name: 'Cinder Moth', shape: 'MOTH', element: 'ember',
    palette: palette('#5c2418', '#8a3a24', '#d97a4a', '#ffcf9a'),
    statMod: { hp: 0.9, atk: 1.5, def: 0.75 },
    blurb: 'Wings leave a mark on the air behind them.',
  },
  glassmoth: {
    name: 'Glass Moth', shape: 'MOTH', element: 'moon',
    palette: palette('#243044', '#3f5470', '#8fb4d4', '#e4f4ff'),
    statMod: { hp: 0.9, atk: 1.55, def: 0.8 },
    blurb: 'Silent, because the wings do not touch anything.',
  },
  cometmoth: {
    name: 'Comet Moth', shape: 'MOTH', element: 'sun',
    palette: palette('#5c4420', '#8a6a30', '#d4b04d', '#fff0a8'),
    statMod: { hp: 1, atk: 1.7, def: 0.85 },
    blurb: 'Trails light it did not ask for.',
  },
  nullmoth: {
    name: 'Null Moth', shape: 'MOTH', element: 'moon',
    palette: palette('#1c1428', '#2e2440', '#54406b', '#9f7cd4'),
    statMod: { hp: 1.1, atk: 1.9, def: 0.95 },
    blurb: 'Where it lands, briefly, nothing was.',
  },

  // --- turtles
  geodeturtle: {
    name: 'Geode Turtle', shape: 'TURTLE', element: 'water',
    palette: palette('#2a5c6b', '#3f87a3', '#6bc2d9', '#d4f7ff'),
    statMod: { hp: 1.9, atk: 0.85, def: 1.9 },
    blurb: 'Hollow shell, and something inside is humming along.',
  },
  saltturtle: {
    name: 'Salt Turtle', shape: 'TURTLE', element: 'water',
    palette: palette('#2a4442', '#3f6d68', '#7ab0a3', '#dff0e4'),
    statMod: { hp: 2, atk: 0.9, def: 2 },
    blurb: 'Crusted over so thoroughly it creaks.',
  },
  forgeturtle: {
    name: 'Forge Turtle', shape: 'TURTLE', element: 'sun',
    palette: palette('#5c3414', '#8a5424', '#d99440', '#ffe0a8'),
    statMod: { hp: 2.1, atk: 1.1, def: 2.1 },
    blurb: 'The shell was quenched, once, and remembers it.',
  },
  depthturtle: {
    name: 'Depth Turtle', shape: 'TURTLE', element: 'water',
    palette: palette('#101c2c', '#1e3448', '#3f6b8a', '#a8ccdd'),
    statMod: { hp: 2.5, atk: 1.15, def: 2.4 },
    blurb: 'Built for a pressure you would not survive.',
  },

  // --- spirits
  thermalspirit: {
    name: 'Thermal Spirit', shape: 'SPIRIT', element: 'sun',
    palette: palette('#5c4a1e', '#8a7030', '#d4b04d', '#fff0a8'),
    statMod: { hp: 0.85, atk: 1.35, def: 0.7 },
    blurb: 'A column of warm air with intent.',
  },
  cinderspirit: {
    name: 'Cinder Spirit', shape: 'SPIRIT', element: 'ember',
    palette: palette('#7a2414', '#b83f24', '#e8734a', '#ffd08a'),
    statMod: { hp: 0.9, atk: 1.45, def: 0.75 },
    blurb: 'What is left when the fire finishes and does not stop.',
  },
  ashwalker: {
    name: 'Ashwalker', shape: 'SPIRIT', element: 'ember',
    palette: palette('#2a1c1c', '#4a3030', '#8a6058', '#d9a08a'),
    statMod: { hp: 1.1, atk: 1.4, def: 1 },
    blurb: 'Leaves grey prints. They blow away behind it.',
  },
  stillspirit: {
    name: 'Still Spirit', shape: 'SPIRIT', element: 'moon',
    palette: palette('#243044', '#3f5470', '#7d9cbc', '#dff0ff'),
    statMod: { hp: 1.15, atk: 1.5, def: 1.05 },
    blurb: 'Does not ripple the water it stands on.',
  },
  boilspirit: {
    name: 'Boil Spirit', shape: 'SPIRIT', element: 'ember',
    palette: palette('#4a2a3a', '#754458', '#b8788c', '#ffc4d4'),
    statMod: { hp: 1.2, atk: 1.6, def: 1.1 },
    blurb: 'Rises with the vent and does not settle.',
  },
  fallenspirit: {
    name: 'Fallen Light', shape: 'SPIRIT', element: 'sun',
    palette: palette('#2c3050', '#474f80', '#8f9cd4', '#fff4c0'),
    statMod: { hp: 1.25, atk: 1.75, def: 1.1 },
    blurb: 'Came down with whatever hit the shallows.',
  },
  voidspirit: {
    name: 'Void Spirit', shape: 'SPIRIT', element: 'moon',
    palette: palette('#1c1428', '#2e2440', '#5c4680', '#a88fd4'),
    statMod: { hp: 1.4, atk: 2, def: 1.3 },
    blurb: 'The quiet between two heartbeats, given a shape.',
  },
};

// -------------------------------------------------------------- late bosses
//
// One boss per terrain; the first twelve are above, these finish the table.

const LATE_BOSSES = {
  saltMother: {
    name: 'The Salt Mother', shape: 'TURTLE', element: 'water', boss: true,
    palette: palette('#1e3330', '#2f544e', '#63a39a', '#dff0e4'),
    statMod: { hp: 2.2, atk: 1.2, def: 2.2 },
    blurb: 'The marsh grew around her, not the other way about.',
  },
  emberJudge: {
    name: 'The Ember Judge', shape: 'SPIRIT', element: 'ember', boss: true,
    palette: palette('#5c1c10', '#8a3020', '#e0704a', '#ffd4a8'),
    statMod: { hp: 1.6, atk: 1.8, def: 1.3 },
    blurb: 'Decides what burned fairly. Usually decides it did not.',
  },
  theStillLake: {
    name: 'The Still Lake', shape: 'SPIRIT', element: 'moon', boss: true,
    palette: palette('#1c2634', '#324458', '#7093b8', '#e0f4ff'),
    statMod: { hp: 2, atk: 1.6, def: 1.8 },
    blurb: 'Not a thing in the lake. The lake.',
  },
  theBreather: {
    name: 'The Breather', shape: 'SERPENT', element: 'ember', boss: true,
    palette: palette('#3a1e2c', '#5c3444', '#b06478', '#ffc4d4'),
    statMod: { hp: 2.1, atk: 1.9, def: 1.5 },
    blurb: 'Every vent in the field is one of its mouths.',
  },
  theFallen: {
    name: 'The Fallen', shape: 'GOLEM', element: 'sun', boss: true,
    palette: palette('#242844', '#3d4470', '#8090c4', '#fff4c0'),
    statMod: { hp: 2.3, atk: 2, def: 1.9 },
    blurb: 'Whatever came down is still warm, and still moving.',
  },
  theUndertow: {
    name: 'The Undertow', shape: 'SERPENT', element: 'water', boss: true,
    palette: palette('#0c1622', '#182c3c', '#356084', '#9fc8e0'),
    statMod: { hp: 2.7, atk: 2.1, def: 2 },
    blurb: 'Not a current. A decision the water made about you.',
  },
};

Object.assign(ENEMIES, NATIVES, LATE_BOSSES, HOSTILE_CAPYBARAS);

export const ENEMY_IDS = Object.keys(ENEMIES);

export function enemy(id) {
  return ENEMIES[id];
}

/** Everything that is not a boss — the pool terrains draw from. */
export function regularEnemyIds() {
  return ENEMY_IDS.filter((id) => !ENEMIES[id].boss);
}

export function bossIds() {
  return ENEMY_IDS.filter((id) => ENEMIES[id].boss);
}
