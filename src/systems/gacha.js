// Summoning. The pity counter is shown to the player, and the rates below are
// the real ones — a gacha that hides its numbers is just a slot machine.
//
// Rates: 5★ 0.6% base, ramping hard from 65 pulls, guaranteed at 80.
//        4★ 5.1%, with a guarantee at least every 10 pulls.
//        3★ the remainder.

import * as B from '../balance.js';
import { COMPANIONS_BY_ID, STAR_POOLS, SHARDS_PER_LEVEL, MAX_COMPANION_LEVEL } from '../data/companions.js';

export const FOUR_STAR_RATE = 0.051;
export const FOUR_STAR_PITY = 10;
export const TICKET_COST_ZEN = 2.5e9; // buying a ticket outright, for whales of zen
export const TEN_PULL = 10;

/**
 * Resolve one pull against the pity counters. Pure — pass `rng` to pin it.
 * Returns { star, id, pity } and MUTATES nothing; the caller applies the result.
 */
export function pullOnce(pity, rng = Math.random) {
  const fiveChance = B.fiveStarChance(pity.five);
  const forcedFour = pity.four >= FOUR_STAR_PITY - 1;

  let star;
  if (rng() < fiveChance) star = 5;
  else if (forcedFour || rng() < FOUR_STAR_RATE) star = 4;
  else star = 3;

  const pool = STAR_POOLS[star];
  const id = pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))].id;

  return {
    star,
    id,
    // Counters reset on the star they belong to, and 5★ also clears the 4★
    // timer — otherwise a 5★ would leave a 4★ "owed" immediately after.
    nextPity: {
      five: star === 5 ? 0 : pity.five + 1,
      four: star >= 4 ? 0 : pity.four + 1,
    },
  };
}

/** Apply a pull to the save: new companion, or shards toward a level. */
export function applyPull(state, result) {
  const g = state.gacha;
  g.pity = result.nextPity;
  g.pulls++;
  if (result.star === 5) g.fiveStars++;

  const owned = g.companions[result.id];
  if (!owned) {
    g.companions[result.id] = { level: 1, shards: 0 };
    return { ...result, isNew: true };
  }

  // Duplicates become shards, which promote the companion a level at a time.
  const per = SHARDS_PER_LEVEL[result.star];
  owned.shards += 1;
  let levelled = false;
  while (owned.shards >= per && owned.level < MAX_COMPANION_LEVEL) {
    owned.shards -= per;
    owned.level++;
    levelled = true;
  }
  return { ...result, isNew: false, levelled, level: owned.level };
}

/** Pull `count` times, spending tickets. Returns the results in order. */
export function summon(state, count, rng = Math.random) {
  const available = Math.min(count, state.gacha.tickets);
  if (available <= 0) return [];

  const results = [];
  for (let i = 0; i < available; i++) {
    state.gacha.tickets--;
    results.push(applyPull(state, pullOnce(state.gacha.pity, rng)));
  }
  return results;
}

/** Buy a ticket with zen. Prices rise so it never trivialises the roster. */
export function ticketPrice(state) {
  return TICKET_COST_ZEN * Math.pow(1.18, state.gacha.bought || 0);
}

export function buyTicket(state) {
  const price = ticketPrice(state);
  if (state.zen < price) return { ok: false, price };
  state.zen -= price;
  state.gacha.tickets++;
  state.gacha.bought = (state.gacha.bought || 0) + 1;
  return { ok: true, price };
}

/** How close the 5★ counter is to guaranteed, for the meter in the UI. */
export function pityProgress(pity) {
  return {
    five: Math.min(1, pity.five / B.PITY_HARD),
    four: Math.min(1, pity.four / FOUR_STAR_PITY),
    fiveRemaining: Math.max(0, B.PITY_HARD - pity.five),
    fourRemaining: Math.max(0, FOUR_STAR_PITY - pity.four),
    soft: pity.five >= B.PITY_SOFT,
    chance: B.fiveStarChance(pity.five),
  };
}

/** Companions currently in the party, resolved with their level multiplier. */
export function partyMembers(state) {
  return (state.gacha.party || [])
    .filter(Boolean)
    .map((id) => {
      const def = COMPANIONS_BY_ID[id];
      const owned = state.gacha.companions[id];
      if (!def || !owned) return null;
      return { ...def, level: owned.level, shards: owned.shards };
    })
    .filter(Boolean);
}

/** Every companion you own, resolved and sorted strongest-first. */
export function ownedCompanions(state) {
  return Object.entries(state.gacha.companions)
    .map(([id, owned]) => {
      const def = COMPANIONS_BY_ID[id];
      return def ? { ...def, level: owned.level, shards: owned.shards } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.star - a.star || b.level - a.level || a.name.localeCompare(b.name));
}

export function collectionProgress(state) {
  const total = Object.keys(COMPANIONS_BY_ID).length;
  const owned = Object.keys(state.gacha.companions).length;
  return { owned, total, ratio: total ? owned / total : 0 };
}
