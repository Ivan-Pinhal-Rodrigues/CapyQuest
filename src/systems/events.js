// Which event is running, and what a Petal is worth while it is.
//
// Like the season, the schedule is computed rather than stored: three windows
// on fixed days of every season, and which live event fills each window rotates
// with the season index. Every device works it out identically and there is
// nothing to sync.
//
// The delicate part is expiry. Petals belong to *one* event, and when that event
// closes they are gone. That has to happen on the clock rather than on a visit,
// or a player who closed the tab mid-event comes back a month later to a wallet
// full of a currency nothing accepts.

import { seasonAt } from '../data/seasons.js';
import { WINDOWS, PETALS_PER_CLEAR, PETALS_PER_BOSS } from '../data/events.js';
import {
  eventById, liveEventDefs, rotatingEvents, scheduledEvents,
} from '../content/registry.js';
import { grant } from './cosmetics.js';

/** The window a day falls in, or null between events. */
export function windowForDay(day) {
  const index = WINDOWS.findIndex((w) => day >= w.startDay && day <= w.endDay);
  return index < 0 ? null : { ...WINDOWS[index], index };
}

/**
 * The event running at a moment, or null. `key` identifies this *occurrence* —
 * the same event in a later season is a different occurrence with its own
 * petals, which is what makes expiry work across seasons as well as within one.
 */
export function activeEvent(now = Date.now()) {
  // A pack can schedule an event on the wall clock instead — "runs from this
  // Friday until the following Sunday" — and that beats the rotation, because
  // somebody set those dates deliberately. Earliest end first, so two
  // overlapping hand-scheduled events resolve to the one closing soonest
  // rather than to whichever happened to be listed first.
  const dated = scheduledEvents()
    .filter((e) => now >= e.startsAt && now < e.endsAt)
    .sort((a, b) => a.endsAt - b.endsAt)[0];

  if (dated) {
    const days = Math.max(1, Math.ceil((dated.endsAt - dated.startsAt) / 86400e3));
    return {
      ...dated,
      // The occurrence key carries the start, so the same event scheduled again
      // later is a different occurrence with its own petals.
      key: `at:${dated.startsAt}:${dated.id}`,
      season: null,
      window: null,
      msLeft: Math.max(0, dated.endsAt - now),
      day: Math.floor((now - dated.startsAt) / 86400e3) + 1,
      days,
    };
  }

  const rotating = rotatingEvents();
  const season = seasonAt(now);
  const win = windowForDay(season.day);
  if (!win || !rotating.length) return null;

  // Rotate which live event fills which window, so a season is not the same
  // three in the same order forever.
  const def = rotating[(season.index + win.index) % rotating.length];

  const startsAt = season.startsAt + (win.startDay - 1) * 86400e3;
  const endsAt = season.startsAt + win.endDay * 86400e3;

  return {
    ...def,
    key: `${season.index}:${win.index}:${def.id}`,
    season: season.index,
    window: win.index,
    startsAt,
    endsAt,
    msLeft: Math.max(0, endsAt - now),
    day: season.day - win.startDay + 1,
    days: win.endDay - win.startDay + 1,
  };
}

/** The next event, for the "nothing on right now" state. */
export function nextEvent(now = Date.now()) {
  const soonest = scheduledEvents()
    .filter((e) => e.startsAt > now)
    .sort((a, b) => a.startsAt - b.startsAt)[0];

  const rotating = rotatingEvents();
  const season = seasonAt(now);
  let fromRotation = null;

  for (const win of WINDOWS) {
    if (season.day > win.endDay) continue;
    const startsAt = season.startsAt + (win.startDay - 1) * 86400e3;
    if (startsAt <= now) continue;
    if (!rotating.length) break;
    const def = rotating[(season.index + WINDOWS.indexOf(win)) % rotating.length];
    fromRotation = { ...def, startsAt, inMs: startsAt - now };
    break;
  }
  if (!fromRotation && rotating.length) {
    // Nothing left this season; the next one opens on day 1 of the next.
    const startsAt = season.endsAt;
    const def = rotating[(season.index + 1) % rotating.length];
    fromRotation = { ...def, startsAt, inMs: startsAt - now };
  }

  if (!soonest) return fromRotation;
  const dated = { ...soonest, inMs: soonest.startsAt - now };
  if (!fromRotation) return dated;
  return dated.startsAt <= fromRotation.startsAt ? dated : fromRotation;
}

/**
 * Bring the save into line with the clock. Returns what expired, if anything,
 * so the caller can say so — petals vanishing silently would read as a bug.
 * Idempotent, so it is safe wherever the game already ticks.
 */
export function syncEvent(state, now = Date.now()) {
  const live = activeEvent(now);
  const held = state.events;

  if (live && held.key === live.key) return null;

  const expired = held.key && held.petals > 0
    // An occurrence key ends with the event id in both schedule shapes, and no
    // id contains a colon — so the last segment is the id whichever way the
    // event was scheduled.
    ? { key: held.key, petals: held.petals, name: eventById(held.key.split(':').pop())?.name || 'That event' }
    : null;

  state.events = { key: live ? live.key : null, petals: 0, claimed: {} };
  return expired;
}

/** Petals for clearing a level, zero when nothing is running. */
export function petalsForClear(isBoss, now = Date.now()) {
  const live = activeEvent(now);
  if (!live) return 0;
  const base = isBoss ? PETALS_PER_BOSS : PETALS_PER_CLEAR;
  return Math.round(base * (live.clearBonus || 1));
}

/** Pay petals into the save, but only into the event they were earned in. */
export function addPetals(state, amount, now = Date.now()) {
  const live = activeEvent(now);
  if (!live || !(amount > 0)) return 0;
  syncEvent(state, now);
  state.events.petals += amount;
  // Petals themselves expire with their event, so the lifetime count is kept
  // separately — otherwise nothing could ever ask "how many have you earned".
  if (state.stats) state.stats.petals = (state.stats.petals || 0) + amount;
  return amount;
}

// ----------------------------------------------------------------- exchange

export function exchangeRows(state, now = Date.now()) {
  const live = activeEvent(now);
  if (!live) return [];
  return live.exchange.map((row) => ({
    ...row,
    bought: state.events.claimed?.[row.id] || 0,
    soldOut: !!row.once && !!state.events.claimed?.[row.id],
    affordable: (state.events.petals || 0) >= row.petals,
  }));
}

export function canExchange(state, id, now = Date.now()) {
  const live = activeEvent(now);
  if (!live) return { ok: false, reason: 'closed' };

  const row = live.exchange.find((r) => r.id === id);
  if (!row) return { ok: false, reason: 'unknown' };
  if (row.once && state.events.claimed?.[id]) return { ok: false, reason: 'soldOut' };
  if ((state.events.petals || 0) < row.petals) return { ok: false, reason: 'petals', price: row.petals };
  return { ok: true, row, live };
}

/**
 * Spend petals. A cosmetic is granted here rather than through rewards.js for
 * the same reason the pass does it: owning a look is not a currency.
 */
export function exchange(state, id, now = Date.now()) {
  const check = canExchange(state, id, now);
  if (!check.ok) return check;

  state.events.petals -= check.row.petals;
  state.events.claimed[id] = (state.events.claimed[id] || 0) + 1;

  if (check.row.reward.cosmetic) {
    const [kind, cosmeticId] = check.row.reward.cosmetic.split(':');
    grant(state, kind, cosmeticId);
  }

  return { ok: true, row: check.row, spent: check.row.petals, reward: check.row.reward };
}

/** Every event the catalogue knows about, live or not — for the roadmap list. */
export function allEvents() {
  return liveEventDefs();
}

export { eventById };
