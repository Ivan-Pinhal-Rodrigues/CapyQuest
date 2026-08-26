// The store, and the whole of what "simulated" means.
//
// ============================================================================
// NOTHING HERE TAKES REAL MONEY.
//
// The leaf packs carry price tags because that is the shape of the genre and
// the game is a study of it, but PAYMENTS is false, there is no processor, no
// card is ever asked for, and pressing the button simply adds leafs. Every
// purchase surface repeats that line where the player can see it, not in a
// footnote.
//
// The flag exists so a real processor could be dropped in without rewriting the
// economy around it. Turning it on would need a backend, a merchant account,
// refunds and consumer-law compliance, none of which exists here — so it stays
// off, and the code below refuses to pretend otherwise.
// ============================================================================

import { dayKey } from './quests.js';
import { boostById, leafPackById, liveBoosts, liveLeafPacks } from '../content/registry.js';
import { LEAF_PACKS, LEAF_PACKS_BY_ID } from '../data/leafPacks.js';

export const PAYMENTS = false;

/** Repeated verbatim on every purchase surface. Do not soften this. */
export const SIMULATED_NOTICE = 'Simulated — no real payment, ever.';

// The shelves themselves now come from the content registry, so an admin can
// change a price or pull an item without a code change. The tables these
// re-export are the *defaults* the registry starts from — kept exported because
// the balance tests reason about what the game ships with, not about whatever
// pack happens to be applied.
export { LEAF_PACKS, LEAF_PACKS_BY_ID };
export { liveBoosts, liveLeafPacks };

/**
 * The free daily grant. Deliberately just short of a Reed Case: close enough
 * that two days gets you one and a bit, far enough that a day alone does not.
 * That gap is the whole design of the daily, and it is stated plainly on the
 * button rather than discovered.
 */
export const DAILY_LEAFS = 80;

export function dailyLeafsReady(state, now = Date.now()) {
  return state.store?.leafDay !== dayKey(now);
}

export function claimDailyLeafs(state, now = Date.now()) {
  if (!dailyLeafsReady(state, now)) return { ok: false, reason: 'claimed' };
  state.store.leafDay = dayKey(now);
  state.leafs += DAILY_LEAFS;
  state.lifetimeLeafs += DAILY_LEAFS;
  return { ok: true, leafs: DAILY_LEAFS };
}

/**
 * "Buy" a leaf pack. With PAYMENTS off this credits the leafs and records that
 * it was simulated; it never contacts anything and never asks for a card.
 */
export function buyLeafPack(state, id) {
  const pack = leafPackById(id);
  if (!pack || pack.hidden) return { ok: false, reason: 'unknown' };
  if (PAYMENTS) return { ok: false, reason: 'unavailable' };

  state.leafs += pack.leafs;
  state.lifetimeLeafs += pack.leafs;
  state.store.packs[id] = (state.store.packs[id] || 0) + 1;
  return { ok: true, leafs: pack.leafs, pack, simulated: true };
}

// -------------------------------------------------------------------- boosts

export function activeBoost(state, id, now = Date.now()) {
  return (state.buffs || []).find((b) => b.id === id && b.until > now) || null;
}

export function boostRemaining(state, id, now = Date.now()) {
  const buff = activeBoost(state, id, now);
  return buff ? buff.until - now : 0;
}

/**
 * Buy a timed boost. Buying one already running extends it — a boost you have
 * to spend at exactly the right moment is a chore, not a treat.
 */
export function buyBoost(state, id, now = Date.now()) {
  const def = boostById(id);
  if (!def || def.hidden) return { ok: false, reason: 'unknown' };
  if ((state.leafs || 0) < def.cost) return { ok: false, reason: 'leafs', price: def.cost };

  state.leafs -= def.cost;
  const ms = def.hours * 3600e3;
  const existing = activeBoost(state, id, now);

  if (existing) {
    existing.until += ms;
  } else {
    state.buffs.push({
      id: def.id,
      name: def.name,
      icon: def.icon,
      until: now + ms,
      effects: def.effects,
    });
  }

  if (state.stats) state.stats.boosts = (state.stats.boosts || 0) + 1;

  return { ok: true, price: def.cost, until: activeBoost(state, id, now).until, extended: !!existing };
}
