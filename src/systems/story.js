// Which beat fires, and when.
//
// The rule the whole thing is built on: a beat fires **once, ever**, and only
// because the player reached the moment themselves. It is never a gate, never a
// choice, and never repeated. `state.story.seen` is the record, and it survives
// every reset in the game — a rebirth that made you sit through the opening
// again would be unbearable, and a season rollover has no business touching it.
//
// checkBeats() is a pure read: it looks at the state and returns the ids that
// have become due. The caller marks them seen when it has actually shown them,
// so a beat cannot be lost to a toast that never rendered.

import * as B from '../balance.js';
import { BEATS_BY_ID, TERRAIN_BEATS, REBIRTH_BEATS, ACTS, BEATS } from '../data/story.js';
import { NPCS_BY_ID } from '../data/npcs.js';

export function hasSeen(state, id) {
  return !!state.story?.seen?.[id];
}

/** Mark a beat shown. Returns false if it already had been. */
export function markSeen(state, id) {
  if (!BEATS_BY_ID[id] || hasSeen(state, id)) return false;
  state.story.seen[id] = Date.now();
  return true;
}

/**
 * Everything now due, oldest-first by the order they are authored in. Reading
 * rather than mutating means a caller that cannot show one right now — a modal
 * is up, the player is mid-fight — simply gets it again next tick.
 */
export function dueBeats(state) {
  if (state.story?.skip) return [];

  const due = [];
  const add = (id) => {
    if (id && BEATS_BY_ID[id] && !hasSeen(state, id)) due.push(id);
  };

  const s = state.stats || {};
  const c = state.combat || {};
  const stage = B.splitLevel(c.bestDepth || 0).stage;

  if (state.lifetimeClicks > 0) add('wake');
  if (Object.values(state.buildings || {}).some((n) => n > 0)) add('firstGenerator');
  if (Object.keys(state.clickUpgrades || {}).length + Object.keys(state.tierUpgrades || {}).length > 0) {
    add('firstUpgrade');
  }
  if (c.unlocked) add('questOpen');
  if ((c.clears || 0) > 0) add('firstFight');
  if ((c.bossKills || 0) > 0) add('firstBoss');
  if (s.metCapybara) add('firstCapybara');

  if ((s.drops || 0) > 0) add('firstDrop');
  if (Object.values(state.cases || {}).some((x) => x.opened > 0)) add('firstCase');
  if ((s.bestStars || 1) > 1) add('firstStar');
  if ((s.fuses || 0) > 0) add('firstFuse');

  // Terrain and rebirth beats fire on the deepest/most you have ever reached,
  // so walking back up and down again cannot re-trigger one.
  for (const [at, id] of Object.entries(TERRAIN_BEATS)) {
    if (stage >= Number(at)) add(id);
  }
  if (state.rebirthUnlocked) add('wall');
  for (const [at, id] of Object.entries(REBIRTH_BEATS)) {
    if ((state.rebirthCount || 0) >= Number(at)) add(id);
  }
  if ((state.lifetimeEssence || 0) >= 1000) add('ascendTease');

  return due;
}

/** The next single beat to show, resolved into something renderable. */
export function nextBeat(state) {
  const [id] = dueBeats(state);
  return id ? beat(id) : null;
}

/** A beat with its speaker attached. */
export function beat(id) {
  const def = BEATS_BY_ID[id];
  if (!def) return null;
  return { ...def, speaker: NPCS_BY_ID[def.npc] };
}

/** Everything seen so far, grouped by act, for the log. */
export function storyLog(state) {
  return ACTS.map((act) => ({
    ...act,
    beats: BEATS.filter((b) => b.act === act.id).map((b) => ({
      ...b,
      speaker: NPCS_BY_ID[b.npc],
      seen: hasSeen(state, b.id),
    })),
  }));
}

export function storyProgress(state) {
  const seen = BEATS.filter((b) => hasSeen(state, b.id)).length;
  return { seen, total: BEATS.length, ratio: seen / BEATS.length };
}
