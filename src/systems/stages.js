// Turning a depth into a fight.
//
// "Depth" is the absolute level index — 0, 1, 2, … with no ceiling. It splits
// into a terrain *stage* and a *level* within it:
//
//     depth 0   → stage 0, level 0      first fight of The Reedbank
//     depth 9   → stage 0, level 9      its boss
//     depth 10  → stage 1, level 0      first fight of The Mudflats
//
// Which enemy stands at a given depth is deterministic — a depth is a place,
// and coming back to it finds the same thing waiting.

import * as B from '../balance.js';
import { ENEMIES } from '../data/enemies.js';
import { terrainForStage, enemyPoolForStage, tierEpithet } from '../data/terrains.js';

export const LEVELS_PER_STAGE = B.LEVELS_PER_STAGE;

/** Split an absolute depth into its terrain stage, level, and boss flag. */
export function depthInfo(depth) {
  const { stage, level } = B.splitLevel(depth);
  return { depth: Math.max(0, Math.floor(depth)), stage, level, isBoss: B.isBossLevel(level) };
}

/** Absolute depth from a stage/level pair. */
export function toDepth(stage, level = 0) {
  return B.absoluteLevel(stage, level);
}

/** The terrain a depth sits in, with its cycle tier and display name. */
export function terrainForDepth(depth) {
  return terrainForStage(depthInfo(depth).stage);
}

/**
 * Which enemy stands at a depth. Bosses are the terrain's own; everything else
 * is drawn from the compounding pool, seeded so it never changes.
 */
export function enemyIdForDepth(depth) {
  const { stage, level, isBoss } = depthInfo(depth);
  const terrain = terrainForStage(stage);
  if (isBoss) return terrain.boss;

  const pool = enemyPoolForStage(stage);
  if (!pool.length) return terrain.natives[0];

  // Seeded on the absolute depth: the same fight every time you walk back.
  const rng = B.makeRng(depth * 2654435761 + 17);
  const picked = B.weightedPick(pool, rng());
  return picked ? picked.id : pool[0].id;
}

/**
 * A full enemy instance for a depth: stats from the curve, flavour from the
 * registry, and an epithet once the terrain table has started cycling.
 */
export function buildEnemy(depth) {
  const info = depthInfo(depth);
  const terrain = terrainForStage(info.stage);
  const id = enemyIdForDepth(depth);
  const def = ENEMIES[id];

  const mod = def.statMod;
  const epithet = tierEpithet(terrain.tier);
  // Each cycle of the terrain table makes everything a little meaner on top of
  // the stage curve, so "Reedbank III" is not just a renamed Reedbank.
  const tierMult = 1 + terrain.tier * 0.15;

  const maxHp = B.enemyHp(info.stage, info.level, info.isBoss) * mod.hp * tierMult;

  return {
    id,
    depth: info.depth,
    stage: info.stage,
    level: info.level,
    boss: info.isBoss,
    name: epithet ? `${epithet} ${def.name}` : def.name,
    baseName: def.name,
    shape: def.shape,
    palette: def.palette,
    element: def.element,
    blurb: def.blurb,
    terrain,
    maxHp,
    hp: maxHp,
    atk: B.enemyAtk(info.stage, info.level, info.isBoss) * mod.atk * tierMult,
    def: B.enemyDef(info.stage, info.level) * mod.def * tierMult,
    reward: B.enemyReward(info.stage, info.level, info.isBoss),
    attackEvery: info.isBoss ? 1.5 : 2.0,
  };
}

/** The boss instance for a stage, without having to walk to it. */
export function buildBoss(stage) {
  return buildEnemy(toDepth(stage, B.BOSS_LEVEL));
}

/** 1-based level position inside its stage, for the UI. */
export function levelInStage(depth) {
  return depthInfo(depth).level + 1;
}

/** Progress through the current stage, 0..1, for the pip row. */
export function stageProgress(depth) {
  return depthInfo(depth).level / LEVELS_PER_STAGE;
}
