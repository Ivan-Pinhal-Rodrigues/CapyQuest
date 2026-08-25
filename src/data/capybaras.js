// Eighteen hostile capybaras, one per terrain.
//
// You are a capybara. So is most of what stops you. Two hand-drawn poses
// (CAPY_HOSTILE and the heavier CAPY_HULK) carry all eighteen through palette
// swaps — the same trick the rest of the art uses.
//
// statMod multiplies the stage curve from balance.js. Capybaras skew tanky:
// they are the wall of a terrain rather than its damage.

const EYE = { e: '#141018', w: '#fdf6e8' };

function palette(dark, mid, light, accent) {
  return { '.': null, o: '#1c1420', 1: dark, 2: mid, 3: light, 4: accent, ...EYE };
}

export const HOSTILE_CAPYBARAS = {
  feralCapy: {
    name: 'Feral Capybara', shape: 'CAPY_HOSTILE', element: 'leaf',
    palette: palette('#5c4426', '#7a5334', '#a67243', '#c99560'),
    statMod: { hp: 1.3, atk: 0.9, def: 1.2 },
    blurb: 'Went upstream, came back wrong.',
  },
  mirebornCapy: {
    name: 'Mireborn', shape: 'CAPY_HULK', element: 'leaf',
    palette: palette('#3a2a14', '#5c4420', '#8a6a30', '#a88a4d'),
    statMod: { hp: 1.9, atk: 0.85, def: 1.5 },
    blurb: 'More mud than capybara now, and heavier for it.',
  },
  sunbakedCapy: {
    name: 'Sunbaked Capybara', shape: 'CAPY_HOSTILE', element: 'ember',
    palette: palette('#7a3418', '#a8542a', '#d98a4d', '#ffc98a'),
    statMod: { hp: 1.1, atk: 1.3, def: 0.9 },
    blurb: 'Spent too long in the hot pool. Has opinions about shade.',
  },
  thicketCapy: {
    name: 'Thicket Stalker', shape: 'CAPY_HOSTILE', element: 'leaf',
    palette: palette('#2f4a1e', '#44702f', '#68a34d', '#a8d47a'),
    statMod: { hp: 1.15, atk: 1.15, def: 1.1 },
    blurb: 'You will hear the bamboo move before you see it.',
  },
  driftCapy: {
    name: 'Drift Capybara', shape: 'CAPY_HOSTILE', element: 'water',
    palette: palette('#1e3a5c', '#2f5c87', '#4d8fc9', '#a8d4ff'),
    statMod: { hp: 1.2, atk: 1.05, def: 1.15 },
    blurb: 'Lets the current do the work. Arrives anyway.',
  },
  bathhouseThug: {
    name: 'Bathhouse Thug', shape: 'CAPY_HULK', element: 'moon',
    palette: palette('#4a2f5c', '#6d4487', '#9c6bc2', '#e0b8ff'),
    statMod: { hp: 2.0, atk: 1.2, def: 1.6 },
    blurb: 'Runs the towels. Runs the tokens. Runs you off.',
  },
  moonTouchedCapy: {
    name: 'Moon-Touched', shape: 'CAPY_HOSTILE', element: 'moon',
    palette: palette('#2a2444', '#443a6b', '#6b5ca3', '#c9b8ff'),
    statMod: { hp: 1.25, atk: 1.35, def: 1.0 },
    blurb: 'Bathed under a full moon once too often.',
  },
  quartzCapy: {
    name: 'Quartz-Hide', shape: 'CAPY_HULK', element: 'water',
    palette: palette('#2a5c6b', '#3f87a3', '#6bc2d9', '#d9f7ff'),
    statMod: { hp: 2.2, atk: 0.95, def: 2.0 },
    blurb: 'The cave grew into it. It does not seem to mind.',
  },
  cloudCapy: {
    name: 'Cloudrunner', shape: 'CAPY_HOSTILE', element: 'sun',
    palette: palette('#4a5c6b', '#6d87a3', '#9cb8cc', '#ffe8a8'),
    statMod: { hp: 1.0, atk: 1.45, def: 0.85 },
    blurb: 'Faster than a capybara has any business being.',
  },
  sleeperCapy: {
    name: 'The Sleeper', shape: 'CAPY_HULK', element: 'moon',
    palette: palette('#3a2454', '#573a80', '#8f63c2', '#d9c4ff'),
    statMod: { hp: 2.4, atk: 1.1, def: 1.4 },
    blurb: 'Still asleep. Fighting you regardless.',
  },
  emberCapy: {
    name: 'Ember-Hide', shape: 'CAPY_HOSTILE', element: 'ember',
    palette: palette('#8a2f1e', '#c94a2a', '#f0824a', '#ffd08a'),
    statMod: { hp: 1.2, atk: 1.5, def: 0.95 },
    blurb: 'Warm to the touch. Do not touch.',
  },
  brackishCapy: {
    name: 'Brackish Capybara', shape: 'CAPY_HOSTILE', element: 'water',
    palette: palette('#2a4442', '#3f6d68', '#63a39a', '#b8e0d4'),
    statMod: { hp: 1.5, atk: 1.1, def: 1.3 },
    blurb: 'Salt-cured and patient about it.',
  },
  charredCapy: {
    name: 'Charred', shape: 'CAPY_HULK', element: 'ember',
    palette: palette('#2a1c1c', '#4a3030', '#7a4d44', '#d97a4a'),
    statMod: { hp: 2.1, atk: 1.35, def: 1.5 },
    blurb: 'Walked out of the fire. Kept walking.',
  },
  glassCapy: {
    name: 'Glass Capybara', shape: 'CAPY_HOSTILE', element: 'moon',
    palette: palette('#243044', '#3f5470', '#6b8fb8', '#d4ecff'),
    statMod: { hp: 1.1, atk: 1.55, def: 0.8 },
    blurb: 'You can see straight through it. It sees you too.',
  },
  ventCapy: {
    name: 'Vent Dweller', shape: 'CAPY_HULK', element: 'ember',
    palette: palette('#4a2a3a', '#754458', '#a86b84', '#ffb8c9'),
    statMod: { hp: 2.3, atk: 1.3, def: 1.7 },
    blurb: 'Breathes what comes up. Thrives on it.',
  },
  starlitCapy: {
    name: 'Starlit Capybara', shape: 'CAPY_HOSTILE', element: 'sun',
    palette: palette('#2c3050', '#474f80', '#7d8ac2', '#ffefa8'),
    statMod: { hp: 1.3, atk: 1.6, def: 1.0 },
    blurb: 'Something fell here and it was standing underneath.',
  },
  drownedCapy: {
    name: 'The Drowned', shape: 'CAPY_HULK', element: 'water',
    palette: palette('#16283a', '#26445c', '#447089', '#a8ccdd'),
    statMod: { hp: 2.6, atk: 1.4, def: 1.8 },
    blurb: 'Went under a long time ago. Has not surfaced. Is here anyway.',
  },
  primeCapy: {
    name: 'Prime Capybara', shape: 'CAPY_HULK', element: 'moon',
    palette: palette('#241c33', '#3b2f52', '#7d5cad', '#4de0c0'),
    statMod: { hp: 3.0, atk: 1.7, def: 2.0 },
    blurb: 'The shape all the others are copies of. It is not pleased about that.',
  },
};

export const HOSTILE_CAPY_IDS = Object.keys(HOSTILE_CAPYBARAS);
