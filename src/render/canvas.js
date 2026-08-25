// Sprite rasteriser + scene renderer.
//
// Every sprite is baked once into an offscreen canvas at 1× and then blitted
// with smoothing off, so scaling stays crisp at any zoom. Baking matters:
// drawing a 32×32 grid pixel-by-pixel every frame is 1024 fillRect calls, and
// we draw the capybara plus props sixty times a second.

const bakeCache = new Map();

/** Rasterise a sprite+palette pair to a canvas, memoised by cache key. */
export function bake(spr, palette, key) {
  const cacheKey = key || `${spr.w}x${spr.h}:${spr.rows[0]}:${JSON.stringify(palette)}`;
  const hit = bakeCache.get(cacheKey);
  if (hit) return hit;

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

/** Bake a sprite with an expression patch stamped over it (see EYES). */
export function bakeWithOverlay(spr, overlay, origin, palette, key) {
  const cacheKey = `${key}|overlay`;
  const hit = bakeCache.get(cacheKey);
  if (hit) return hit;

  const rows = spr.rows.map((r) => r.split(''));
  overlay.rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      const ty = origin.y + y;
      const tx = origin.x + x;
      if (rows[ty] && tx < rows[ty].length) rows[ty][tx] = ch;
    }
  });

  const merged = { w: spr.w, h: spr.h, rows: rows.map((r) => r.join('')) };
  const canvas = bake(merged, palette, `${cacheKey}:raw`);
  bakeCache.set(cacheKey, canvas);
  return canvas;
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

/** Integer sprite scale that fills a target size without blurring. */
export function fitScale(spriteSize, targetPx, min = 1) {
  return Math.max(min, Math.floor(targetPx / spriteSize));
}

export function clearBakeCache() {
  bakeCache.clear();
}
