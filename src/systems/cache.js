// The offline cache.
//
// The old Nap Report had one honest flaw: it told you the cap had cost you
// something only *after* it had. "3h went uncounted" is a bill, not a warning,
// and a number you only ever meet as a bill is a number you never plan around.
//
// So the pond now has a visible tank. It fills while you are away, it has a
// stated capacity, and it spills when it is full whether or not anyone is
// watching. The meter is on screen while it is empty too, which is the whole
// point — the cap is legible before it matters, so raising it is a decision
// rather than a regret.
//
// Two rules the rest of the game leans on:
//
//   1. The cache stores *zen*, banked at the rate that was in force when it
//      accrued. Leaving it in the tank across a rebirth or a fresh multiplier
//      therefore cannot pay more than collecting it would have. Sitting on it
//      is a choice about when, never a way to earn more.
//   2. Time is only ever credited once. `fillCache` takes an elapsed span and
//      returns what it actually took; the caller advances its own clock by the
//      whole span regardless, so an overflowing tank loses the excess instead
//      of quietly banking it for later.

/** Under a minute away is not a nap, and not worth a report. */
export const MIN_CACHE_MS = 60e3;

/**
 * Add an away-span to the tank.
 *
 * `capMs` and `rate` come from derived stats, so generators, the tree, boosts
 * and achievements all feed the same two numbers. Returns what happened rather
 * than mutating and staying quiet, because both the report and the toast want
 * to say it out loud.
 */
export function fillCache(state, { zps, elapsedMs, capMs, rate }) {
  const cache = state.cache;
  const span = Math.max(0, num(elapsedMs));
  const cap = Math.max(0, num(capMs));

  // Room is measured in time, not zen: the tank holds a duration of income, so
  // a player who got richer while away does not thereby get a smaller cache.
  const room = Math.max(0, cap - cache.ms);
  const creditedMs = Math.min(span, room);
  const lostMs = span - creditedMs;

  const zen = zps > 0 ? (zps * Math.max(0, num(rate)) * creditedMs) / 1000 : 0;

  cache.zen += zen;
  cache.ms += creditedMs;
  cache.lostMs += lostMs;
  if (creditedMs > 0 && !cache.since) cache.since = Date.now();

  return { zen, creditedMs, lostMs };
}

/** Everything the meter and the report need, in one read. */
export function cacheInfo(state, derived) {
  const cache = state.cache;
  const capMs = Math.max(1, num(derived.offlineCapMs));
  const ms = Math.min(cache.ms, capMs);
  return {
    zen: cache.zen,
    ms,
    capMs,
    lostMs: cache.lostMs,
    ratio: Math.min(1, ms / capMs),
    full: ms >= capMs,
    rate: derived.offlineRate,
    // What an hour away would be worth right now, which is the number that
    // actually tells you whether raising the rate is worth buying.
    perHour: derived.zps * derived.offlineRate * 3600,
  };
}

/** Empty the tank into the caller's hands. Returns what was in it. */
export function collectCache(state) {
  const { zen, ms, lostMs } = state.cache;
  state.cache.zen = 0;
  state.cache.ms = 0;
  state.cache.lostMs = 0;
  state.cache.since = 0;
  return { zen, ms, lostMs };
}

/** Worth interrupting someone for. */
export function cacheWorthShowing(state, elapsedMs) {
  return elapsedMs >= MIN_CACHE_MS && state.cache.zen > 0;
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
