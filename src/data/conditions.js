// Conditional tree effects: nodes that are worth something only to a build.
//
// A flat "+x% per rank" is the same node in every branch wearing a different
// colour. A node that pays only when you are unarmoured, or only once you have
// committed a keystone, is a node that argues for a particular way of playing —
// and arguing is the whole job of a skill tree.
//
// One deliberate restriction: every condition here reads *persistent* state and
// nothing else. No current HP, no "while the boss is enraged", nothing that
// only exists mid-fight.
//
// The reason is architectural rather than aesthetic. Tree effects are gathered
// by systems/stats.js inside recomputeDerived(state), which runs every frame,
// knows only the save, and has no combat instance — deliberately, because it is
// also what prices the shop and the offline cache. Threading live combat state
// into it to support "while above 80% HP" would couple the economy to the fight
// loop in both directions, and a condition that quietly stops being evaluated
// is worse than no condition at all. So: if a predicate cannot be answered from
// the save alone, it does not belong here.

import { SLOT_IDS } from './gear.js';

/**
 * Each entry takes the save and returns a multiplier on the node's effect —
 * usually 0 or 1, but a scaling condition can return more.
 *
 * A multiplier rather than a boolean so "per empty slot" is expressible without
 * a second mechanism.
 */
export const CONDITIONS = {
  /** Nothing equipped in that slot count — rewards going deliberately light. */
  unarmoured: {
    label: 'while you are wearing nothing',
    test: (state) => (Object.keys(state.combat?.equipped || {}).length === 0 ? 1 : 0),
  },

  /** Scales with how bare you are, so it is worth something part-way too. */
  perEmptySlot: {
    label: 'for each empty equipment slot',
    test: (state) => SLOT_IDS.length - Object.keys(state.combat?.equipped || {}).length,
  },

  /** Rewards actually committing to a keystone rather than hoarding Essence. */
  committed: {
    label: 'once you have taken a keystone',
    test: (state) => ((state.keystones || []).length > 0 ? 1 : 0),
  },

  /** For the player who took all three. The most committed build there is. */
  allIn: {
    label: 'with all three keystones taken',
    test: (state) => ((state.keystones || []).length >= 3 ? 1 : 0),
  },

  /** Fighting alone — no party, no help. */
  soloist: {
    label: 'while your party is empty',
    test: (state) => ((state.gacha?.party || []).length === 0 ? 1 : 0),
  },

  /** The opposite: pays for filling every party slot. */
  fullParty: {
    label: 'with a full party of three',
    test: (state) => ((state.gacha?.party || []).length >= 3 ? 1 : 0),
  },

  /** Rewards the long haul rather than the current run. */
  veteran: {
    label: 'after ten rebirths',
    test: (state) => ((state.rebirthCount || 0) >= 10 ? 1 : 0),
  },

  /** Early in a fresh run, when a leg-up is worth most. */
  freshStart: {
    label: 'until stage 10',
    test: (state) => (Math.floor((state.combat?.bestDepth || 0) / 10) < 10 ? 1 : 0),
  },
};

/** How much of a conditional node's effect currently applies. */
export function conditionMultiplier(id, state) {
  const condition = CONDITIONS[id];
  if (!condition) return 1;
  return Math.max(0, condition.test(state));
}

export function conditionLabel(id) {
  return CONDITIONS[id]?.label || '';
}

/**
 * Which nodes carry which condition.
 *
 * Kept as a table here rather than as a field on each node so the whole set is
 * readable in one place — the risk with conditionals is a player buying a node
 * that silently does nothing, and that risk is much easier to audit from a list
 * of twenty than from twenty scattered flags. A test asserts every id exists.
 */
export const NODE_CONDITIONS = {
  // Might — the unarmoured brawler, and a payoff for committing
  might23: 'unarmoured',
  might24: 'committed',
  might25: 'allIn',

  // Hide — the one who stands alone
  hide22: 'soloist',
  hide23: 'perEmptySlot',
  hide24: 'committed',

  // Fortune — luck rewards the long haul
  fortune21: 'committed',
  fortune23: 'veteran',

  // Flow — speed for the soloist
  flow25: 'soloist',
  flow26: 'allIn',

  // Commerce — the long game, and a leg-up on a fresh run
  commerce13: 'freshStart',
  commerce14: 'veteran',
  commerce15: 'committed',

  // Instinct — bare paws, and a party that does the fighting for you
  instinct22: 'unarmoured',
  instinct24: 'perEmptySlot',
  instinct25: 'fullParty',

  // Legacy — everything you did before this run
  legacy20: 'veteran',
  legacy21: 'committed',
  legacy22: 'fullParty',
  legacy23: 'allIn',
};
