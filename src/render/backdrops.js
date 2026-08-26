// Backdrops for the boot screen.
//
// An event can put a picture behind the loading screen. The mechanism accepts
// any image — a file in assets/, an absolute URL, a data URI — because an admin
// running a seasonal event should be able to drop in artwork without touching
// code. See docs/CONTENT.md.
//
// What *ships*, though, is these: small tiling patterns drawn as character
// grids, in exactly the pipeline the rest of the game uses. Three reasons that
// is the right default rather than a set of PNGs.
//
//   They diff. A backdrop is content, and content that reviews as a picture
//   cannot be reviewed at all.
//   They are tiny. Eight of these together weigh less than one screenshot.
//   They match. A photographic backdrop behind a 32×32 capybara looks like two
//   games stapled together.
//
// Each is a 16×16 tile repeated across the screen, so the whole set costs about
// two kilobytes of source and renders at any resolution.

const PALETTE = {
  '.': null,
  a: '#2a1f36',
  b: '#3a2b4a',
  c: '#4d3a60',
  d: '#f7c948',
  e: '#7fd0e6',
  f: '#7cc255',
  g: '#e8734a',
  h: '#c9e2ed',
  i: '#f7c0cd',
  j: '#8f6bc2',
};

function tile(rows) {
  return { w: rows[0].length, h: rows.length, rows };
}

export const BACKDROPS = {
  /**
   * Falling petals. Sakura, Founders' Week.
   *
   * A petal is a two-wide diagonal, not a blob. The first draft of this and of
   * steam and citrus was a three-pixel diamond, `.i.` over `iii` over `.i.`,
   * and at six screen pixels per tile pixel a diamond is a plus sign — so three
   * different events were painting the same crosshatch in three different
   * colours. Nothing but a rendered screenshot was going to say so.
   */
  petals: tile([
    '................',
    '...ii...........',
    '..ii........ii..',
    '...........ii...',
    '................',
    '.........ii.....',
    '........ii......',
    '................',
    '.ii.............',
    'ii..........ii..',
    '...........ii...',
    '................',
    '.....ii.........',
    '....ii..........',
    '..........ii....',
    '.........ii.....',
  ]),

  /** Rising steam. The Great Nap, and the default for anything warm. */
  steam: tile([
    '................',
    '....hh.....hh...',
    '...hh.....hh....',
    '....hh.....hh...',
    '................',
    '................',
    '........hh......',
    '.......hh.......',
    '........hh......',
    '................',
    '..hh.........hh.',
    '.hh.........hh..',
    '..hh.........hh.',
    '................',
    '................',
    '................',
  ]),

  /** Embers on the updraught. Steam Festival. Streaks, so they read as rising. */
  embers: tile([
    '...g............',
    '...g............',
    '...g......g.....',
    '..........g.....',
    '..........g.g...',
    '............g...',
    '............g...',
    '.g..............',
    '.g..............',
    '.g.......g......',
    '.........g......',
    '.........g......',
    '..............g.',
    '.....g........g.',
    '.....g........g.',
    '.....g..........',
  ]),

  /** Falling yuzu. Yuzu Harvest. Round, with the leaf still on. */
  citrus: tile([
    '................',
    '....f...........',
    '...dd...........',
    '..dddd......f...',
    '...dd......dd...',
    '..........dddd..',
    '...........dd...',
    '................',
    '.......f........',
    '......dd........',
    '.....dddd.......',
    '..f...dd........',
    '.dd..........f..',
    'dddd.........dd.',
    '.dd.........dddd',
    '.............dd.',
  ]),

  /** A field of stars. Moonlit Bathhouse. Sparkles near, dust far. */
  stars: tile([
    '.........c......',
    '...h............',
    '..hhh...........',
    '...h............',
    '.............c..',
    'c...............',
    '......c.........',
    '...........h....',
    '..........hhh...',
    '..c........h....',
    '..............c.',
    '........c.......',
    '......h.........',
    '.....hhh........',
    '......h....c....',
    '...c............',
  ]),

  /**
   * Reeds. Reed Rush.
   *
   * Drawn with no blank row running the full width. The first version had two,
   * and repeated across a 1280px screen they stopped reading as reeds and
   * started reading as ruled lines — the tile was seamless in the sense the
   * test checks (square, so the edges meet) and obviously repeating to look at.
   * Stalks now cross the top and bottom edges, so a column continues into the
   * copy above it.
   */
  reeds: tile([
    '..f.........f...',
    '..f....f....f...',
    '..f....f....f..f',
    '.ff....f...ff..f',
    '..f...ff...ff...',
    'f.....f........f',
    'f...........f...',
    '.....f......f...',
    '....ff.....ff...',
    '.....f.....ff..f',
    '.f...f.........f',
    '.f....f.....f...',
    '.f....f.....f...',
    'ff...ff....ff..f',
    '.f....f....ff...',
    '..f...f........f',
  ]),

  /** Ripples. Crystal Tide, and anything to do with the water itself. */
  ripples: tile([
    '................',
    '..eeee....eeee..',
    '.e....e..e....e.',
    '................',
    '................',
    '......eeee......',
    '.....e....e.....',
    '................',
    '................',
    'eee....eeee....e',
    '...e..e....e..e.',
    '................',
    '................',
    '....eeee....eeee',
    '...e....e..e....',
    '................',
  ]),

  /** Snow. The Long Winter. Fat flakes near, fine ones far. */
  snow: tile([
    '............h...',
    '...hh...........',
    '...hh...........',
    '........h.......',
    'h...............',
    '..............h.',
    '...........hh...',
    '...........hh...',
    '.....h..........',
    '..h.............',
    '.........h......',
    '......hh........',
    '......hh........',
    '.............h..',
    '.h..............',
    '..........h.....',
  ]),

  /** A slow purple drift. The Still Point Rift and the endgame events. */
  rift: tile([
    '....j...........',
    '.....j..........',
    '......j.........',
    '.......j........',
    '...........j....',
    '............j...',
    '.............j..',
    '.j............j.',
    '..j.............',
    '...j............',
    '....j...........',
    '........j.......',
    'j........j......',
    '.j........j.....',
    '..j........j....',
    '...j............',
  ]),
};

export const BACKDROP_IDS = Object.keys(BACKDROPS);

const urlCache = new Map();

/**
 * A backdrop as a data URL, ready to hand to `background-image`.
 *
 * Baked once and memoised. Returns null for anything that is not a known
 * backdrop id, so callers can fall through to treating the value as a path.
 */
export function backdropFor(id) {
  if (!BACKDROPS[id]) return null;
  const hit = urlCache.get(id);
  if (hit) return hit;

  const url = bakeTile(BACKDROPS[id]).toDataURL();
  urlCache.set(id, url);
  return url;
}

/**
 * Baked on a transparent tile rather than through render/canvas.js `bake`.
 *
 * The difference matters: a backdrop sits over the boot screen's own colour and
 * has to let it through, and `bake`'s cache is keyed for sprites drawn at
 * integer scales into the game canvas. Keeping them apart means a backdrop can
 * never evict the capybara from that cache.
 */
function bakeTile(spr) {
  const canvas = document.createElement('canvas');
  canvas.width = spr.w;
  canvas.height = spr.h;
  const ctx = canvas.getContext('2d');

  for (let y = 0; y < spr.h; y++) {
    for (let x = 0; x < spr.w; x++) {
      const colour = PALETTE[spr.rows[y][x]];
      if (!colour) continue;
      ctx.fillStyle = colour;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return canvas;
}

export { PALETTE as BACKDROP_PALETTE };
