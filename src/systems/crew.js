// The crew: what the party wears and what it carries.
//
// Two separate things live here because they are two halves of the same panel,
// and neither is big enough to deserve its own module:
//
//   HATS are cosmetic, and come from the player's own wardrobe. Owning the
//   Straw Boater lets you put it on the capybara and on all three companions.
//   They move no number — the same promise the player's looks make, asserted by
//   the same test.
//
//   GEAR carries stats. It is never sold, only dropped, and it has its own bag
//   rather than sharing state.combat.inventory: the slots are different, and
//   mixing them would mean every "is this better than what I have" comparison
//   in the Kit panel had to filter first.
//
// The bag is shared across the roster and only the party of three contributes,
// so the decision is "who gets the good charm" rather than "outfit twenty-four
// capybaras".

import {
  COMPANION_GEAR, COMPANION_GEAR_BY_ID, COMPANION_SLOT_IDS, companionStatsFor,
} from '../data/companionGear.js';
import * as R from '../data/rarities.js';
import { rollStars, tierCeiling } from './loot.js';
import { owns } from './cosmetics.js';

/**
 * The bag is capped, like the player's. A companion piece is never fused or
 * refined, so pieces accumulate faster than they are consumed — without a cap
 * a long run would grow the save without bound.
 */
export const CREW_BAG_CAP = 90;

/** Chance a boss also drops a crew piece. Bosses only; ordinary clears never do. */
export const CREW_DROP_CHANCE = 0.35;

// ------------------------------------------------------------------ the bag

let uidCounter = 0;

function bag(state) {
  if (!Array.isArray(state.companionGear)) state.companionGear = [];
  return state.companionGear;
}

/** Resolve a bag entry to its definition plus its instance numbers. */
export function resolveCrewItem(entry) {
  if (!entry) return null;
  const def = COMPANION_GEAR_BY_ID[entry.id];
  if (!def) return null;

  const tier = entry.tier === undefined ? def.tier : R.clampTier(entry.tier);
  const stars = R.clampStars(entry.stars ?? 1);
  const stats = companionStatsFor(def, { tier, stars });

  return { ...def, uid: entry.uid, tier, stars, rarity: R.rarityFor(tier), stats, score: crewScore(stats) };
}

/** A rough power score, so "is this better?" has an answer the panel can show. */
export function crewScore(stats) {
  let sum = 0;
  for (const [key, weight] of Object.entries(WEIGHTS)) sum += (stats?.[key] || 0) * weight;
  return sum;
}

const WEIGHTS = { atk: 3, def: 2.5, hp: 0.5, spd: 2, luck: 1.5, crit: 400, critDmg: 120 };

/** Everything in the bag, resolved, strongest first. */
export function crewInventory(state) {
  return bag(state).map(resolveCrewItem).filter(Boolean).sort((a, b) => b.score - a.score);
}

/** What is in a companion's slot, or null. */
export function crewEquipped(state, companionId, slot) {
  const uid = state.gacha?.companions?.[companionId]?.gear?.[slot];
  if (!uid) return null;
  return resolveCrewItem(bag(state).find((e) => e.uid === uid));
}

/** Every piece a companion is wearing. */
export function crewEquippedItems(state, companionId) {
  return COMPANION_SLOT_IDS.map((slot) => crewEquipped(state, companionId, slot)).filter(Boolean);
}

/** Pieces not currently on anybody, for the picker. */
export function crewUnequipped(state, slot) {
  const worn = new Set();
  for (const owned of Object.values(state.gacha?.companions || {})) {
    for (const uid of Object.values(owned?.gear || {})) if (uid) worn.add(uid);
  }
  return crewInventory(state).filter((item) => item.slot === slot && !worn.has(item.uid));
}

// -------------------------------------------------------------------- drops

/**
 * Roll a crew drop, or null. Bosses only.
 *
 * Uses the same depth gate and star curve as player loot, so a stage-3 boss
 * cannot hand the crew a Capybaric and a lucky run feels lucky in the same way.
 */
export function rollCrewLoot(stage, { luck = 0, rng = Math.random } = {}) {
  if (rng() > CREW_DROP_CHANCE) return null;

  const ceiling = tierCeiling(stage);
  // Flatter than player loot: the crew is a side channel and a wide spread here
  // would mean most drops are worse than what is already equipped.
  const floor = Math.max(0, ceiling - 3);
  const tier = floor + Math.floor(rng() * (ceiling - floor + 1));

  const pool = COMPANION_GEAR.filter((g) => g.tier <= tier);
  if (!pool.length) return null;

  const def = pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
  return { id: def.id, tier, stars: rollStars(rng, luck) };
}

/** Add a piece to the bag. Returns the entry, or null if the definition is unknown. */
export function addCrewItem(state, itemId, { tier, stars = 1, now = Date.now() } = {}) {
  const def = COMPANION_GEAR_BY_ID[itemId];
  if (!def) return null;

  const inv = bag(state);
  if (inv.length >= CREW_BAG_CAP) {
    // Full bag: drop the weakest unworn piece rather than refusing the drop, so
    // a long session never silently stops rewarding you.
    const victim = weakestUnworn(state);
    if (!victim) return null;
    inv.splice(inv.indexOf(victim), 1);
  }

  const entry = {
    uid: `c${now.toString(36)}${(uidCounter++).toString(36)}`,
    id: itemId,
    tier: R.clampTier(tier === undefined ? def.tier : tier),
    stars: R.clampStars(stars),
  };
  inv.push(entry);
  return entry;
}

function weakestUnworn(state) {
  const worn = new Set();
  for (const owned of Object.values(state.gacha?.companions || {})) {
    for (const uid of Object.values(owned?.gear || {})) if (uid) worn.add(uid);
  }

  let worst = null;
  let worstScore = Infinity;
  for (const entry of bag(state)) {
    if (worn.has(entry.uid)) continue;
    const item = resolveCrewItem(entry);
    if (item && item.score < worstScore) {
      worstScore = item.score;
      worst = entry;
    }
  }
  return worst;
}

/** Throw a piece away for nothing. Refuses anything currently worn. */
export function scrapCrewItem(state, uid) {
  const worn = new Set();
  for (const owned of Object.values(state.gacha?.companions || {})) {
    for (const held of Object.values(owned?.gear || {})) if (held) worn.add(held);
  }
  if (worn.has(uid)) return { ok: false, reason: 'worn' };

  const inv = bag(state);
  const at = inv.findIndex((e) => e.uid === uid);
  if (at < 0) return { ok: false, reason: 'unknown' };
  inv.splice(at, 1);
  return { ok: true };
}

// ----------------------------------------------------------------- wearing

function record(state, companionId) {
  const owned = state.gacha?.companions?.[companionId];
  if (!owned) return null;
  if (!owned.gear) owned.gear = {};
  return owned;
}

/**
 * Put a piece on a companion.
 *
 * A piece already on somebody else moves rather than duplicating — the bag is
 * shared, and silently having the same charm on two capybaras would double its
 * stats for free.
 */
export function equipCrewItem(state, companionId, uid) {
  const owned = record(state, companionId);
  if (!owned) return { ok: false, reason: 'notOwned' };

  const entry = bag(state).find((e) => e.uid === uid);
  const item = resolveCrewItem(entry);
  if (!item) return { ok: false, reason: 'unknown' };

  for (const [otherId, other] of Object.entries(state.gacha.companions)) {
    if (!other?.gear) continue;
    for (const [slot, held] of Object.entries(other.gear)) {
      if (held === uid) delete state.gacha.companions[otherId].gear[slot];
    }
  }

  owned.gear[item.slot] = uid;
  return { ok: true, item };
}

export function unequipCrewItem(state, companionId, slot) {
  const owned = record(state, companionId);
  if (!owned || !owned.gear[slot]) return { ok: false, reason: 'empty' };
  delete owned.gear[slot];
  return { ok: true };
}

/** Put a hat on a companion. Cosmetic, and from the player's own wardrobe. */
export function setCrewHat(state, companionId, hatId) {
  const owned = state.gacha?.companions?.[companionId];
  if (!owned) return { ok: false, reason: 'notOwned' };
  if (hatId !== 'none' && !owns(state, 'hat', hatId)) return { ok: false, reason: 'locked' };
  owned.hat = hatId;
  return { ok: true };
}

export function crewHat(state, companionId) {
  const held = state.gacha?.companions?.[companionId]?.hat;
  // A hat removed from the catalogue, or one on a save from before the wardrobe
  // existed, resolves to bare rather than to nothing at all.
  return held && (held === 'none' || owns(state, 'hat', held)) ? held : 'none';
}

// -------------------------------------------------------------------- stats

/**
 * What one companion's gear adds, on top of its own level-scaled stats.
 *
 * Returned as a plain stat block so combatStats.js can fold it in with the same
 * addStats() it already uses for everything else.
 */
export function crewGearStats(state, companionId) {
  const out = { atk: 0, def: 0, hp: 0, spd: 0, crit: 0, critDmg: 0, luck: 0 };
  for (const item of crewEquippedItems(state, companionId)) {
    for (const key of Object.keys(out)) {
      if (item.stats[key]) out[key] += item.stats[key];
    }
  }
  return out;
}

/** Owned / total, for the panel header. */
export function crewCollection(state) {
  const found = new Set(bag(state).map((e) => e.id));
  return { owned: found.size, total: COMPANION_GEAR.length, held: bag(state).length, cap: CREW_BAG_CAP };
}
