// Rebirth: the answer to the wall.
//
// v1 unlocked its reset at a round number of currency — one trillion zen —
// which is arbitrary. It could fire while you were still climbing comfortably,
// or long after you had stopped enjoying yourself. Rebirth unlocks instead when
// the maths says you are stuck: the boss of the stage you are standing in can
// no longer be killed inside thirty seconds (see systems/wall.js).
//
// The payout scales off the deepest stage reached rather than off zen, so the
// reset pays out for exactly the thing that walled you.
//
// The rule that keeps this honest, inherited from v1: a reset must never cost
// you a collection. Losing an hour of income is a decision; losing a 5★ you
// pulled is a betrayal. The fresh half is rebuilt from createState() and
// everything kept is listed explicitly, so a field added later resets by
// default instead of leaking through unnoticed.

import * as B from '../balance.js';
import { createState } from '../state.js';
import { treeEffects } from './tree.js';
import { CONSTELLATIONS_BY_ID } from '../data/constellations.js';
import { assess, shouldSuggestRebirth } from './wall.js';

/** Multiplier on the essence payout, from the tree and from constellations. */
export function essenceGainMult(state) {
  let mult = 1;
  for (const effect of treeEffects(state)) {
    if (effect.type === 'essenceGain') mult += effect.value;
  }
  for (const [id, ranks] of Object.entries(state.constellations || {})) {
    const def = CONSTELLATIONS_BY_ID[id];
    if (def?.effect.type === 'essenceGain') mult += def.effect.value * ranks;
  }
  return mult;
}

/** The deepest stage the player has actually stood in. */
export function deepestStage(state) {
  return B.splitLevel(state.combat.bestDepth).stage;
}

/**
 * Rebirth stays unlocked once the wall has been seen. Call this every time the
 * stat block changes; it is idempotent and cheap.
 */
export function noteWall(state, stats) {
  if (state.rebirthUnlocked) return false;
  if (!shouldSuggestRebirth(state, stats)) return false;
  state.rebirthUnlocked = true;
  return true; // newly unlocked — the caller announces it
}

/**
 * What a rebirth right now would pay, and whether the game is currently telling
 * you to take it. `stats` is optional: without it the wall figures are absent
 * but the payout is still correct.
 */
export function rebirthPreview(state, stats = null) {
  const mult = essenceGainMult(state);
  const stage = deepestStage(state);
  const essence = B.essenceFromStage(stage, mult);
  const nextStage = Math.ceil(B.stageForEssence(essence + 1, mult));

  const report = stats ? assess(B.splitLevel(state.combat.depth).stage, stats) : null;

  return {
    essence,
    mult,
    stage,
    nextStage,
    unlocked: !!state.rebirthUnlocked,
    walled: report ? report.walled : false,
    ttk: report ? report.ttk : null,
    pressure: report ? report.pressure : 0,
    // Unlocking is what the wall does; being *able* to also needs a payout.
    canRebirth: !!state.rebirthUnlocked && essence > 0,
  };
}

/**
 * Perform a rebirth. Mutates and returns the state so the caller can swap it in
 * wholesale.
 */
export function rebirth(state, now = Date.now()) {
  const preview = rebirthPreview(state);
  if (!preview.canRebirth) return { ok: false, reason: 'notYet' };

  const fresh = createState(now);

  // Everything below is explicitly carried across the reset. Anything not
  // listed here goes back to its starting value.
  const kept = {
    createdAt: state.createdAt,
    totalZen: state.totalZen,
    lifetimeClicks: state.lifetimeClicks,
    essence: state.essence + preview.essence,
    lifetimeEssence: state.lifetimeEssence + preview.essence,
    rebirthCount: state.rebirthCount + 1,
    rebirthUnlocked: true,
    lotus: state.lotus,
    lifetimeLotus: state.lifetimeLotus,
    ascendCount: state.ascendCount,
    achievements: state.achievements,
    // The tree is the whole point of pressing the button. Every rank ever
    // bought, in every branch, survives untouched.
    tree: state.tree,
    constellations: state.constellations,
    stats: state.stats,
    settings: state.settings,
    // Retention state is keyed to the calendar, not to progression. Wiping a
    // login streak or a half-finished daily because the player rebirthed would
    // punish them for playing well.
    quests: state.quests,
    // The narrative layer is knowledge, not progress. Sitting through the
    // opening again after a reset would be unbearable, and your own name is
    // yours — neither is something a button should be able to take.
    story: state.story,
    profile: state.profile,
    login: state.login,
    chest: state.chest,
    pass: state.pass,
    codes: state.codes,
    gacha: state.gacha,
    // The run through the terrains starts again, but the kit you earned on it
    // does not. Gear, forge levels, skills and shards all stay.
    combat: { ...state.combat, depth: 0, bestDepth: 0, xp: 0 },
  };

  Object.assign(fresh, kept);
  fresh.stats.rebirths = (fresh.stats.rebirths || 0) + 1;
  Object.assign(state, fresh);

  return { ok: true, gained: preview.essence, total: state.essence, stage: preview.stage };
}
