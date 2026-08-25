// Achievement checking. Runs on a slow tick rather than every frame — the
// conditions only move when the player does something, and walking the table
// sixty times a second buys nothing.

import { ACHIEVEMENTS, achievementMet } from '../data/achievements.js';

/**
 * Unlock everything now satisfied. Returns the newly unlocked entries so the
 * caller can queue toasts and sounds for them.
 */
export function checkAchievements(state, now = Date.now()) {
  const unlocked = [];
  for (const ach of ACHIEVEMENTS) {
    if (state.achievements[ach.id]) continue;
    if (!achievementMet(ach, state)) continue;
    state.achievements[ach.id] = now;
    unlocked.push(ach);
  }
  return unlocked;
}

export function achievementProgress(state) {
  const total = ACHIEVEMENTS.length;
  const done = ACHIEVEMENTS.filter((a) => state.achievements[a.id]).length;
  return { done, total, ratio: total ? done / total : 0 };
}

/** Short human description of what an achievement's reward does. */
export function describeReward(reward) {
  if (!reward) return '';
  const pct = (v) => `${Math.round((v - 1) * 100)}%`;
  switch (reward.type) {
    case 'globalMult': return `+${pct(reward.value)} all income`;
    case 'clickMult': return `+${pct(reward.value)} tap power`;
    case 'zpsMult': return `+${pct(reward.value)} idle income`;
    case 'buildingMult': return `+${pct(reward.value)} from that generator`;
    case 'critChance': return `+${Math.round(reward.value * 100)}% crit chance`;
    case 'critDamage': return `+${reward.value.toFixed(2)}× crit damage`;
    case 'comboCap': return `+${reward.value} max combo`;
    case 'comboStep': return `+${(reward.value * 100).toFixed(1)}% per combo`;
    case 'goldenChance': return `+${Math.round(reward.value * 100)}% golden rate`;
    case 'goldenDuration': return `+${Math.round(reward.value * 100)}% golden duration`;
    case 'offlineRate': return `+${Math.round(reward.value * 100)}% offline rate`;
    case 'offlineCapHours': return `+${reward.value}h offline cap`;
    default: return '';
  }
}
