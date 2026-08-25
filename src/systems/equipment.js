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
  return out;
}
