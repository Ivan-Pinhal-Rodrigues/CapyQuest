// The talent tree: points, tier gates, spending and respec.

import { TALENTS, TALENTS_BY_ID, TIER_GATES, POINTS_PER_LEVEL, POINTS_PER_PRESTIGE } from '../data/talents.js';

/** Total points earned so far, from character level and prestige count. */
export function totalPoints(state, level) {
  return (level - 1) * POINTS_PER_LEVEL + state.prestigeCount * POINTS_PER_PRESTIGE;
}

export function spentPoints(state) {
  return Object.values(state.talents || {}).reduce((a, b) => a + b, 0);
}

export function availablePoints(state, level) {
  return Math.max(0, totalPoints(state, level) - spentPoints(state));
}

/** Points spent inside one branch — what the tier gates measure. */
export function branchSpend(state, branch) {
  let sum = 0;
  for (const [id, ranks] of Object.entries(state.talents || {})) {
    if (TALENTS_BY_ID[id]?.branch === branch) sum += ranks;
  }
  return sum;
}

export function isTalentUnlocked(state, talent) {
  return branchSpend(state, talent.branch) >= TIER_GATES[talent.tier];
}

export function canBuyTalent(state, talent, level) {
  if ((state.talents[talent.id] || 0) >= talent.max) return { ok: false, reason: 'maxed' };
  if (!isTalentUnlocked(state, talent)) return { ok: false, reason: 'locked' };
  if (availablePoints(state, level) < 1) return { ok: false, reason: 'points' };
  return { ok: true };
}

export function buyTalent(state, id, level) {
  const talent = TALENTS_BY_ID[id];
  if (!talent) return { ok: false, reason: 'unknown' };

  const check = canBuyTalent(state, talent, level);
  if (!check.ok) return check;

  state.talents[id] = (state.talents[id] || 0) + 1;
  return { ok: true, ranks: state.talents[id] };
}

/**
 * Free, always. A tree you are afraid to touch is not a choice, it is a trap —
 * and charging for a respec mostly punishes the players still learning it.
 */
export function respec(state) {
  const refunded = spentPoints(state);
  state.talents = {};
  return { ok: true, refunded };
}

/** Every talent effect the player currently owns, expanded per rank. */
export function talentEffects(state) {
  const out = [];
  for (const [id, ranks] of Object.entries(state.talents || {})) {
    const talent = TALENTS_BY_ID[id];
    if (!talent || ranks <= 0) continue;
    for (let i = 0; i < ranks; i++) out.push(talent.effect);
  }
  return out;
}

/** Grouped for the UI: branch -> tier -> talents. */
export function treeLayout() {
  const branches = {};
  for (const talent of TALENTS) {
    branches[talent.branch] ??= { 1: [], 2: [], 3: [] };
    branches[talent.branch][talent.tier].push(talent);
  }
  return branches;
}
