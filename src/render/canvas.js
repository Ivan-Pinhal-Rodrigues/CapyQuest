// Sprite rasteriser + scene renderer.
//
// Every sprite is baked once into an offscreen canvas at 1× and then blitted
// with smoothing off, so scaling stays crisp at any zoom. Baking matters:
// drawing a 32×32 grid pixel-by-pixel every frame is 1024 fillRect calls, and
// we draw the capybara plus props sixty times a second.

const bakeCache = new Map();

/**
 * How many baked canvases to keep.
 *
 * The cache never used to need a bound: a handful of sprites times a handful of
 * palettes is a few dozen entries that live for the session. Wearables changed
 * that — the key is now skin × mood × hat × outfit × accessory, and while only
 * one combination is ever *worn*, the wardrobe preview walks the whole
 * catalogue as you browse it.
 *
 * Clearing wholesale rather than evicting the oldest is deliberate: the working
 * set after a clear is one capybara and a few props, so it refills in a frame,
 * and an LRU here would be more machinery than the problem deserves.
 */
const BAKE_CACHE_MAX = 400;

/** Rasterise a sprite+palette pair to a canvas, memoised by cache key. */
export function bake(spr, palette, key) {
  const cacheKey = key || `${spr.w}x${spr.h}:${spr.rows[0]}:${JSON.stringify(palette)}`;
  const hit = bakeCache.get(cacheKey);
  if (hit) return hit;
  if (bakeCache.size >= BAKE_CACHE_MAX) bakeCache.clear();

  const canvas = document.createElement('canvas');
  canvas.width = spr.w;
  canvas.height = spr.h;
  const ctx = canvas.getContext('2d');

  for (let y = 0; y < spr.h; y++) {
    const row = spr.rows[y];
    for (let x = 0; x < spr.w; x++) {
      const color = palette[row[x]];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  bakeCache.set(cacheKey, canvas);
  return canvas;
}

/**
 * Stamp patches onto a base grid, in order, and return the grid plus the
 * palette that resolves it.
 *
 * This is how the capybara gets dressed. Each layer is `{ sprite, origin,
 * palette }`: the grid is stamped at the origin, `.` staying transparent, and
 * later layers winning where they overlap.
 *
 * Kept separate from the baking, and pure, because the rasteriser needs a DOM
 * and this is where the interesting mistakes live.
 */
export function composeLayers(spr, layers, palette) {
  const rows = spr.rows.map((r) => r.split(''));
  const merged = { ...palette };

  layers.forEach((layer, index) => {
    if (!layer?.sprite) return;
    const { sprite, origin = { x: 0, y: 0 } } = layer;

    // Every layer draws in the same five characters — O, A, B, C, D — so
    // merging their palettes into one map would let the last layer decide what
    // colour the first one is. That is not hypothetical: a capybara in a red
    // cloak and black sunglasses came out wearing a black cloak, and since the
    // shape was right it read as a palette typo rather than a compositing bug.
    //
    // Each layer's characters are therefore rewritten to private-use codepoints
    // only it uses, and its colours registered against those. The layers stop
    // being able to see each other at all.
    const remap = new Map();
    if (layer.palette) {
      for (const [ch, colour] of Object.entries(layer.palette)) {
        const own = String.fromCharCode(PRIVATE_USE + index * LAYER_STRIDE + remap.size);
        remap.set(ch, own);
        merged[own] = colour;
      }
    }

    sprite.rows.forEach((row, y) => {
      const ty = origin.y + y;
      if (!rows[ty]) return;
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === '.') continue;
        const tx = origin.x + x;
        if (tx >= 0 && tx < rows[ty].length) rows[ty][tx] = remap.get(ch) ?? ch;
      }
    });
  });

  return {
    sprite: { w: spr.w, h: spr.h, rows: rows.map((r) => r.join('')) },
    palette: merged,
  };
}

export function bakeLayered(spr, layers, palette, key) {
  const hit = bakeCache.get(key);
  if (hit) return hit;

  const composed = composeLayers(spr, layers, palette);
  const canvas = bake(composed.sprite, composed.palette, `${key}:raw`);
  bakeCache.set(key, canvas);
  return canvas;
}

/** Where the per-layer character space starts, and how much each layer gets. */
const PRIVATE_USE = 0xe000;
const LAYER_STRIDE = 16;

/** Bake a sprite with a single expression patch stamped over it (see EYES). */
export function bakeWithOverlay(spr, overlay, origin, palette, key) {
  return bakeLayered(spr, [{ sprite: overlay, origin }], palette, `${key}|overlay`);
}

/** Draw a baked sprite at an integer scale, centred on (cx, cy). */
export function blit(ctx, baked, cx, cy, scale, { alpha = 1, rotate = 0, flip = false } = {}) {
  const w = baked.width * scale;
  const h = baked.height * scale;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.imageSmoothingEnabled = false;
  ctx.translate(cx, cy);
  if (rotate) ctx.rotate(rotate);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(baked, -w / 2, -h / 2, w, h);
  ctx.restore();
}

/**
 * Draw with independent x/y scaling — this is the squash-and-stretch that
 * makes a tap feel like it landed. Cheaper and more expressive than drawing
 * separate squashed frames.
 */
export function blitSquash(ctx, baked, cx, cy, scale, squashX, squashY, alpha = 1) {
  const w = baked.width * scale * squashX;
  const h = baked.height * scale * squashY;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.imageSmoothingEnabled = false;
  // Anchor at the bottom so a squashed capybara sinks rather than floats.
  ctx.drawImage(baked, cx - w / 2, cy - h / 2 + (baked.height * scale - h) / 2, w, h);
  ctx.restore();
}

/** Fit a canvas to its CSS box at device pixel ratio. Returns logical size. */
export function resizeCanvas(canvas, maxDpr = 2) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  const w = Math.max(1, Math.round(rect.width * dpr));
  const h = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  return { width: rect.width, height: rect.height, dpr };
}

/**
 * Integer sprite scale that fills a target CSS-pixel size without blurring.
 *
 * "Integer" has to mean integer *device* pixels, or the browser's own scaling
 * introduces blur no matter what `imageSmoothingEnabled` says. Picking the
 * step from `targetPx` alone — CSS pixels — chooses the same whole-number
 * scale regardless of `dpr`, so a phone at 3 device pixels per CSS pixel drew
 * exactly as coarse a set of sizes as a 1x display at the same CSS width: two
 * distinguishable pond sprite sizes at 320px where a 1280px desktop got five,
 * because the desktop's extra CSS room was doing a job the device's own extra
 * resolution should have been doing too.
 *
 * The integer count is chosen in device pixels (`targetPx * dpr`) and only
 * then converted back to the CSS-pixel scale `blit()` expects, by dividing by
 * `dpr` — so the result can be fractional in CSS space while every caller's
 * `scale * dpr` (what the dpr-scaled canvas transform actually draws) lands
 * on a whole device pixel regardless. A 1x display keeps exactly the old
 * behaviour, since dividing and multiplying by 1 changes nothing.
 */
export function fitScale(spriteSize, targetPx, min = 1, dpr = 1) {
  const deviceMin = Math.max(1, Math.round(min * dpr));
  const deviceScale = Math.max(deviceMin, Math.floor((targetPx * dpr) / spriteSize));
  return deviceScale / dpr;
}

export function clearBakeCache() {
  bakeCache.clear();
}
