// 96 generator tier upgrades — two per line. They gate on units owned rather
// than money, which turns "buy 10 more Lily Pads" into a real goal instead of
// a rounding error.
//
// Tier 1 unlocks at 10 owned and doubles that line.
// Tier 2 unlocks at 50 owned and triples it.
//
// They do a second job since Phase H: each one advances that line's stage, so
// buying an upgrade renames the thing in the shop and redraws the thing in the
// pond. See `buildingStage` in buildings.js — the stage is read off these
// rather than stored, so an old save arrives at the right stage without a
// migration.

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

  steamCathedral: ['Vaulted Vapour', 'The Great Condensation'],
  fogArchive: ['Damp Index', 'Total Recall, Slowly'],
  tidepoolChoir: ['Perfect Pitch', 'The Note That Holds'],
  ninetailSpring: ['Second Tail', 'All Nine at Once'],
  lanternFlotilla: ['Longer Wicks', 'The Whole Harbour Lit'],
  auroraBasin: ['Low Latitude Licence', 'The Sky Comes Down'],
  whaleRoadFerry: ['Second Whale', 'The Deep Timetable'],
  cloudOrchard: ['Weather Grafting', 'Harvest by Barometer'],
  mirrorDeep: ['True Silvering', 'Reflections All the Way'],
  obsidianSauna: ['Volcanic Seam', 'Cut From One Stone'],
  longWeekend: ['Bank Holiday Monday', 'Friday Abolished'],
  gravityWellSpa: ['Managed Descent', 'Terminal Comfort'],
  chrysalisReef: ['Patient Cocoon', 'What Comes Out'],
  cometBathhouse: ['Shorter Orbit', 'Permanent Perihelion'],
  rootOfTheWorld: ['Deeper Taproot', 'The Root Reaches Back'],
  ashfallSprings: ['Fine Grade Ash', 'The Mountain Contributes'],
  quietLibrary: ['Softer Carpet', 'Silence, Enforced Gently'],
  nebulaTrough: ['Stellar Filtration', 'Nursery Rights'],
  leviathanBasin: ['Deeper Sleeper', 'It Turns Over'],
  solsticeEngine: ['Longer Day', 'Both Solstices'],
  hollowMoon: ['Better Plumbing', 'The Tides Forgive Us'],
  firstWater: ['The Older Spring', 'Before the Before'],
  slowContinent: ['Two Centimetres a Year', 'Arrival, Eventually'],
  yuzuBelt: ['Denser Orbit', 'The Belt Closes'],
  dreamingKiln: ['Hotter Sleep', 'It Wakes, Briefly'],
  undertowCourt: ['Longer Sessions', 'Judgement of the Deep'],
  entropyGardens: ['Managed Decay', 'Planted Faster Than It Falls'],
  lastLightOnsen: ['Extended Hours', 'Open After Closing'],
  unbotheredAxiom: ['Fewer Assumptions', 'Assumes Nothing at All'],
  capybaraAbsolute: ['Locally Everywhere', 'Everywhere, Everywhere'],
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

  steamCathedral: ['The steam found an arch shape on its own.', 'It all comes back down, warm, on schedule.'],
  fogArchive: ['Filed by temperature. Cross-referenced by mood.', 'Everything remembered, nothing hurried.'],
  tidepoolChoir: ['Nine hundred pools, finally in tune.', 'The chord no longer needs anyone to hold it.'],
  ninetailSpring: ['One more branch, one more degree.', 'Nine springs, one bath, no waiting.'],
  lanternFlotilla: ['Burns until morning, then a bit past it.', 'You can read by it from the far bank.'],
  auroraBasin: ['Turns out the sky will come lower if asked.', 'The curtain settles on the water and stays.'],
  whaleRoadFerry: ['Two whales. The timetable is now a suggestion twice over.', 'Departures hourly, if the hour is agreeable.'],
  cloudOrchard: ['Grafted onto a warm front. Holding beautifully.', 'Fruit ripens when the pressure drops.'],
  mirrorDeep: ['A proper silvering. The reflection is warmer than the room.', 'Ponds in ponds in ponds, all soaking.'],
  obsidianSauna: ['Straight down to the seam. Endless black glass.', 'One stone, one room, no joins anywhere.'],
  longWeekend: ['Three days. The correct number of days.', 'Friday has been quietly discontinued.'],
  gravityWellSpa: ['You still fall in. You just arrive nicely.', 'Nothing leaves, and nothing wants to.'],
  chrysalisReef: ['Give it time. It is giving itself time.', 'Whatever emerges also wants a bath.'],
  cometBathhouse: ['Every eleven years now. Book early.', 'It simply stopped going away.'],
  rootOfTheWorld: ['Down past the water table, into the good dark.', 'It found the other end and grew back through.'],
  ashfallSprings: ['Sieved. Genuinely excellent for the coat.', 'The mountain sends a little more every year.'],
  quietLibrary: ['You cannot hear your own feet now.', 'Nobody is shushed. Nobody needs to be.'],
  nebulaTrough: ['The grit is filtered. The warmth is not.', 'Drawing directly from where stars are made.'],
  leviathanBasin: ['Deeper sleep, hotter water. Do not wake it.', 'It turned over once. The bath was perfect for a decade.'],
  solsticeEngine: ['The longest day, extended by agreement.', 'It runs in both directions now, and never rests.'],
  hollowMoon: ['The pipes no longer clang at high tide.', 'The tides have accepted the new arrangement.'],
  firstWater: ['There was an earlier one. Of course there was.', 'From before the idea of water had settled.'],
  slowContinent: ['Twice the speed. Still slower than a nap.', 'It gets where it was going. Everyone is patient.'],
  yuzuBelt: ['More fruit per orbit. The sun does not mind.', 'The ring closes. Harvest is now permanent.'],
  dreamingKiln: ['Hotter dreams fire better tile.', 'It opened one eye, glazed everything, and went back under.'],
  undertowCourt: ['The sessions run long. The water is warm. Nobody objects.', 'The deep has ruled. The ruling is: stay in.'],
  entropyGardens: ['Falling apart, but tidily.', 'Planted faster than it decays. Barely. Forever.'],
  lastLightOnsen: ['Open a little later every night.', 'Still open. The closing sign is decorative.'],
  unbotheredAxiom: ['Fewer things assumed, same amount of rest.', 'It rests on nothing whatsoever, extremely comfortably.'],
  capybaraAbsolute: ['Capybara, in this region, at all points.', 'Capybara, generally, without exception, forever.'],
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
