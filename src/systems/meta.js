// Every effect granted by the meta layers, in one list.
//
// Two consumers read this and each picks out the types it cares about:
// systems/stats.js takes the income effects, systems/combatStats.js takes the
// combat ones. Collecting them here means a new tree node is wired into both by
// existing in the table, not by being remembered twice.

import { treeEffects } from './tree.js';
import { partyMembers } from './gacha.js';
import { equippedBonuses } from './equipment.js';
import { CONSTELLATIONS_BY_ID } from '../data/constellations.js';

/** Effects from the rebirth tree, constellations, party companions and gear. */
export function metaEffects(state) {
  const out = [];

  for (const effect of treeEffects(state)) out.push(effect);

  for (const [id, ranks] of Object.entries(state.constellations || {})) {
    const def = CONSTELLATIONS_BY_ID[id];
    if (!def) continue;
    for (let i = 0; i < ranks; i++) out.push(def.effect);
  }

  // Party bonuses are flat: you have them or you do not, regardless of level.
  for (const member of partyMembers(state)) {
    if (member.bonus) out.push(member.bonus);
  }

  for (const bonus of equippedBonuses(state)) out.push(bonus);

  return out;
}

/** The subset that scales combat stats, folded into multipliers and flats. */
export function combatModifiers(state) {
  const mods = { atk: 1, def: 1, hp: 1, spd: 1, luck: 0, crit: 0, critDmg: 0 };
  for (const effect of metaEffects(state)) {
    switch (effect.type) {
      case 'combatAtk': mods.atk += effect.value; break;
      case 'combatDef': mods.def += effect.value; break;
      case 'combatHp': mods.hp += effect.value; break;
      case 'combatSpd': mods.spd += effect.value; break;
      case 'combatLuck': mods.luck += effect.value; break;
      // Crit effects are shared with the tap side, so they count for both.
      case 'critChance': mods.crit += effect.value; break;
      case 'critDamage': mods.critDmg += effect.value; break;
      default: break;
    }
  }
  return mods;
}

/** Bonus summon tickets granted per boss killed. */
export function ticketsPerBoss(state) {
  let n = 0;
  for (const effect of metaEffects(state)) {
    if (effect.type === 'ticketRate') n += effect.value;
  }
  return n;
}
