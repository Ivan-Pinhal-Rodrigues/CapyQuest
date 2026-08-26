// The onsen scene: capybara, water, bobbing yuzu, drifting steam, and the
// golden capybara when it shows up.

import { CAPY, EYES, EYE_OVERLAY_ORIGIN, YUZU, STEAM, GOLDEN_CAPY } from './sprites.js';
import { CAPY_SKINS, PROP_PALETTE } from './palettes.js';
import { bake, bakeLayered, blit, blitSquash, resizeCanvas, fitScale } from './canvas.js';
import { wornKey, wornLayers } from './wearables.js';
import { ParticleField } from './particles.js';

const YUZU_COUNT = 3;
const STEAM_COUNT = 5;

export class Scene {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = new ParticleField();

    this.time = 0;
    this.squash = 0; // 0..1, decays after each tap
    this.expression = 'open';
    this.expressionUntil = 0;
    this.blinkAt = 2 + Math.random() * 4;
    this.skin = 'classic';
    /** What is worn, as ids. `none` in a slot means bare. */
    this.worn = { hat: 'none', outfit: 'none', accessory: 'none' };
    this.reducedMotion = false;

    // Props get fixed random phases so they bob independently but repeatably.
    this.yuzu = Array.from({ length: YUZU_COUNT }, (_, i) => ({
      offset: (i - (YUZU_COUNT - 1) / 2) * 0.34,
      phase: Math.random() * Math.PI * 2,
      speed: 0.7 + Math.random() * 0.5,
    }));
    this.steam = Array.from({ length: STEAM_COUNT }, () => ({
      x: Math.random(),
      phase: Math.random() * Math.PI * 2,
      speed: 0.18 + Math.random() * 0.14,
      seed: Math.random(),
    }));

    this.golden = null; // { x, y, vx, vy, bornAt, ttl }
    // Both are recomputed in draw(); seeded here so a hitTest before the first
    // frame does not read undefined.
    this.capyBox = { x: 0, y: 0, r: 0 };
    this.goldenScale = 4;
  }

  setSkin(skin) {
    if (CAPY_SKINS[skin]) this.skin = skin;
  }

  /** What the capybara has on. Unknown ids simply draw nothing. */
  setWorn(worn = {}) {
    this.worn = {
      hat: worn.hat || 'none',
      outfit: worn.outfit || 'none',
      accessory: worn.accessory || 'none',
    };
  }

  setReducedMotion(on) {
    this.reducedMotion = !!on;
  }

  /** Play a reaction. `mood` is a key of EYES. */
  react(mood, durationSec = 0.45) {
    this.expression = mood;
    this.expressionUntil = this.time + durationSec;
  }

  /** Called on every tap: squash the capybara and throw water. */
  tap({ crit = false, frenzy = false } = {}) {
    this.squash = 1;
    this.react(crit ? 'star' : 'happy', crit ? 0.6 : 0.35);

    const { x, y, r } = this.capyBox;
    if (this.reducedMotion) return;

    if (crit) {
      this.particles.burst(x, y + r * 0.15, {
        count: 22,
        colors: ['#f7c948', '#fff7d6', '#ffe08a'],
        speed: 260,
        life: 0.75,
        size: 4,
      });
      this.particles.addShake(9);
    } else {
      this.particles.burst(x, y + r * 0.55, {
        count: frenzy ? 12 : 7,
        colors: ['#7fd0e6', '#c9f2ff', '#fdf6e8'],
        speed: 150,
        life: 0.5,
        size: 3,
      });
      this.particles.addShake(2.2);
    }
  }

  /** Spawn the roaming bonus capybara somewhere along the edges. */
  spawnGolden(ttlSec, logicalW, logicalH) {
    const margin = 60;
    this.golden = {
      x: margin + Math.random() * Math.max(1, logicalW - margin * 2),
      y: margin + Math.random() * Math.max(1, logicalH * 0.6),
      vx: (Math.random() - 0.5) * 70,
      vy: (Math.random() - 0.5) * 50,
      ttl: ttlSec,
      maxTtl: ttlSec,
      scale: 1,
    };
  }

  clearGolden() {
    this.golden = null;
  }

  /**
   * Hit test in logical (CSS) pixels. Returns 'golden' | 'capy' | null so the
   * caller can prioritise the bonus over the main target.
   */
  hitTest(px, py) {
    if (this.golden) {
      const g = this.golden;
      const size = GOLDEN_CAPY.w * this.goldenScale;
      if (Math.abs(px - g.x) <= size / 2 && Math.abs(py - g.y) <= size / 2) return 'golden';
    }
    const { x, y, r } = this.capyBox;
    // Generous circular hitbox — a clicker should never feel like it missed.
    if ((px - x) ** 2 + (py - y) ** 2 <= r * r) return 'capy';
    return null;
  }

  update(dt) {
    this.time += dt;
    this.squash = Math.max(0, this.squash - dt * 5.5);

    if (this.time > this.expressionUntil) {
      // Idle blink loop keeps the capybara looking alive between taps.
      if (this.time > this.blinkAt) {
        this.expression = 'blink';
        if (this.time > this.blinkAt + 0.13) {
          this.expression = 'open';
          this.blinkAt = this.time + 2.4 + Math.random() * 4.5;
        }
      } else {
        this.expression = 'open';
      }
    }

    if (this.golden) {
      const g = this.golden;
      g.ttl -= dt;
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      const { width, height } = this.canvas.getBoundingClientRect();
      // Bounce off the edges so it stays catchable.
      if (g.x < 40 || g.x > width - 40) g.vx *= -1;
      if (g.y < 40 || g.y > height - 40) g.vy *= -1;
      g.x = Math.max(40, Math.min(width - 40, g.x));
      g.y = Math.max(40, Math.min(height - 40, g.y));
      if (g.ttl <= 0) this.golden = null;
    }

    this.particles.update(dt);
  }

  draw({ frenzy = false } = {}) {
    const { ctx, canvas } = this;
    const { width, height, dpr } = resizeCanvas(canvas);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const shake = this.reducedMotion ? { x: 0, y: 0 } : this.particles.shakeOffset();
    ctx.save();
    ctx.translate(shake.x, shake.y);

    // Sprite scale: fill roughly 62% of the shorter axis, snapped to integers.
    const target = Math.min(width, height) * 0.62;
    const scale = fitScale(CAPY.w, target, 2);
    const cx = width / 2;
    // Sit slightly above centre. The bottom of the stage carries the toast strip
    // on narrow screens, and rising numbers need headroom above.
    const cy = height * 0.47;
    this.capyBox = { x: cx, y: cy, r: (CAPY.w * scale) / 2.35 };
    this.goldenScale = Math.max(2, Math.round(scale * 0.55));

    this.drawSteam(ctx, width, height, scale);
    this.drawCapy(ctx, cx, cy, scale, frenzy);
    this.drawYuzu(ctx, cx, cy, scale);
    if (this.golden) this.drawGolden(ctx);

    this.particles.draw(ctx);
    ctx.restore();
  }

  drawCapy(ctx, cx, cy, scale, frenzy) {
    const palette = CAPY_SKINS[frenzy ? 'golden' : this.skin] || CAPY_SKINS.classic;
    const mood = frenzy && this.expression === 'open' ? 'star' : this.expression;

    // Expression first, then the clothes, so a hat can sit over the ears and a
    // pair of glasses over the eyes rather than under them. The key has to
    // carry everything the composite depends on — a stale bake here is a
    // capybara wearing the last thing you tried on.
    const layers = [{ sprite: EYES[mood] || EYES.open, origin: EYE_OVERLAY_ORIGIN }, ...wornLayers(this.worn)];
    const key = `capy:${frenzy ? 'golden' : this.skin}:${mood}:${wornKey(this.worn)}`;
    const baked = bakeLayered(CAPY, layers, palette, key);

    // Slow breathing bob, plus squash-and-stretch on tap.
    const bob = this.reducedMotion ? 0 : Math.sin(this.time * 1.7) * scale * 0.35;
    const s = this.reducedMotion ? 0 : this.squash;
    const squashX = 1 + s * 0.09;
    const squashY = 1 - s * 0.11;

    blitSquash(ctx, baked, cx, cy + bob, scale, squashX, squashY);
  }

  drawYuzu(ctx, cx, cy, scale) {
    const baked = bake(YUZU, PROP_PALETTE, 'yuzu');
    const yScale = Math.max(1, Math.round(scale * 0.55));
    const waterY = cy + CAPY.h * scale * 0.32;
    for (const y of this.yuzu) {
      const bob = this.reducedMotion ? 0 : Math.sin(this.time * y.speed + y.phase) * yScale * 1.5;
      const drift = this.reducedMotion ? 0 : Math.cos(this.time * y.speed * 0.6 + y.phase) * scale * 0.8;
      blit(ctx, baked, cx + y.offset * CAPY.w * scale + drift, waterY + bob, yScale);
    }
  }

  drawSteam(ctx, width, height, scale) {
    if (this.reducedMotion) return;
    const baked = bake(STEAM, PROP_PALETTE, 'steam');
    // Keep puffs small and faint. At larger sizes they stop reading as steam
    // and start reading as grey rocks floating past the capybara.
    const sScale = Math.max(1, Math.round(scale * 0.26));
    for (const p of this.steam) {
      // Each puff rises on its own loop and fades near the top.
      const t = (this.time * p.speed + p.seed) % 1;
      const x = width * (0.18 + p.x * 0.64) + Math.sin(t * Math.PI * 2 + p.phase) * 18;
      const y = height * (0.72 - t * 0.55);
      const alpha = Math.sin(t * Math.PI) * 0.14;
      if (alpha <= 0.01) continue;
      blit(ctx, baked, x, y, sScale, { alpha });
    }
  }

  drawGolden(ctx) {
    const g = this.golden;
    const baked = bake(GOLDEN_CAPY, CAPY_SKINS.golden, 'goldencapy');
    const pulse = this.reducedMotion ? 1 : 1 + Math.sin(this.time * 8) * 0.06;
    // Blink out over the last second so the player feels the timer.
    const alpha = g.ttl < 1 ? Math.max(0.25, g.ttl) : 1;

    ctx.save();
    ctx.shadowColor = 'rgba(247,201,72,0.9)';
    ctx.shadowBlur = 18;
    blit(ctx, baked, g.x, g.y, this.goldenScale * pulse, { alpha });
    ctx.restore();
  }
}
