// The player's combat stat block: level base + equipped gear + passive skills.
//
// Kept separate from systems/stats.js because the two answer different
// questions. That one asks "how much zen per tap"; this one asks "can the
// capybara survive stage 74". Gear that also affects income declares a `bonus`,
// which stats.js picks up via equippedBonuses().

import * as B from '../balance.js';
import { SKILLS_BY_ID } from '../data/skills.js';
import { companionMultiplier } from '../data/companions.js';
import { resolveItem, equippedItem, equippedItems, equippedBonuses } from './equipment.js';
import { combatModifiers } from './meta.js';
import { partyMembers } from './gacha.js';

const BASE = { atk: 10, def: 5, hp: 100, spd: 20, crit: 0.05, critDmg: 0, luck: 0 };
const GROWTH = { atk: 1.12, def: 1.075, hp: 1.095 };

function emptyBlock() {
  return { atk: 0, def: 0, hp: 0, spd: 0, crit: 0, critDmg: 0, luck: 0 };
}

function addStats(into, stats, mult = 1) {
  if (!stats) return;
  for (const key of Object.keys(into)) {
    if (stats[key]) into[key] += stats[key] * mult;
  }
}

// Re-exported so existing callers keep one import site for "the kit".
export { resolveItem, equippedItem, equippedItems, equippedBonuses };

/** The full combat stat block. */
export function combatStats(state) {
  const level = B.levelFromXp(state.combat.xp || 0);
  const block = emptyBlock();

  block.atk = BASE.atk * Math.pow(GROWTH.atk, level - 1);
  block.def = BASE.def * Math.pow(GROWTH.def, level - 1);
  block.hp = BASE.hp * Math.pow(GROWTH.hp, level - 1);
  block.spd = BASE.spd;
  block.crit = BASE.crit;
  block.critDmg = BASE.critDmg;
  block.luck = BASE.luck;

  for (const item of equippedItems(state)) {
    // Enhancement scales the piece's own stats; it does not touch its bonus.
    addStats(block, item.stats, item.forgeMult);
  }

  for (const id of state.combat.skills || []) {
    const skill = SKILLS_BY_ID[id];
    if (skill?.kind === 'passive') addStats(block, skill.stats);
  }

  // Party companions add their stats scaled by their own level.
  for (const member of partyMembers(state)) {
    addStats(block, member.stats, companionMultiplier(member.level));
  }

  // Talents, relics and constellations multiply what everything else built.
  const mods = combatModifiers(state);
  block.atk *= mods.atk;
  block.def *= mods.def;
  block.hp *= mods.hp;
  block.spd *= mods.spd;
  block.luck += mods.luck;
  block.crit += mods.crit;
  block.critDmg += mods.critDmg;

  return {
    level,
    xp: state.combat.xp || 0,
    xpIntoLevel: (state.combat.xp || 0) - B.xpForLevel(level),
    xpForNext: B.xpForLevel(level + 1) - B.xpForLevel(level),
    atk: block.atk,
    def: block.def,
    hp: block.hp,
    spd: block.spd,
    crit: B.critChance(block.crit),
    critMult: B.critMultiplier(block.critDmg),
    luck: block.luck,
    element: state.combat.element || 'water',
    power: Math.round(block.atk * 3 + block.def * 2.5 + block.hp * 0.5 + block.spd * 2),
  };
}

/** XP awarded for clearing a stage. */
export function xpForStage(stage, isBoss) {
  return Math.ceil(6 * Math.pow(2.2, stage) * (isBoss ? 5 : 1));
}
