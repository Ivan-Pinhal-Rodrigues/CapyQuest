// Resolving what the capybara is wearing.
//
// Its own module so that combatStats.js and meta.js can both read equipment
// without importing each other — meta.js needs gear bonuses, and combatStats.js
// needs meta's modifiers, which would otherwise be a cycle.

import * as B from '../balance.js';
import { GEAR_BY_ID, SLOT_IDS } from '../data/gear.js';
import { SKILLS_BY_ID } from '../data/skills.js';

/** Resolve an inventory entry to its definition plus forge multiplier. */
export function resolveItem(entry) {
  if (!entry) return null;
  const def = GEAR_BY_ID[entry.id];
  if (!def) return null;
  return {
    ...def,
    uid: entry.uid,
    forge: entry.forge || 0,
    forgeMult: B.forgeMultiplier(entry.forge || 0),
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
 * These are flat: enhancement scales a piece's stats, never its bonus.
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
