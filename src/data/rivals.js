// The rivals on the leaderboard.
//
// There is no backend, so there are no other players. Rather than pretend
// otherwise, the board is openly a field of simulated capybaras — the panel says
// so — and the interesting problem becomes making them *behave* like a season's
// worth of other people rather than like a static list.
//
// Every rival is derived from a seed built out of the season index, so the board
// is stable for the whole 45 days and completely different the next season.
// Nothing about them is stored in the save; regenerating from the season and the
// clock is what keeps them consistent across a reload.

/** Given and family names, combined into a much larger set than either. */
const FIRST = [
  'Momo', 'Kettle', 'Pip', 'Yuzu', 'Tama', 'Bo', 'Fen', 'Wick', 'Sable', 'Ash',
  'Juniper', 'Clove', 'Mika', 'Rook', 'Nori', 'Pebble', 'Ozu', 'Wren', 'Haru', 'Bramble',
  'Cinder', 'Sora', 'Moss', 'Kai', 'Plum', 'Tilde', 'Onyx', 'Fig', 'Reed', 'Marsh',
];

const LAST = [
  'of the Shallows', 'Longsoak', 'Riverwide', 'Nightbather', 'Deepkeel', 'Stillwater',
  'Warmstone', 'the Unbothered', 'Mudfoot', 'Steamborn', 'of the Second Pond', 'Quietpaw',
  'the Patient', 'Reedcutter', 'Slowtide', 'of No Fixed Pond', 'Bigwater', 'the Damp',
];

/** How a rival plays, which decides how their season curve runs. */
export const ARCHETYPES = [
  { id: 'grinder', name: 'Grinder', pace: 1.15, variance: 0.06, blurb: 'On every day, never in a hurry.' },
  { id: 'sprinter', name: 'Sprinter', pace: 1.55, variance: 0.22, blurb: 'Enormous first week, then quiet.' },
  { id: 'weekender', name: 'Weekender', pace: 0.95, variance: 0.18, blurb: 'Two big days, five small ones.' },
  { id: 'idler', name: 'Idler', pace: 0.7, variance: 0.05, blurb: 'Logs in, collects, leaves.' },
  { id: 'whale', name: 'Collector', pace: 1.35, variance: 0.12, blurb: 'Owns rather a lot of cases.' },
];

export const ARCHETYPES_BY_ID = Object.fromEntries(ARCHETYPES.map((a) => [a.id, a]));

/** How many rivals fill the board. */
export const RIVAL_COUNT = 60;

export function rivalName(rng) {
  const first = FIRST[Math.floor(rng() * FIRST.length)];
  const last = LAST[Math.floor(rng() * LAST.length)];
  return `${first} ${last}`;
}
