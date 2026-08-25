// The 18 idle generators. Each unlocks the next, so there is always a visible
// "one more thing" hanging just out of reach.
//
// id      stable key used in save files — never rename
// name    display name
// cost    price of the first unit
// rate    zen per second per unit
// sprite  key into render/sprites.js scenery templates
// blurb   flavour text shown in the tooltip

export const BUILDINGS = [
  {
    id: 'lilypad',
    name: 'Lily Pad',
    cost: 15,
    rate: 0.1,
    sprite: 'lilypad',
    blurb: 'A good capybara needs somewhere to float. This is that somewhere.',
  },
  {
    id: 'yuzuSapling',
    name: 'Yuzu Sapling',
    cost: 100,
    rate: 1,
    sprite: 'sapling',
    blurb: 'Grows the citrus that makes the bath water smell like a good decision.',
  },
  {
    id: 'mudPuddle',
    name: 'Mud Puddle',
    cost: 1.1e3,
    rate: 8,
    sprite: 'puddle',
    blurb: 'Free exfoliation. The capybaras insist it is a spa treatment.',
  },
  {
    id: 'onsenBasin',
    name: 'Onsen Basin',
    cost: 12e3,
    rate: 47,
    sprite: 'basin',
    blurb: 'Hot water, floating yuzu, zero urgency. The core product.',
  },
  {
    id: 'bambooGrove',
    name: 'Bamboo Grove',
    cost: 130e3,
    rate: 260,
    sprite: 'bamboo',
    blurb: 'Snacks that double as scenery. Extremely efficient.',
  },
  {
    id: 'riverbankDen',
    name: 'Riverbank Den',
    cost: 1.4e6,
    rate: 1400,
    sprite: 'den',
    blurb: 'Where the capybaras go to nap professionally.',
  },
  {
    id: 'capyCafe',
    name: 'Capy Café',
    cost: 20e6,
    rate: 7800,
    sprite: 'cafe',
    blurb: 'Service is slow. Nobody has ever complained.',
  },
  {
    id: 'springResort',
    name: 'Hot Spring Resort',
    cost: 330e6,
    rate: 44e3,
    sprite: 'resort',
    blurb: 'Now with towels. Management considers this a major upgrade.',
  },
  {
    id: 'zenGarden',
    name: 'Zen Garden',
    cost: 5.1e9,
    rate: 260e3,
    sprite: 'garden',
    blurb: 'Raked sand, arranged stones, one capybara asleep in the middle.',
  },
  {
    id: 'floatingMarket',
    name: 'Floating Market',
    cost: 75e9,
    rate: 1.6e6,
    sprite: 'market',
    blurb: 'Commerce, but everyone involved is horizontal.',
  },
  {
    id: 'moonBathhouse',
    name: 'Moon Bathhouse',
    cost: 1e12,
    rate: 10e6,
    sprite: 'bathhouse',
    blurb: 'Open only at night. The tides handle the plumbing.',
  },
  {
    id: 'crystalSprings',
    name: 'Crystal Springs',
    cost: 14e12,
    rate: 65e6,
    sprite: 'crystal',
    blurb: 'The water hums. The capybaras hum back. Nobody asks questions.',
  },
  {
    id: 'skyTerrace',
    name: 'Sky Terrace',
    cost: 200e12,
    rate: 430e6,
    sprite: 'terrace',
    blurb: 'A bath above the clouds. Getting up there is somebody else’s problem.',
  },
  {
    id: 'dreamLagoon',
    name: 'Dream Lagoon',
    cost: 2.9e15,
    rate: 2.9e9,
    sprite: 'lagoon',
    blurb: 'Exists mainly while you are asleep. Produces anyway.',
  },
  {
    id: 'timeOnsen',
    name: 'Time Onsen',
    cost: 43e15,
    rate: 21e9,
    sprite: 'timeonsen',
    blurb: 'One soak here is forty minutes and also nine years.',
  },
  {
    id: 'astralPond',
    name: 'Astral Pond',
    cost: 620e15,
    rate: 150e9,
    sprite: 'astral',
    blurb: 'Reflects constellations that have not happened yet.',
  },
  {
    id: 'yuzuDimension',
    name: 'Yuzu Dimension',
    cost: 9e18,
    rate: 1.1e12,
    sprite: 'dimension',
    blurb: 'An entire plane of existence, citrus-scented throughout.',
  },
  {
    id: 'capySingularity',
    name: 'Capy Singularity',
    cost: 130e18,
    rate: 8.3e12,
    sprite: 'singularity',
    blurb: 'Infinitely dense, infinitely relaxed. Light bends around the chonk.',
  },
];

export const BUILDINGS_BY_ID = Object.fromEntries(BUILDINGS.map((b) => [b.id, b]));

/**
 * A generator is visible once you can nearly afford it, or once the previous
 * one is owned. Keeps the shop from being an intimidating wall on minute one.
 */
export function isBuildingVisible(building, state) {
  const index = BUILDINGS.findIndex((b) => b.id === building.id);
  if (index <= 0) return true;
  if ((state.buildings[building.id] || 0) > 0) return true;
  const prev = BUILDINGS[index - 1];
  if ((state.buildings[prev.id] || 0) >= 1 && state.lifetimeZen >= building.cost * 0.35) return true;
  return state.lifetimeZen >= building.cost * 0.8;
}
