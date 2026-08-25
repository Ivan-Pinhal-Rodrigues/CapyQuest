// Seasons: 45 days each, running forever, computed rather than stored.
//
// A season is a function of the clock, not a record in the save. That is the
// whole design: there is no server to tell the game a season rolled over, so
// every device works it out from the same epoch and arrives at the same answer.
// The save only remembers *which* season it last saw, so it knows when to
// archive the old one and start the new.
//
// Names cycle with a numeral past the end of the table, the same trick the
// terrain list uses, so season 400 reads as "Reedfall VI" rather than falling
// off the end.

/** Length of a season, in days. */
export const SEASON_DAYS = 45;
export const SEASON_MS = SEASON_DAYS * 86400e3;

/**
 * Where season 0 began. Fixed and in the past, so the maths is the same on
 * every device and in every test — moving this would renumber every season
 * anyone has ever played.
 */
export const SEASON_EPOCH = Date.UTC(2026, 0, 5);

const SEASON_NAMES = [
  'The Warm Stone',
  'Reedfall',
  'The Long Thaw',
  'Emberwake',
  'Still Water',
  'The Moon Market',
  'Deepcurrent',
  'The Quiet Bloom',
];

const NUMERALS = ['', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII', ' IX', ' X'];

export function seasonIndex(now = Date.now()) {
  return Math.max(0, Math.floor((now - SEASON_EPOCH) / SEASON_MS));
}

export function seasonName(index) {
  const i = Math.max(0, Math.floor(index));
  const base = SEASON_NAMES[i % SEASON_NAMES.length];
  const cycle = Math.floor(i / SEASON_NAMES.length);
  return base + (NUMERALS[cycle] ?? ` ${cycle + 1}`);
}

/** Everything about the season a moment falls in. */
export function seasonAt(now = Date.now()) {
  const index = seasonIndex(now);
  const startsAt = SEASON_EPOCH + index * SEASON_MS;
  const endsAt = startsAt + SEASON_MS;
  const elapsed = Math.max(0, now - startsAt);

  return {
    index,
    name: seasonName(index),
    number: index + 1,
    startsAt,
    endsAt,
    msLeft: Math.max(0, endsAt - now),
    // 1-based, so the first day of a season is day 1 rather than day 0.
    day: Math.min(SEASON_DAYS, Math.floor(elapsed / 86400e3) + 1),
    days: SEASON_DAYS,
    ratio: Math.min(1, elapsed / SEASON_MS),
  };
}
