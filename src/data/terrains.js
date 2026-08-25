// 18 terrains, cycled forever.
//
// Two rules make the roster feel like it grows rather than swaps:
//
//  1. Each terrain declares the enemies that are *native* to it. The pool for a
//     terrain is its natives at heavy weight plus everything from earlier
//     terrains at light weight — so descending adds enemies rather than
//     replacing them, and the reeds you fought in stage 1 still turn up later.
//  2. Past the last authored terrain the table cycles with a tier suffix
//     (Reedbank II, Reedbank III …) and the enemies gain an epithet, so stage
//     340 reads as a place rather than as running off the end of the list.

export const TERRAINS = [
  {
    id: 'reedbank', name: 'The Reedbank', element: 'leaf',
    blurb: 'Shallow, sunlit, and full of things that nibble.',
    sky: ['#2f4a2c', '#1b2a1a'],
    natives: ['nibbler', 'hopper', 'feralCapy'],
    boss: 'reedKing',
  },
  {
    id: 'mudflats', name: 'The Mudflats', element: 'leaf',
    blurb: 'Everything here is the same colour as everything else.',
    sky: ['#4a3a24', '#241c12'],
    natives: ['snapper', 'wallower', 'mirebornCapy'],
    boss: 'mireLord',
  },
  {
    id: 'hotsprings', name: 'Scalding Springs', element: 'ember',
    blurb: 'Wonderful for the joints. Terrible for everything else.',
    sky: ['#5c2f24', '#2a1410'],
    natives: ['ember', 'steamwisp', 'sunbakedCapy'],
    boss: 'boilerBeast',
  },
  {
    id: 'bamboo', name: 'The Bamboo Sea', element: 'leaf',
    blurb: 'You cannot see more than two metres in any direction.',
    sky: ['#2c4a2f', '#16281a'],
    natives: ['shrieker', 'grovemoth', 'thicketCapy'],
    boss: 'groveWarden',
  },
  {
    id: 'riverdeep', name: 'Riverdeep', element: 'water',
    blurb: 'The current has opinions about where you are going.',
    sky: ['#1e3a4a', '#0e1c26'],
    natives: ['gulper', 'riversnake', 'driftCapy'],
    boss: 'riverElder',
  },
  {
    id: 'nightmarket', name: 'The Night Market', element: 'moon',
    blurb: 'Everything is for sale, including things that object to it.',
    sky: ['#2f2a4a', '#161428'],
    natives: ['haggler', 'drifter', 'bathhouseThug'],
    boss: 'marketQueen',
  },
  {
    id: 'moonpool', name: 'The Moon Pool', element: 'moon',
    blurb: 'The reflection does not always do what you do.',
    sky: ['#252244', '#100e20'],
    natives: ['mirrorling', 'palemoth', 'moonTouchedCapy'],
    boss: 'palePrince',
  },
  {
    id: 'crystalcave', name: 'Crystal Hollows', element: 'water',
    blurb: 'It hums a note that makes your teeth feel expensive.',
    sky: ['#1e4450', '#0d2028'],
    natives: ['shardling', 'geodeturtle', 'quartzCapy'],
    boss: 'geodeTitan',
  },
  {
    id: 'skyterrace', name: 'The Sky Terrace', element: 'sun',
    blurb: 'A bath above the clouds. The clouds resent this.',
    sky: ['#3d4a5c', '#1c2330'],
    natives: ['gustling', 'thermalspirit', 'cloudCapy'],
    boss: 'stormHerald',
  },
  {
    id: 'dreamlagoon', name: 'Dream Lagoon', element: 'moon',
    blurb: 'You have been here before, in a way you cannot check.',
    sky: ['#3a2a5c', '#1a1230'],
    natives: ['lucidmoth', 'sleeperCapy', 'drifter'],
    boss: 'lucidWarden',
  },
  {
    id: 'sunforge', name: 'The Sunforge', element: 'sun',
    blurb: 'Where the light gets made. It is loud.',
    sky: ['#5c4420', '#2a1e0c'],
    natives: ['cinderspirit', 'forgeturtle', 'emberCapy'],
    boss: 'forgeSovereign',
  },
  {
    id: 'saltmarsh', name: 'The Salt Marsh', element: 'water',
    blurb: 'Brackish, patient, and older than the river that feeds it.',
    sky: ['#2a4442', '#132422'],
    natives: ['brinesnake', 'saltturtle', 'brackishCapy'],
    boss: 'saltMother',
  },
  {
    id: 'ashwood', name: 'The Ashwood', element: 'ember',
    blurb: 'It burned a long time ago. Something kept the heat.',
    sky: ['#3a2c2c', '#1a1212'],
    natives: ['cindermoth', 'ashwalker', 'charredCapy'],
    boss: 'emberJudge',
  },
  {
    id: 'glasslake', name: 'The Glass Lake', element: 'moon',
    blurb: 'Perfectly still. Nothing has disturbed it in years, including fish.',
    sky: ['#243044', '#101620'],
    natives: ['glassmoth', 'stillspirit', 'glassCapy'],
    boss: 'theStillLake',
  },
  {
    id: 'thermalvents', name: 'The Thermal Vents', element: 'ember',
    blurb: 'The whole seabed exhales, once a minute, forever.',
    sky: ['#4a2a3a', '#221420'],
    natives: ['ventsnake', 'boilspirit', 'ventCapy'],
    boss: 'theBreather',
  },
  {
    id: 'starfall', name: 'The Starfall Shallows', element: 'sun',
    blurb: 'Something came down here. The water still remembers the heat.',
    sky: ['#2c3050', '#141828'],
    natives: ['fallenspirit', 'cometmoth', 'starlitCapy'],
    boss: 'theFallen',
  },
  {
    id: 'undertow', name: 'The Undertow', element: 'water',
    blurb: 'Down is the only direction that works here.',
    sky: ['#16283a', '#08121c'],
    natives: ['abyssnake', 'depthturtle', 'drownedCapy'],
    boss: 'theUndertow',
  },
  {
    id: 'stillpoint', name: 'The Still Point', element: 'moon',
    blurb: 'Infinitely dense. Infinitely calm. Not remotely safe.',
    sky: ['#2a1e3a', '#120c1a'],
    natives: ['voidspirit', 'nullmoth', 'primeCapy'],
    boss: 'theChonk',
  },
];

export const TERRAINS_BY_ID = Object.fromEntries(TERRAINS.map((t) => [t.id, t]));

/** Epithets applied once the terrain table starts cycling. */
export const TIER_EPITHETS = [
  '', 'Hardened', 'Elder', 'Ascended', 'Radiant', 'Abyssal', 'Eternal', 'Absolute',
];

const ROMAN = ['', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

/** Roman numeral for a cycle tier, falling back to a plain number past X. */
export function tierNumeral(tier) {
  if (tier <= 0) return '';
  return ROMAN[tier] || String(tier + 1);
}

export function tierEpithet(tier) {
  if (tier <= 0) return '';
  return TIER_EPITHETS[Math.min(tier, TIER_EPITHETS.length - 1)];
}

/**
 * Which terrain a stage belongs to, and how many times the table has wrapped.
 * Never returns undefined — the table cycles rather than ending.
 */
export function terrainForStage(stage) {
  const s = Math.max(0, Math.floor(stage));
  const index = s % TERRAINS.length;
  const tier = Math.floor(s / TERRAINS.length);
  const terrain = TERRAINS[index];
  const numeral = tierNumeral(tier);
  return {
    ...terrain,
    tier,
    index,
    displayName: numeral ? `${terrain.name} ${numeral}` : terrain.name,
  };
}

/**
 * The enemy pool for a stage: this terrain's natives at heavy weight, plus
 * every earlier terrain's natives at light weight. Later terrains therefore
 * *add* to the roster instead of replacing it.
 */
export function enemyPoolForStage(stage) {
  const { index, tier } = terrainForStage(stage);
  const pool = [];

  for (let i = 0; i <= index; i++) {
    const weight = i === index ? 6 : 1;
    for (const id of TERRAINS[i].natives) pool.push({ id, weight, tier });
  }

  // Once the table has wrapped, everything that exists is in play.
  if (tier > 0) {
    for (let i = index + 1; i < TERRAINS.length; i++) {
      for (const id of TERRAINS[i].natives) pool.push({ id, weight: 1, tier });
    }
  }

  return pool;
}

/** Every enemy id referenced by the terrain table, natives and bosses alike. */
export function allTerrainEnemyIds() {
  const ids = new Set();
  for (const t of TERRAINS) {
    for (const id of t.natives) ids.add(id);
    ids.add(t.boss);
  }
  return [...ids];
}
