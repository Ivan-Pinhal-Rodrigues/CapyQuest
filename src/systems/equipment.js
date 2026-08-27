// Resolving what the capybara is wearing.
//
// Its own module so that combatStats.js and meta.js can both read equipment
// without importing each other — meta.js needs gear bonuses, and combatStats.js
// needs meta's modifiers, which would otherwise be a cycle.
//
// This is also the single place an inventory entry turns into real numbers.
// Everything downstream reads `item.stats` and never has to know that rarity,
// stars and forge level all feed into it.

import { GEAR_BY_ID, SLOT_IDS, statsFor, gearScore } from '../data/gear.js';
import { rarityFor, clampTier, clampStars } from '../data/rarities.js';
import { SKILLS_BY_ID } from '../data/skills.js';
import { GEAR_SETS_BY_ID, bonusesAt, setOf } from '../data/gearSets.js';

/** Resolve an inventory entry to its definition plus its instance numbers. */
export function resolveItem(entry) {
  if (!entry) return null;
  const def = GEAR_BY_ID[entry.id];
  if (!def) return null;

  // A save written before the ladder existed has no tier — the piece sits on
  // the rung its definition normally drops at, which is where it always was.
  const tier = entry.tier === undefined ? def.tier : clampTier(entry.tier);
  const stars = clampStars(entry.stars ?? 1);
  const forge = entry.forge || 0;
  const stats = statsFor(def, { tier, stars, forge });

  return {
    ...def,
    uid: entry.uid,
    tier,
    stars,
    forge,
    refineFails: entry.refineFails || 0,
    rarity: rarityFor(tier),
    stats,
    score: gearScore(stats),
  };
}

/** The item currently in a slot, or null. */
export function equippedItem(state, slot) {
  const uid = state.combat.equipped?.[slot];
  if (!uid) return null;
  return resolveItem(state.combat.inventory.find((i) => i.uid === uid));
}

/** Every equipped piece, in slot order. */
export function equippedItems(state) {
  return SLOT_IDS.map((slot) => equippedItem(state, slot)).filter(Boolean);
}

/**
 * Idle-game effects granted by equipped gear and slotted passive skills.
 * These are flat: rarity, stars and enhancement scale a piece's stats, never
 * its bonus. A Straw Hat pushed to Capybaric is enormously strong and still
 * grants no idle bonus, because it never had one.
 */
export function equippedBonuses(state) {
  const out = [];
  for (const item of equippedItems(state)) {
    if (item.bonus) out.push(item.bonus);
  }
  for (const id of state.combat.skills || []) {
    const skill = SKILLS_BY_ID[id];
    if (skill?.bonus) out.push(skill.bonus);
  }
  for (const { set, count } of equippedSets(state)) {
    out.push(...bonusesAt(set, count));
  }
  return out;
}

/**
 * Which sets you are wearing, and how many pieces of each.
 *
 * Counted from what is EQUIPPED, not owned — a set sitting in the bag is a
 * collection, not a build. Sorted most-worn first so the Kit panel can lead
 * with the set you have actually committed to.
 *
 * Every set you have any piece of is reported, including one-piece sets that
 * grant nothing yet: "1 / 2" on a card is what tells somebody the mechanic
 * exists and that they are one slot away from it.
 */
export function equippedSets(state) {
  const counts = new Map();
  for (const item of equippedItems(state)) {
    const set = setOf(item.id);
    if (!set) continue;
    counts.set(set.id, (counts.get(set.id) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([id, count]) => ({ set: GEAR_SETS_BY_ID[id], count }))
    .sort((a, b) => b.count - a.count);
}
