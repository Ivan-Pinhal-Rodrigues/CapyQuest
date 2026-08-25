// 36 generator tier upgrades — two per line. They gate on units owned rather
// than money, which turns "buy 10 more Lily Pads" into a real goal instead of
// a rounding error.
//
// Tier 1 unlocks at 10 owned and doubles that line.
// Tier 2 unlocks at 50 owned and triples it.

import { BUILDINGS } from './buildings.js';

const NAMES = {
  lilypad: ['Broad Leaves', 'Rootless Drift'],
  yuzuSapling: ['Deep Roots', 'Endless Harvest'],
  mudPuddle: ['Mineral Silt', 'Bottomless Wallow'],
  onsenBasin: ['Cedar Lining', 'Volcanic Tap'],
  bambooGrove: ['Sweet Shoots', 'Grove Eternal'],
  riverbankDen: ['Insulated Burrow', 'Warren Network'],
  capyCafe: ['Second Roast', 'Franchise Rights'],
  springResort: ['Heated Towels', 'Five Star Rating'],
  zenGarden: ['The Perfect Rake', 'Stone That Hums'],
  floatingMarket: ['Barge Fleet', 'Monsoon Trade'],
  moonBathhouse: ['Tidal Boiler', 'Full Moon Charter'],
  crystalSprings: ['Resonant Geode', 'Prism Waters'],
  skyTerrace: ['Cloud Anchors', 'Stratosphere Deck'],
  dreamLagoon: ['Lucid Currents', 'Shared Dreaming'],
  timeOnsen: ['The Slow Hour', 'Recursive Soak'],
  astralPond: ['Borrowed Star Chart', 'Void Reflection'],
  yuzuDimension: ['The Citrus Constant', 'Infinite Peel'],
  capySingularity: ['Event Horizon Spa', 'Absolute Chonk'],
};

const BLURBS = {
  lilypad: ['Wider pads, wider capybara. The maths works out.', 'Untethered. They go where the wind says.'],
  yuzuSapling: ['Down past the clay, into the good water.', 'Fruit in every season, including the made-up ones.'],
  mudPuddle: ['Turns out the silt was doing most of the work.', 'Nobody has found the bottom. Nobody has looked hard.'],
  onsenBasin: ['The wood smells incredible when it is wet.', 'Plumbed directly into something that should worry you.'],
  bambooGrove: ['Harvested young, before it gets opinions.', 'Cut one, three grow back. Standard bamboo behaviour.'],
  riverbankDen: ['Moss packing keeps the heat in all winter.', 'Every den connects to every other den now.'],
  capyCafe: ['The second cup is where the profit lives.', 'There is a Capy Café in every pond now.'],
  springResort: ['Warm towel, cold air, perfect contrast.', 'The review said "staff extremely horizontal". Five stars.'],
  zenGarden: ['Lines so straight they fix your posture.', 'Low frequency. You feel it in your teeth, pleasantly.'],
  floatingMarket: ['Forty barges, one enormous nap.', 'Rain season doubles the traffic and the vibes.'],
  moonBathhouse: ['The tide does the heating. Free labour.', 'Booked solid for the next eleven full moons.'],
  crystalSprings: ['It sings back when the capybaras hum.', 'Every ripple splits into seven colours.'],
  skyTerrace: ['Bolted to nothing. Holds fine.', 'Thin air, thick steam, incredible view.'],
  dreamLagoon: ['You can steer, a little, if you stay calm.', 'Everyone naps in the same dream to save space.'],
  timeOnsen: ['Sixty minutes, stretched to taste.', 'The soak contains a smaller soak, forever.'],
  astralPond: ['It maps stars that have not agreed to exist yet.', 'Stare in long enough and it gets bored first.'],
  yuzuDimension: ['A universal constant, and it smells like citrus.', 'One peel, unwound, wraps the whole dimension.'],
  capySingularity: ['Admission is free. Departure is theoretical.', 'Mass beyond measurement. Attitude beyond reproach.'],
};

export const TIER_UPGRADES = BUILDINGS.flatMap((building) => [
  {
    id: `${building.id}_t1`,
    buildingId: building.id,
    tier: 1,
    name: NAMES[building.id][0],
    cost: building.cost * 12,
    req: { building: { id: building.id, count: 10 } },
    effects: [{ type: 'buildingMult', id: building.id, value: 2 }],
    blurb: BLURBS[building.id][0],
  },
  {
    id: `${building.id}_t2`,
    buildingId: building.id,
    tier: 2,
    name: NAMES[building.id][1],
    cost: building.cost * 800,
    req: { building: { id: building.id, count: 50 } },
    effects: [{ type: 'buildingMult', id: building.id, value: 3 }],
    blurb: BLURBS[building.id][1],
  },
]);

export const TIER_UPGRADES_BY_ID = Object.fromEntries(TIER_UPGRADES.map((u) => [u.id, u]));
