// 12 zones × 10 stages each. Stage 10 of every zone is a boss with eight times
// the health, which is the wall that makes you go and improve your gear.

export const STAGES_PER_ZONE = 10;

export const ZONES = [
  {
    id: 'reedbank',
    name: 'The Reedbank',
    element: 'leaf',
    blurb: 'Shallow, sunlit, and full of things that nibble.',
    sky: ['#2f4a2c', '#1b2a1a'],
    enemies: ['nibbler', 'snapper', 'hopper'],
    boss: 'reedKing',
  },
  {
    id: 'mudflats',
    name: 'The Mudflats',
    element: 'leaf',
    blurb: 'Everything here is the same colour as everything else.',
    sky: ['#4a3a24', '#241c12'],
    enemies: ['snapper', 'wallower', 'nibbler'],
    boss: 'mireLord',
  },
  {
    id: 'hotsprings',
    name: 'Scalding Springs',
    element: 'ember',
    blurb: 'Wonderful for the joints. Terrible for everything else.',
    sky: ['#5c2f24', '#2a1410'],
    enemies: ['ember', 'steamwisp', 'wallower'],
    boss: 'boilerBeast',
  },
  {
    id: 'bamboo',
    name: 'The Bamboo Sea',
    element: 'leaf',
    blurb: 'You cannot see more than two metres in any direction.',
    sky: ['#2c4a2f', '#16281a'],
    enemies: ['hopper', 'shrieker', 'nibbler'],
    boss: 'groveWarden',
  },
  {
    id: 'riverdeep',
    name: 'Riverdeep',
    element: 'water',
    blurb: 'The current has opinions about where you are going.',
    sky: ['#1e3a4a', '#0e1c26'],
    enemies: ['gulper', 'snapper', 'drifter'],
    boss: 'riverElder',
  },
  {
    id: 'nightmarket',
    name: 'The Night Market',
    element: 'moon',
    blurb: 'Everything is for sale, including things that object to it.',
    sky: ['#2f2a4a', '#161428'],
    enemies: ['haggler', 'drifter', 'shrieker'],
    boss: 'marketQueen',
  },
  {
    id: 'moonpool',
    name: 'The Moon Pool',
    element: 'moon',
    blurb: 'The reflection does not always do what you do.',
    sky: ['#252244', '#100e20'],
    enemies: ['drifter', 'mirrorling', 'steamwisp'],
    boss: 'palePrince',
  },
  {
    id: 'crystalcave',
    name: 'Crystal Hollows',
    element: 'water',
    blurb: 'It hums a note that makes your teeth feel expensive.',
    sky: ['#1e4450', '#0d2028'],
    enemies: ['shardling', 'mirrorling', 'gulper'],
    boss: 'geodeTitan',
  },
  {
    id: 'skyterrace',
    name: 'The Sky Terrace',
    element: 'sun',
    blurb: 'A bath above the clouds. The clouds resent this.',
    sky: ['#3d4a5c', '#1c2330'],
    enemies: ['gustling', 'shrieker', 'shardling'],
    boss: 'stormHerald',
  },
  {
    id: 'dreamlagoon',
    name: 'Dream Lagoon',
    element: 'moon',
    blurb: 'You have been here before, in a way you cannot check.',
    sky: ['#3a2a5c', '#1a1230'],
    enemies: ['mirrorling', 'gustling', 'drifter'],
    boss: 'lucidWarden',
  },
  {
    id: 'sunforge',
    name: 'The Sunforge',
    element: 'sun',
    blurb: 'Where the light gets made. It is loud.',
    sky: ['#5c4420', '#2a1e0c'],
    enemies: ['ember', 'shardling', 'gustling'],
    boss: 'forgeSovereign',
  },
  {
    id: 'singularity',
    name: 'The Still Point',
    element: 'moon',
    blurb: 'Infinitely dense. Infinitely calm. Not remotely safe.',
    sky: ['#2a1e3a', '#120c1a'],
    enemies: ['mirrorling', 'ember', 'gulper'],
    boss: 'theChonk',
  },
];

export const ZONES_BY_ID = Object.fromEntries(ZONES.map((z) => [z.id, z]));

/** Absolute stage number -> which zone it belongs to. */
export function zoneForStage(stage) {
  const index = Math.min(ZONES.length - 1, Math.floor(Math.max(0, stage) / STAGES_PER_ZONE));
  return ZONES[index];
}

/** 1-based position within the current zone. */
export function stageInZone(stage) {
  return (Math.max(0, stage) % STAGES_PER_ZONE) + 1;
}

export function isBossStage(stage) {
  return stageInZone(stage) === STAGES_PER_ZONE;
}

/** The last stage the player can reach with the zones that exist. */
export const MAX_STAGE = ZONES.length * STAGES_PER_ZONE - 1;
