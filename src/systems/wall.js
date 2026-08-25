// The wall detector.
//
// v1 unlocked prestige at a round number of currency, which is arbitrary — it
// could fire while you were still climbing comfortably, or long after you had
// stopped. This asks the only question that actually matters:
//
//     can I still kill the boss of this stage inside thirty seconds?
//
// When the answer turns to no, the run is over and Rebirth is the answer. The
// game says so out loud rather than leaving the player to grind into a wall
// they cannot see.

import * as B from '../balance.js';
import { buildBoss, depthInfo } from './stages.js';

/** Sustained damage per second, from the combat stat block. */
export function playerDps(stats) {
  if (!stats || !(stats.atk > 0)) return 0;
  // Mirrors combat.js: attack rate rises with SPD up to a ceiling, and crits
  // are folded in as their expected contribution.
  const rate = 0.65 + Math.min(1.6, (stats.spd || 0) / 260);
  const critBonus = 1 + (stats.crit || 0) * ((stats.critMult || 2) - 1);
  return stats.atk * rate * critBonus;
}

/**
 * How the run stands against the boss of a stage.
 * `ttk` is seconds; Infinity when the player cannot hurt it at all.
 */
export function assess(stage, stats, seconds = B.WALL_SECONDS) {
  const boss = buildBoss(stage);
  const dps = playerDps(stats);

  // Mitigation matters: a boss with heavy DEF is a wall even at high ATK.
  const effective = dps * (100 / (100 + boss.def));
  const ttk = effective > 0 ? boss.maxHp / effective : Infinity;

  return {
    stage,
    boss,
    dps,
    effectiveDps: effective,
    ttk,
    seconds,
    walled: ttk > seconds,
    // 0..1 — how close to the wall, for a meter that fills as you slow down.
    pressure: B.clamp(ttk / seconds, 0, 1),
  };
}

/** Assess the stage the player is standing in. */
export function assessCurrent(state, stats) {
  return assess(depthInfo(state.combat.depth).stage, stats);
}

/**
 * The deepest stage still clearable inside the limit — where the run realistically
 * ends. Walks forward from the current stage rather than searching blindly.
 */
export function reachableStage(stats, fromStage = 0, lookahead = 40) {
  let last = fromStage;
  for (let s = fromStage; s < fromStage + lookahead; s++) {
    if (assess(s, stats).walled) return last;
    last = s;
  }
  return last;
}

/**
 * Should the game be telling the player to rebirth? True once they are walled
 * *and* have enough depth behind them for the reset to pay something.
 */
export function shouldSuggestRebirth(state, stats) {
  const { stage } = depthInfo(state.combat.depth);
  if (stage < 1) return false;
  return assess(stage, stats).walled;
}
