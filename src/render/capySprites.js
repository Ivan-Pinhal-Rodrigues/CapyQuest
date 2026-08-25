// Hostile capybaras.
//
// The one you tap is friendly and 32×32. These are the ones that fight back,
// drawn at 24×24 to match the rest of the enemy roster: brows down, teeth out,
// and low to the ground. Two poses — an ordinary one and a heavy one — carry
// eighteen named capybara enemies between them via palette swap.
//
// Palette slots: o outline, 1 dark, 2 mid, 3 light, 4 accent, e eye, w tooth.

function sprite(rows) {
  return { w: rows[0].length, h: rows.length, rows };
}

/** The standard aggressor. Ears back, brow down. */
export const CAPY_HOSTILE = sprite([
  '........................',
  '......oo........oo......',
  '.....o11o......o11o.....',
  '....oooooooooooooooo....',
  '...o3333333333333333o...',
  '...o333oo333333oo333o...',
  '...o333ee333333ee333o...',
  '...o3333333333333333o...',
  '...o3333322222233333o...',
  '...o333332wwww233333o...',
  '...o3333322222233333o...',
  '..o333333333333333333o..',
  '..o332222222222222233o..',
  '..o322222222222222223o..',
  '..o322222222222222223o..',
  '..o332222222222222233o..',
  '..o333333333333333333o..',
  '...o3333333333333333o...',
  '....o11o33333333o11o....',
  '....o11o33333333o11o....',
  '....oooo33333333oooo....',
  '........oooooooo........',
  '........................',
  '........................',
]);

/** The heavy. Wider, lower, more teeth. Used for elites and terrain bruisers. */
export const CAPY_HULK = sprite([
  '........................',
  '........................',
  '........................',
  '.....oo..........oo.....',
  '....o11o........o11o....',
  '...oooooooooooooooooo...',
  '..o333333333333333333o..',
  '..o33oo3333333333oo33o..',
  '..o33ee3333333333ee33o..',
  '..o333333333333333333o..',
  '..o333332222222233333o..',
  '..o33332wwwwwwww23333o..',
  '..o333332222222233333o..',
  '.o33333333333333333333o.',
  'o3333333333333333333333o',
  'o3322222222222222222233o',
  'o3222222222222222222223o',
  'o3222222222222222222223o',
  'o3322222222222222222233o',
  'o3333333333333333333333o',
  '.o33333333333333333333o.',
  '..oo11oo........oo11oo..',
  '..o1111o........o1111o..',
  '..oooooo........oooooo..',
]);

export const CAPY_ENEMY_SHAPES = { CAPY_HOSTILE, CAPY_HULK };
