// The 48 idle generators. Each unlocks the next, so there is always a visible
// "one more thing" hanging just out of reach.
//
// id        stable key used in save files — never rename
// name      display name at stage 1
// stages    the two later display names, earned at the first and second tier
//           upgrade. The pond entity matures: a Lily Pad that has had both its
//           upgrades is a Lily Field, in the shop and on the water alike.
// cost      price of the first unit
// rate      zen per second per unit
// family    key into SHAPE_FAMILIES in render/sprites.js — three drawings, one
//           per stage
// habitat   where it sits in the pond: water, shallows, bank, ridge, sky
// blurb     flavour text shown in the tooltip
//
// ---------------------------------------------------------------------------
// THE LADDER PAST EIGHTEEN
//
// The first eighteen are untouched — ids, costs, rates, names and blurbs. Every
// figure `docs/BALANCE.md` records for the opening (3m17s to combat, the ×10
// first step, the 100s payback on the first two rungs) still describes the game
// exactly, because none of the numbers those were measured against moved.
//
// Nineteen onwards continues at ×14.5 cost and ×13 rate. That is the same cost
// slope the back half of the original ladder already used; the rate slope is
// much steeper than the ×7.2 it used to run at, and deliberately.
//
// Payback doubled per rung in the original eighteen, which is a fine shape for
// eighteen and an impossible one for forty-eight: continued honestly it puts
// the last rung at 1e16 seconds, and continued dishonestly it flattens payback
// out entirely and turns thirty rungs into one blurred purchase. At ×14.5/×13
// payback rises about 11% a rung, reaching 13 years at generator 48 — a real
// long-term goal, in a game whose late multipliers are measured in the
// thousands. `docs/BALANCE.md` carries what that works out to in practice.
// ---------------------------------------------------------------------------

export const BUILDINGS = [
  {
    id: 'lilypad',
    name: 'Lily Pad',
    stages: ['Lily Spread', 'Lily Field'],
    cost: 10,
    rate: 0.1,
    family: 'pad',
    habitat: 'water',
    blurb: 'A good capybara needs somewhere to float. This is that somewhere.',
  },
  {
    id: 'yuzuSapling',
    name: 'Yuzu Sapling',
    stages: ['Yuzu Tree', 'Yuzu Orchard'],
    cost: 100,
    rate: 1,
    family: 'tree',
    habitat: 'bank',
    blurb: 'Grows the citrus that makes the bath water smell like a good decision.',
  },
  {
    id: 'mudPuddle',
    name: 'Mud Puddle',
    stages: ['Mud Wallow', 'Mud Flats'],
    cost: 1.1e3,
    rate: 8,
    family: 'pool',
    habitat: 'shallows',
    blurb: 'Free exfoliation. The capybaras insist it is a spa treatment.',
  },
  {
    id: 'onsenBasin',
    name: 'Onsen Basin',
    stages: ['Onsen Spring', 'Onsen Cascade'],
    cost: 12e3,
    rate: 47,
    family: 'pool',
    habitat: 'shallows',
    blurb: 'Hot water, floating yuzu, zero urgency. The core product.',
  },
  {
    id: 'bambooGrove',
    name: 'Bamboo Grove',
    stages: ['Bamboo Stand', 'Bamboo Sea'],
    cost: 130e3,
    rate: 260,
    family: 'tree',
    habitat: 'bank',
    blurb: 'Snacks that double as scenery. Extremely efficient.',
  },
  {
    id: 'riverbankDen',
    name: 'Riverbank Den',
    stages: ['Riverbank Lodge', 'Riverbank Warren'],
    cost: 1.4e6,
    rate: 1400,
    family: 'hut',
    habitat: 'bank',
    blurb: 'Where the capybaras go to nap professionally.',
  },
  {
    id: 'capyCafe',
    name: 'Capy Café',
    stages: ['Capy Teahouse', 'Café Quarter'],
    cost: 20e6,
    rate: 7800,
    family: 'hut',
    habitat: 'bank',
    blurb: 'Service is slow. Nobody has ever complained.',
  },
  {
    id: 'springResort',
    name: 'Hot Spring Resort',
    stages: ['Spring Retreat', 'Grand Onsen'],
    cost: 330e6,
    rate: 44e3,
    family: 'hut',
    habitat: 'ridge',
    blurb: 'Now with towels. Management considers this a major upgrade.',
  },
  {
    id: 'zenGarden',
    name: 'Zen Garden',
    stages: ['Stone Shrine', 'Garden Temple'],
    cost: 5.1e9,
    rate: 260e3,
    family: 'arch',
    habitat: 'bank',
    blurb: 'Raked sand, arranged stones, one capybara asleep in the middle.',
  },
  {
    id: 'floatingMarket',
    name: 'Floating Market',
    stages: ['Market Row', 'Market City'],
    cost: 75e9,
    rate: 1.6e6,
    family: 'arch',
    habitat: 'water',
    blurb: 'Commerce, but everyone involved is horizontal.',
  },
  {
    id: 'moonBathhouse',
    name: 'Moon Bathhouse',
    stages: ['Moon Spire', 'Lunar Citadel'],
    cost: 1e12,
    rate: 10e6,
    family: 'tower',
    habitat: 'ridge',
    blurb: 'Open only at night. The tides handle the plumbing.',
  },
  {
    id: 'crystalSprings',
    name: 'Crystal Springs',
    stages: ['Singing Geode', 'Prism Monolith'],
    cost: 14e12,
    rate: 65e6,
    family: 'crystal',
    habitat: 'shallows',
    blurb: 'The water hums. The capybaras hum back. Nobody asks questions.',
  },
  {
    id: 'skyTerrace',
    name: 'Sky Terrace',
    stages: ['Cloud Spire', 'Skyward Citadel'],
    cost: 200e12,
    rate: 430e6,
    family: 'tower',
    habitat: 'sky',
    blurb: 'A bath above the clouds. Getting up there is somebody else’s problem.',
  },
  {
    id: 'dreamLagoon',
    name: 'Dream Lagoon',
    stages: ['Lucid Spring', 'Dreaming Cascade'],
    cost: 2.9e15,
    rate: 2.9e9,
    family: 'pool',
    habitat: 'water',
    blurb: 'Exists mainly while you are asleep. Produces anyway.',
  },
  {
    id: 'timeOnsen',
    name: 'Time Onsen',
    stages: ['Hour Gate', 'The Long Nexus'],
    cost: 43e15,
    rate: 21e9,
    family: 'portal',
    habitat: 'shallows',
    blurb: 'One soak here is forty minutes and also nine years.',
  },
  {
    id: 'astralPond',
    name: 'Astral Pond',
    stages: ['Astral Cluster', 'Pond Constellation'],
    cost: 620e15,
    rate: 150e9,
    family: 'orb',
    habitat: 'water',
    blurb: 'Reflects constellations that have not happened yet.',
  },
  {
    id: 'yuzuDimension',
    name: 'Yuzu Dimension',
    stages: ['Citrus Gate', 'Yuzu Nexus'],
    cost: 9e18,
    rate: 1.1e12,
    family: 'portal',
    habitat: 'sky',
    blurb: 'An entire plane of existence, citrus-scented throughout.',
  },
  {
    id: 'capySingularity',
    name: 'Capy Singularity',
    stages: ['Capy Nova', 'Capy Galaxy'],
    cost: 130e18,
    rate: 8.3e12,
    family: 'star',
    habitat: 'sky',
    blurb: 'Infinitely dense, infinitely relaxed. Light bends around the chonk.',
  },

  // ------------------------------------------------------- past the horizon

  {
    id: 'steamCathedral',
    name: 'Steam Cathedral',
    stages: ['Steam Basilica', 'The Vapour See'],
    cost: 1.9e21,
    rate: 1.1e14,
    family: 'arch',
    habitat: 'ridge',
    blurb: 'Nobody built it. The steam simply kept going up and got organised.',
  },
  {
    id: 'fogArchive',
    name: 'Fog Archive',
    stages: ['Fog Reading Room', 'The Whole Damp Library'],
    cost: 2.7e22,
    rate: 1.4e15,
    family: 'hut',
    habitat: 'bank',
    blurb: 'Every bath ever taken, filed by temperature. Borrowing is discouraged.',
  },
  {
    id: 'tidepoolChoir',
    name: 'Tidepool Choir',
    stages: ['Tidepool Consort', 'The Standing Chord'],
    cost: 4e23,
    rate: 1.8e16,
    family: 'pool',
    habitat: 'shallows',
    blurb: 'Nine hundred small pools, all humming the same note, all slightly late.',
  },
  {
    id: 'ninetailSpring',
    name: 'Nine-Tail Spring',
    stages: ['Nine-Tail Font', 'The Ninefold Cascade'],
    cost: 5.7e24,
    rate: 2.4e17,
    family: 'pool',
    habitat: 'shallows',
    blurb: 'Splits into nine and comes back as one, warmer than it left.',
  },
  {
    id: 'lanternFlotilla',
    name: 'Lantern Flotilla',
    stages: ['Lantern Convoy', 'The Lit Sea'],
    cost: 8.3e25,
    rate: 3.1e18,
    family: 'pad',
    habitat: 'water',
    blurb: 'Paper boats, one candle each, going nowhere at a very pleasant speed.',
  },
  {
    id: 'auroraBasin',
    name: 'Aurora Basin',
    stages: ['Aurora Spring', 'The Curtain Falls'],
    cost: 1.2e27,
    rate: 4e19,
    family: 'pool',
    habitat: 'shallows',
    blurb: 'The sky drips into it. The capybaras have stopped finding this strange.',
  },
  {
    id: 'whaleRoadFerry',
    name: 'Whale-Road Ferry',
    stages: ['Whale-Road Line', 'The Deep Concourse'],
    cost: 1.8e28,
    rate: 5.2e20,
    family: 'arch',
    habitat: 'water',
    blurb: 'Departs when it departs. The whale has its own view on the timetable.',
  },
  {
    id: 'cloudOrchard',
    name: 'Cloud Orchard',
    stages: ['Cloud Grove', 'The Hanging Harvest'],
    cost: 2.5e29,
    rate: 6.8e21,
    family: 'tree',
    habitat: 'sky',
    blurb: 'Fruit grown in weather. Falls upward if you are not paying attention.',
  },
  {
    id: 'mirrorDeep',
    name: 'Mirror Deep',
    stages: ['Mirror Spread', 'The Facing Water'],
    cost: 3.7e30,
    rate: 8.8e22,
    family: 'pad',
    habitat: 'water',
    blurb: 'A pond with a pond in it. Both of them are extremely relaxed.',
  },
  {
    id: 'obsidianSauna',
    name: 'Obsidian Sauna',
    stages: ['Obsidian Geode', 'The Black Monolith'],
    cost: 5.3e31,
    rate: 1.1e24,
    family: 'crystal',
    habitat: 'ridge',
    blurb: 'Cut from one stone, heated from underneath, and it has opinions about towels.',
  },
  {
    id: 'longWeekend',
    name: 'The Long Weekend',
    stages: ['The Longer Weekend', 'The Permanent Saturday'],
    cost: 7.7e32,
    rate: 1.5e25,
    family: 'hut',
    habitat: 'bank',
    blurb: 'Owned, kept, and extended. Monday has been notified and is taking it well.',
  },
  {
    id: 'gravityWellSpa',
    name: 'Gravity Well Spa',
    stages: ['Well Spire', 'The Deep Citadel'],
    cost: 1.1e34,
    rate: 1.9e26,
    family: 'tower',
    habitat: 'sky',
    blurb: 'Everything falls in. Nothing minds. The towels are on the way down too.',
  },
  {
    id: 'chrysalisReef',
    name: 'Chrysalis Reef',
    stages: ['Chrysalis Bloom', 'The Waking Reef'],
    cost: 1.6e35,
    rate: 2.5e27,
    family: 'pad',
    habitat: 'water',
    blurb: 'Something is becoming something else in there, slowly, at spa pace.',
  },
  {
    id: 'cometBathhouse',
    name: 'Comet Bathhouse',
    stages: ['Comet Spire', 'The Trailing Citadel'],
    cost: 2.4e36,
    rate: 3.3e28,
    family: 'tower',
    habitat: 'sky',
    blurb: 'Open one week in eighty years. Booked out for the next nine passes.',
  },
  {
    id: 'rootOfTheWorld',
    name: 'Root of the World',
    stages: ['Deeper Root', 'The World Orchard'],
    cost: 3.4e37,
    rate: 4.2e29,
    family: 'tree',
    habitat: 'bank',
    blurb: 'Goes down further than anyone has followed it. Comes back up as fruit.',
  },
  {
    id: 'ashfallSprings',
    name: 'Ashfall Springs',
    stages: ['Ashfall Font', 'The Grey Cascade'],
    cost: 5e38,
    rate: 5.5e30,
    family: 'pool',
    habitat: 'ridge',
    blurb: 'Warm ash, warmer water. Excellent for the coat, terrible for the towels.',
  },
  {
    id: 'quietLibrary',
    name: 'The Quiet Library',
    stages: ['The Quieter Wing', 'The Silent Quarter'],
    cost: 7.2e39,
    rate: 7.2e31,
    family: 'hut',
    habitat: 'bank',
    blurb: 'Books about resting, unread, resting.',
  },
  {
    id: 'nebulaTrough',
    name: 'Nebula Trough',
    stages: ['Nebula Cluster', 'The Long Constellation'],
    cost: 1e41,
    rate: 9.3e32,
    family: 'orb',
    habitat: 'sky',
    blurb: 'A bath filled from a star nursery. Slightly gritty. Wonderfully warm.',
  },
  {
    id: 'leviathanBasin',
    name: 'Leviathan Basin',
    stages: ['Leviathan Spring', 'The Enormous Cascade'],
    cost: 1.5e42,
    rate: 1.2e34,
    family: 'pool',
    habitat: 'water',
    blurb: 'Something very large is asleep at the bottom and heats the whole thing.',
  },
  {
    id: 'solsticeEngine',
    name: 'Solstice Engine',
    stages: ['Solstice Shrine', 'The Turning Temple'],
    cost: 2.2e43,
    rate: 1.6e35,
    family: 'arch',
    habitat: 'ridge',
    blurb: 'Turns the longest day into hot water. Runs the other way in winter.',
  },
  {
    id: 'hollowMoon',
    name: 'Hollow Moon',
    stages: ['Hollow Nova', 'The Emptied Galaxy'],
    cost: 3.2e44,
    rate: 2.1e36,
    family: 'star',
    habitat: 'sky',
    blurb: 'Drained, plumbed, and refilled. The tides were furious for a fortnight.',
  },
  {
    id: 'firstWater',
    name: 'First Water',
    stages: ['Older Water', 'The Water Before'],
    cost: 4.6e45,
    rate: 2.7e37,
    family: 'pool',
    habitat: 'shallows',
    blurb: 'The original. Everything since has been a very good imitation.',
  },
  {
    id: 'slowContinent',
    name: 'The Slow Continent',
    stages: ['The Slower Coast', 'The Unhurried World'],
    cost: 6.7e46,
    rate: 3.5e38,
    family: 'hut',
    habitat: 'bank',
    blurb: 'Drifts about a centimetre a year, entirely towards the warm bit.',
  },
  {
    id: 'yuzuBelt',
    name: 'Galactic Yuzu Belt',
    stages: ['The Citrus Arm', 'The Peeled Constellation'],
    cost: 9.7e47,
    rate: 4.5e39,
    family: 'orb',
    habitat: 'sky',
    blurb: 'A ring of fruit around a small sun. Harvest season lasts a millennium.',
  },
  {
    id: 'dreamingKiln',
    name: 'Dreaming Kiln',
    stages: ['Dreaming Geode', 'The Fired Monolith'],
    cost: 1.4e49,
    rate: 5.9e40,
    family: 'crystal',
    habitat: 'ridge',
    blurb: 'Bakes the tiles the whole pond is lined with. Has been asleep for centuries.',
  },
  {
    id: 'undertowCourt',
    name: 'The Undertow Court',
    stages: ['The Undertow Row', 'The Sunken City'],
    cost: 2e50,
    rate: 7.6e41,
    family: 'arch',
    habitat: 'water',
    blurb: 'Rules on matters of current. Sessions are held entirely underwater and go long.',
  },
  {
    id: 'entropyGardens',
    name: 'Entropy Gardens',
    stages: ['Entropy Grove', 'The Last Orchard'],
    cost: 3e51,
    rate: 9.9e42,
    family: 'tree',
    habitat: 'bank',
    blurb: 'Everything here is falling apart at exactly the rate it is being planted.',
  },
  {
    id: 'lastLightOnsen',
    name: 'Last Light Onsen',
    stages: ['Last Light Gate', 'The Final Nexus'],
    cost: 4.3e52,
    rate: 1.3e44,
    family: 'portal',
    habitat: 'ridge',
    blurb: 'Open until the very end, and then a little after that, for stragglers.',
  },
  {
    id: 'unbotheredAxiom',
    name: 'The Unbothered Axiom',
    stages: ['The Unbothered Proof', 'The Unbothered Temple'],
    cost: 6.2e53,
    rate: 1.7e45,
    family: 'arch',
    habitat: 'sky',
    blurb: 'Cannot be derived from anything simpler. Rests on nothing. Rests very well.',
  },
  {
    id: 'capybaraAbsolute',
    name: 'Capybara Absolute',
    stages: ['Capybara Ascendant', 'Capybara, Everywhere'],
    cost: 9e54,
    rate: 2.2e46,
    family: 'star',
    habitat: 'sky',
    blurb: 'Not a bigger capybara. The capybara, obtaining generally.',
  },
];

export const BUILDINGS_BY_ID = Object.fromEntries(BUILDINGS.map((b) => [b.id, b]));

/** Every habitat a generator may sit in, front of the pond to back. */
export const HABITATS = ['water', 'shallows', 'bank', 'ridge', 'sky'];

/**
 * Which of the three stages a line is at: 0, 1 or 2.
 *
 * Driven by tier upgrades owned rather than by units, which is the whole point
 * — units grow the thing continuously, and an upgrade is the discrete moment it
 * becomes a different thing with a different name. Buying the hundredth Lily
 * Pad makes the pad bigger; buying Broad Leaves makes it a Lily Spread.
 */
export function buildingStage(id, state) {
  let stage = 0;
  if (state?.tierUpgrades?.[`${id}_t1`]) stage++;
  if (state?.tierUpgrades?.[`${id}_t2`]) stage++;
  return stage;
}

/** What this line is currently called. Stage 0 is the generator's own name. */
export function buildingName(building, state) {
  const stage = buildingStage(building.id, state);
  return stage === 0 ? building.name : building.stages[stage - 1];
}

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
