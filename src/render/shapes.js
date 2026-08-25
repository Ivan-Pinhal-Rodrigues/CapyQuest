// One lookup for every 24×24 combatant shape.
//
// Enemies name their template as a string; this is where that string resolves.
// Keeping it in one place means adding a template is a one-line change and the
// content tests can walk every shape without knowing which file it came from.

import { ENEMY_SHAPES } from './enemySprites.js';
import { CAPY_ENEMY_SHAPES } from './capySprites.js';

export const SHAPES = { ...ENEMY_SHAPES, ...CAPY_ENEMY_SHAPES };

export const SHAPE_IDS = Object.keys(SHAPES);

export function shape(id) {
  return SHAPES[id];
}
